import Phaser from 'phaser';

import { CONFIG } from '../config.js';
import { Grid } from '../world/Grid.js';
import { LEVEL_ROWS } from '../world/LevelData.js';
import { clampDelta } from '../utils/Timer.js';
import { Player } from '../entities/Player.js';

/**
 * Owns everything that is on screen.
 *
 * The scene itself stays thin: it builds the grid, hands it to the entities and
 * draws debug helpers. It never decides *what* an actor should do - that lives
 * in `src/ai`, which the scene only calls into.
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

    this._drawFloor();
    this._buildWalls();
    this._drawMarkers();

    this.player = new Player(this, this.grid.spawn.x, this.grid.spawn.y);
    this.physics.add.collider(this.player.sprite, this.walls);

    this.cameras.main.setBounds(0, 0, CONFIG.map.widthPx, CONFIG.map.heightPx);
  }

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

  update(_time, delta) {
    this.player.update(clampDelta(delta));
  }
}
