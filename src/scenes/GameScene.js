import Phaser from 'phaser';

import { CONFIG } from '../config.js';
import { Grid } from '../world/Grid.js';
import { LEVEL_ROWS } from '../world/LevelData.js';
import { clampDelta } from '../utils/Timer.js';
import { Player } from '../entities/Player.js';
import { Enemy } from '../entities/Enemy.js';

/**
 * Owns everything that is on screen.
 *
 * The scene itself stays thin: it builds the grid, spawns the actors and draws
 * debug helpers. It never decides *what* an actor should do - that lives in
 * `src/ai`, which the scene only calls into.
 */
export default class GameScene extends Phaser.Scene {
  constructor() {
    super('Game');
  }

  create() {
    this.grid = new Grid(LEVEL_ROWS);
    for (const warning of this.grid.warnings) {
      console.warn(`[level] ${warning}`);
    }

    this.debugOn = false;

    this._drawFloor();
    this._buildWalls();
    this._drawMarkers();

    this.player = new Player(this, this.grid.spawn.x, this.grid.spawn.y);
    this.physics.add.collider(this.player.sprite, this.walls);

    this._spawnGuards();

    this.waypointDebug = this.add.graphics().setDepth(6);
    this._buildWaypointLabels();

    this.input.keyboard.on('keydown-F1', () => this.toggleDebug());
    this.input.keyboard.on('keydown-R', () => this.restartLevel());

    this.cameras.main.setBounds(0, 0, CONFIG.map.widthPx, CONFIG.map.heightPx);
  }

  update(_time, delta) {
    const dt = clampDelta(delta);

    this.player.update(dt);

    // Every guard senses the same player position for the frame, so two guards
    // can never disagree about where the player was.
    const target = this.player.position;

    for (const enemy of this.enemies) {
      enemy.update(dt, target);
    }

    if (this.debugOn) this._drawWaypointDebug();
  }

  // -------------------------------------------------------------------- world

  _drawFloor() {
    this.add
      .tileSprite(0, 0, CONFIG.map.widthPx, CONFIG.map.heightPx, 'floor')
      .setOrigin(0, 0)
      .setDepth(0);
  }

  /**
   * One static image per wall tile. At 25 x 18 that is a few hundred bodies,
   * which Arcade Physics handles without complaint, and it keeps collision
   * exactly aligned with what is drawn.
   */
  _buildWalls() {
    this.walls = this.physics.add.staticGroup();

    for (let cy = 0; cy < this.grid.rows; cy += 1) {
      for (let cx = 0; cx < this.grid.cols; cx += 1) {
        if (!this.grid.isWall(cx, cy)) continue;
        const { x, y } = this.grid.cellToWorld(cx, cy);
        this.walls.create(x, y, 'wall').setDepth(1);
      }
    }
  }

  _drawMarkers() {
    if (this.grid.exit) {
      this.add.image(this.grid.exit.x, this.grid.exit.y, 'exit').setDepth(2);
    }

    for (const chip of this.grid.chips) {
      this.add.image(chip.x, chip.y, 'chip').setDepth(2);
    }
  }

  // ------------------------------------------------------------------ actors

  /**
   * Guards start spread evenly around the shared waypoint loop, each facing the
   * waypoint it is about to walk to.
   *
   * Spawning a guard *on* its post is deliberate: the first frame then counts
   * as an arrival, so the guard pauses and scans before setting off, which is
   * exactly how it behaves after every other waypoint.
   */
  _spawnGuards() {
    this.enemies = [];

    const waypoints = this.grid.waypoints;
    const wanted = Math.max(1, CONFIG.enemy.count);
    const count = Math.max(1, Math.min(wanted, waypoints.length));

    for (let i = 0; i < count; i += 1) {
      // Evenly spaced posts, computed by ratio rather than by a stride so that
      // three guards around four waypoints do not land two of them together.
      const startIndex = Math.floor((i * waypoints.length) / count);

      // A level with fewer than two waypoints has no loop to share: fall back
      // to the player's spawn tile, which is guaranteed walkable, and let the
      // brain's look-around scan stand in for the missing route.
      const post = waypoints[startIndex] ?? this.grid.spawn;
      const next = waypoints[(startIndex + 1) % waypoints.length];

      this.enemies.push(
        new Enemy(this, {
          name: `guard-${i + 1}`,
          x: post.x,
          y: post.y,
          heading: next ? Math.atan2(next.y - post.y, next.x - post.x) : 0,
          waypoints,
          startIndex,
          grid: this.grid,
        }),
      );
    }
  }

  // ------------------------------------------------------------------- debug

  /**
   * Sends both actors back to where they started, without rebuilding the scene.
   *
   * Every actor owns a `reset()` for exactly this. Rebuilding the scene would
   * work too, but it re-parses the level, regenerates nothing and drops the
   * debug toggle, whereas a reset is instant and leaves the world alone.
   */
  restartLevel() {
    this.player.reset();

    for (const enemy of this.enemies) {
      enemy.reset();
    }
  }

  /**
   * One text object per waypoint, created once and toggled. Building them in
   * the draw call instead would allocate a new text object every frame.
   */
  _buildWaypointLabels() {
    this.waypointLabels = this.grid.waypoints.map((wp) =>
      this.add
        .text(wp.x + 12, wp.y - 15, String(wp.order), {
          fontFamily: 'ui-monospace, monospace',
          fontSize: '11px',
          color: '#66ccff',
        })
        .setDepth(22)
        .setVisible(false),
    );
  }

  toggleDebug() {
    this.debugOn = !this.debugOn;

    for (const enemy of this.enemies) {
      enemy.setDebugVisible(this.debugOn);
    }

    for (const label of this.waypointLabels) {
      label.setVisible(this.debugOn);
    }

    if (this.debugOn) {
      this._drawWaypointDebug();
    } else {
      this.waypointDebug.clear();
    }
  }

  /** Crosshairs plus the visit order, so the shared route is readable at a glance. */
  _drawWaypointDebug() {
    const g = this.waypointDebug;
    g.clear();

    g.lineStyle(1, 0x66ccff, 0.9);

    for (const wp of this.grid.waypoints) {
      g.strokeCircle(wp.x, wp.y, 11);
      g.lineBetween(wp.x - 7, wp.y, wp.x + 7, wp.y);
      g.lineBetween(wp.x, wp.y - 7, wp.x, wp.y + 7);
    }
  }
}
