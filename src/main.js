import Phaser from 'phaser';
import { CONFIG } from './config.js';

/**
 * Bootstraps the Phaser game.
 *
 * This file deliberately stays tiny. Every system that can be expressed
 * without Phaser lives in `src/ai` or `src/world` and is unit tested in Node,
 * so the engine here is only responsible for input, rendering and the
 * player's Arcade Physics body.
 */
const config = {
  type: Phaser.AUTO,
  parent: 'game',
  width: CONFIG.map.widthPx,
  height: CONFIG.map.heightPx,
  backgroundColor: '#05070c',
  pixelArt: true,
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
  },
  physics: {
    default: 'arcade',
    arcade: {
      gravity: { x: 0, y: 0 },
      debug: false,
    },
  },
  scene: [],
};

const game = new Phaser.Game(config);

export default game;
