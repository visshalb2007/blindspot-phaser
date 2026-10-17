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

    this.cameras.main.setBounds(0, 0, CONFIG.map.widthPx, CONFIG.map.heightPx);
  }
}
