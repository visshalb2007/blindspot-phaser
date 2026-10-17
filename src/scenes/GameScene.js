import Phaser from 'phaser';

import { CONFIG } from '../config.js';
import { Grid } from '../world/Grid.js';
import { DEFAULT_LEVEL, levelAt } from '../world/Levels.js';
import { Mission } from '../world/Mission.js';
import { guardPosts } from '../world/Roster.js';
import { RunStats, browserStorage } from '../world/RunStats.js';
import { Clock } from '../utils/Clock.js';
import { clampDelta } from '../utils/Timer.js';
import { Player } from '../entities/Player.js';
import { Enemy } from '../entities/Enemy.js';

/**
 * Where the guards are told the player is when nobody is playing.
 *
 * Far enough outside the level that no guard can see it, hear it or walk to it,
 * which is exactly right: on the start page the heist has not started and there
 * is nobody on the floor. The guards patrol with nothing to find, and the
 * backdrop stays an honest run of the same code the game runs.
 */
const NOBODY = Object.freeze({ x: -1e6, y: -1e6 });

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

  /**
   * @param {{shadow?: boolean, levelIndex?: number}} [data] `shadow` runs the
   *   level with nobody playing: the guards patrol and nothing else ever
   *   happens. It is the same scene rather than a second one that draws a
   *   level, so the backdrop on the start page cannot drift from the game it is
   *   standing behind. `levelIndex` picks which of the five levels to build.
   */
  init(data) {
    this.shadow = Boolean(data?.shadow);
    this.levelIndex = data?.levelIndex ?? DEFAULT_LEVEL;
    this.level = levelAt(this.levelIndex);
  }

  create() {
    this.grid = new Grid(this.level.rows);
    for (const warning of this.grid.warnings) {
      console.warn(`[level] ${warning}`);
    }

    this.debugOn = false;
    this.caught = false;
    this.statusText = null;

    this.mission = new Mission({ chips: this.grid.chips, exit: this.grid.exit });
    this.clock = new Clock({ running: !this.shadow });
    this.stats = new RunStats({ storage: browserStorage() });

    this._drawFloor();
    this._buildWalls();
    this._drawMarkers();
    this._paintExit();

    if (!this.shadow) {
      this.player = new Player(this, this.grid.spawn.x, this.grid.spawn.y);
      this.physics.add.collider(this.player.sprite, this.walls);

      // Counted now, at the beginning of the run rather than at the end of it:
      // a run abandoned by closing the tab is still a run that was begun.
      this.stats.startRun();
    }

    this._spawnGuards();
    this.waypointDebug = this.add.graphics().setDepth(6);
    this._buildWaypointLabels();

    if (!this.shadow) {
      this._buildHud();

      this.input.keyboard.on('keydown-F1', () => this.toggleDebug());
      this.input.keyboard.on('keydown-R', () => this.restartLevel());
      this.input.keyboard.on('keydown-ESC', () => this._exitToDashboard());
    }

    this.cameras.main.setBounds(0, 0, CONFIG.map.widthPx, CONFIG.map.heightPx);
  }

  update(_time, delta) {
    const dt = clampDelta(delta);

    if (this.shadow) {
      this._patrolBehindTheStartPage(dt);
      return;
    }

    // Being caught or walking out with the loot is a full stop: the guards hold
    // the pose they left you in and R is the only way out of it. The clock is
    // stopped with them, so the time on the banner is the time the run took.
    if (this.caught || this.mission.won) return;

    this.clock.tick(dt);
    this.player.update(dt);

    // Chips and the door come first: a chip is taken on the frame the player
    // reached it, and a run that ends here does not also take a swing.
    if (this._updateMission()) return;

    // Every guard senses the same player position for the frame, so two guards
    // can never disagree about where the player was. The noise is the same
    // story: one circle around the player, whose radius is however much racket
    // they are making - which is zero while standing still or sneaking, and so
    // never heard at all.
    const target = this.player.position;
    const noise = { x: target.x, y: target.y, radius: this.player.noiseRadius };

    for (const enemy of this.enemies) {
      enemy.update(dt, target, noise);
    }

    this._updateHud();

    if (this.debugOn) this._drawWaypointDebug();
  }

  /**
   * The backdrop loop for the start page: the same guards, on the same routes,
   * with nobody to find.
   *
   * No noise is passed along with the target, so a patrol behind the start page
   * cannot hear anything either - there is no player on the level yet to make
   * any sound, and every guard should behave as if that is true.
   */
  _patrolBehindTheStartPage(dt) {
    for (const enemy of this.enemies) {
      enemy.update(dt, NOBODY, null);
    }
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

  /**
   * Chips and the door, kept because both change as the run goes on: a taken
   * chip's sprite is put away and the door's sprite brightens once it opens.
   */
  _drawMarkers() {
    this.chipSprites = this.grid.chips.map((chip) =>
      this.add.image(chip.x, chip.y, 'chip').setDepth(2),
    );

    this.exitSprite = this.grid.exit
      ? this.add.image(this.grid.exit.x, this.grid.exit.y, 'exit').setDepth(2)
      : null;
  }

  _clearMarkers() {
    for (const sprite of this.chipSprites) {
      if (sprite) sprite.destroy();
    }

    if (this.exitSprite) this.exitSprite.destroy();

    this.chipSprites = [];
    this.exitSprite = null;
  }

  /**
   * A shut door is a faint outline; an open one is solid, and gives a single
   * pulse when the last chip turns it on.
   */
  _paintExit() {
    if (!this.exitSprite) return;

    const open = this.mission.isUnlocked;
    this.exitSprite.setAlpha(open ? 1 : 0.35);

    if (open) {
      this.tweens.add({
        targets: this.exitSprite,
        scale: 1.3,
        duration: 180,
        yoyo: true,
      });
    }
  }

  // ------------------------------------------------------------------ actors

  /**
   * Guards start spread evenly around the shared waypoint loop, each facing the
   * waypoint it is about to walk to. How many is the level's call; the posts
   * come from `world/Roster.js`, which is the same rule the start page lists its
   * roster from - so the guard count on the start page is the guard count here,
   * by construction rather than by coincidence.
   */
  _spawnGuards() {
    this.enemies = guardPosts(this.grid, { count: this.level.guards }).map(
      (post) =>
        new Enemy(this, {
          name: post.name,
          x: post.x,
          y: post.y,
          heading: post.heading,
          waypoints: this.grid.waypoints,
          startIndex: post.startIndex,
          grid: this.grid,
          // The brain does not know what a hit means; the scene does.
          onHit: () => this._onPlayerHit(),
        }),
    );
  }

  /**
   * A guard's swing connected.
   *
   * The player decides whether it counts (see `Health`), so two guards swinging
   * on the same frame cannot take two points between them.
   */
  _onPlayerHit() {
    if (!this.player.takeHit()) return;

    if (this.player.isDead) this._catchPlayer();
  }

  /**
   * Chips first, then the door.
   *
   * @returns {boolean} whether the run ended on this frame, so the caller can
   *   stop before the guards take a swing at a player who has already won.
   */
  _updateMission() {
    const taken = this.mission.tryCollect(this.player.position);
    if (taken) this._onChipTaken(taken);

    if (!this.mission.reachedExit(this.player.position)) return false;

    this._winMission();
    return true;
  }

  /**
   * A chip left the floor.
   *
   * The sprite pops and fades rather than simply vanishing, so the player can
   * see which one they got instead of inferring it from the HUD.
   */
  _onChipTaken(chip) {
    const index = this.mission.chips.indexOf(chip);
    const sprite = this.chipSprites[index];
    this.chipSprites[index] = null;

    if (sprite) {
      this.tweens.add({
        targets: sprite,
        scale: 1.8,
        alpha: 0,
        duration: 220,
        onComplete: () => sprite.destroy(),
      });
    }

    this._paintExit();
  }

  _winMission() {
    this.player.sprite.setVelocity(0, 0);

    // The clock stops with the run, and the time is what gets remembered: a
    // best time is only ever a time somebody actually finished in.
    this.clock.stop();
    this.stats.recordWin(this.clock.seconds, this.mission.collected);

    this._updateHud();
    this._showStatus(
      `MISSION COMPLETE in ${this.clock.formatted} - press R for another go`,
      '#88ff99',
    );
  }

  /**
   * The full-stop banner.
   *
   * Getting caught and getting away are the same thing on screen - the world
   * holds still and R is the way out - so they share one piece of text rather
   * than two that could both be up at once.
   */
  _showStatus(message, color) {
    if (this.statusText) this.statusText.destroy();

    this.statusText = this.add
      .text(CONFIG.map.widthPx / 2, CONFIG.map.heightPx / 2, message, {
        fontFamily: CONFIG.ui.font,
        fontSize: '18px',
        color,
        backgroundColor: '#000000cc',
        padding: { x: 12, y: 8 },
      })
      .setOrigin(0.5)
      .setDepth(30);
  }

  /**
   * The lose state: the world stops and waits for R.
   *
   * There is no way to walk it off - three hits and the run is over - so this
   * is deliberately the smallest honest thing: a caught player, a message, and
   * the control the README already documents.
   */
  _catchPlayer() {
    this.caught = true;
    this.player.sprite.setVelocity(0, 0);

    // A capture is never a personal best, however quick it was: only escapes
    // set a time, so this is recorded as an ending and nothing more.
    this.clock.stop();
    this.stats.recordCatch(this.clock.seconds, this.mission.collected);

    this._updateHud();
    this._showStatus(`CAUGHT after ${this.clock.formatted} - press R to try again`, '#ff8888');
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
    // A restart is a fresh run, not a continuation: the clock goes back to zero
    // and it counts as another attempt, which is what makes the record on the
    // start page read as a history rather than as a best.
    this.clock.reset().start();
    this.stats.startRun();

    this.player.reset();

    for (const enemy of this.enemies) {
      enemy.reset();
    }

    // The chips come back, which means the sprites do too.
    this.mission.reset();
    this._clearMarkers();
    this._drawMarkers();
    this._paintExit();

    if (this.statusText) {
      this.statusText.destroy();
      this.statusText = null;
    }

    this.caught = false;
    this._updateHud();
  }

  /**
   * Back to the start page, abandoning the run.
   *
   * Nothing is recorded for an abandoned run beyond the attempt that was
   * counted when it began: it is not an escape and it is not a capture, so it
   * does not get to look like either on the record.
   *
   * The level index goes back with it, so leaving a run returns you to the level
   * you were on rather than to the first one.
   */
  _exitToDashboard() {
    this.scene.start('Dashboard', { levelIndex: this.levelIndex });
  }

  /**
   * Four things on one line: how long the run has taken, health, the objective,
   * and how close each guard is to committing.
   *
   * The alertness meter is the one piece of state with no on-screen tell of its
   * own - the guards' labels already carry their state, and a guard's colour
   * carries how dangerous it is - so this is where a meter that is quietly
   * filling can actually be watched. The clock sits on this line rather than in
   * a corner of its own because it is the run's score, and it has to be read at
   * the same glance as the health it is racing.
   */
  _buildHud() {
    this.hud = this.add
      .text(8, 6, '', {
        fontFamily: CONFIG.ui.font,
        fontSize: '12px',
        color: '#c8d4ff',
      })
      .setDepth(24);
  }

  _updateHud() {
    const health = this.player.health;
    const pips = `${'*'.repeat(Math.max(0, health.value))}${'-'.repeat(
      Math.max(0, health.max - health.value),
    )}`;

    const door = this.mission.isUnlocked ? 'OPEN' : 'SHUT';
    const chips = `${this.mission.collected}/${this.mission.total}`;
    const lines = [
      `TIME ${this.clock.formatted}    HEALTH ${pips}    CHIPS ${chips}    EXIT ${door}`,
    ];

    for (const enemy of this.enemies) {
      const brain = enemy.brain;
      const filled = Math.round(brain.alertness.normalised * 10);
      const bar = `${'#'.repeat(filled)}${'.'.repeat(10 - filled)}`;

      lines.push(`${brain.name.padEnd(8)} ${brain.state.padEnd(10)} ${bar}`);
    }

    this.hud.setText(lines.join('\n'));
  }

  /**
   * One text object per waypoint, created once and toggled. Building them in
   * the draw call instead would allocate a new text object every frame.
   */
  _buildWaypointLabels() {
    this.waypointLabels = this.grid.waypoints.map((wp) =>
      this.add
        .text(wp.x + 12, wp.y - 15, String(wp.order), {
          fontFamily: CONFIG.ui.font,
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

    // What the guards can hear: one circle around the player, as wide as the
    // racket they are making this frame. Not drawn at all while the player is
    // still or sneaking, which is the whole answer.
    if (this.player.noiseRadius > 0) {
      const { x, y } = this.player.position;

      g.lineStyle(1, 0xffd166, 0.55);
      g.strokeCircle(x, y, this.player.noiseRadius);
    }
  }
}
