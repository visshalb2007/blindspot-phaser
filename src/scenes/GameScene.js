import Phaser from 'phaser';

import { CONFIG } from '../config.js';
import { Grid } from '../world/Grid.js';
import { LEVEL_ROWS } from '../world/LevelData.js';

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
    this._buildTemporaryActor();

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

  /**
   * Placeholder so the level can be walked before the Player entity exists in
   * Phase 2. It is deliberately naive: un-normalised velocity, no sprint, no
   * stamina. `src/entities/Player.js` replaces it.
   */
  _buildTemporaryActor() {
    const { x, y } = this.grid.spawn;
    this.placeholder = this.physics.add.sprite(x, y, 'player').setDepth(10);

    const radius = CONFIG.player.radius;
    this.placeholder.body.setCircle(
      radius,
      this.placeholder.width / 2 - radius,
      this.placeholder.height / 2 - radius,
    );

    this.physics.add.collider(this.placeholder, this.walls);
    this.cursors = this.input.keyboard.createCursorKeys();
  }

  update() {
    const speed = CONFIG.player.speed;
    let vx = 0;
    let vy = 0;

    if (this.cursors.left.isDown) vx -= speed;
    if (this.cursors.right.isDown) vx += speed;
    if (this.cursors.up.isDown) vy -= speed;
    if (this.cursors.down.isDown) vy += speed;

    this.placeholder.setVelocity(vx, vy);
  }
}
