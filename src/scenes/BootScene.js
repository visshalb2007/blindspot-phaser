import Phaser from 'phaser';

import { CONFIG } from '../config.js';

const T = CONFIG.tile;

/**
 * Draws every texture the game needs into memory, then hands over to GameScene.
 *
 * The project ships no image files: `Graphics.generateTexture` gives us sprites
 * with zero network requests, nothing to license, and no chance of a texture
 * key and a file path drifting apart.
 *
 * Actor textures are drawn in pure white because Phaser tints multiply. A white
 * base means `setTint(colour)` produces exactly that colour, which is how the
 * guard's state is communicated (see `CONFIG.colors`).
 */
export default class BootScene extends Phaser.Scene {
  constructor() {
    super('Boot');
  }

  create() {
    this._generateTextures();

    // Textures are the boot scene's whole job; the start page is next, and it
    // is the one that offers the game itself.
    this.scene.start('Dashboard');
  }

  _generateTextures() {
    const g = this.make.graphics({ x: 0, y: 0, add: false });

    this._floor(g);
    this._wall(g);
    this._actor(g, 'player', CONFIG.player.radius);
    this._actor(g, 'enemy', CONFIG.enemy.radius);
    this._chip(g);
    this._exit(g);
    this._decoy(g);

    g.destroy();
  }

  _floor(g) {
    g.clear();
    g.fillStyle(CONFIG.colors.floor, 1);
    g.fillRect(0, 0, T, T);

    // A faint grid seam keeps movement legible on a dark floor.
    g.fillStyle(0x1a2337, 1);
    g.fillRect(0, 0, T, 1);
    g.fillRect(0, 0, 1, T);

    g.generateTexture('floor', T, T);
  }

  _wall(g) {
    g.clear();
    g.fillStyle(CONFIG.colors.wall, 1);
    g.fillRect(0, 0, T, T);

    // Lit top edge, shadowed bottom edge: enough to read as a solid block
    // without a tileset.
    g.fillStyle(0x43527a, 1);
    g.fillRect(0, 0, T, 3);
    g.fillStyle(0x171d2f, 1);
    g.fillRect(0, T - 3, T, 3);

    g.generateTexture('wall', T, T);
  }

  /**
   * A disc with a forward-pointing visor. Guards are rotated to face their
   * heading, so the visor doubles as a facing indicator that lines up with the
   * vision cone drawn over it.
   */
  _actor(g, key, radius) {
    g.clear();
    g.fillStyle(0xffffff, 1);
    g.fillCircle(T / 2, T / 2, radius);

    g.lineStyle(2, 0x000000, 0.3);
    g.strokeCircle(T / 2, T / 2, radius - 1);

    g.fillStyle(0xffffff, 1);
    g.fillTriangle(T / 2 + 2, T / 2 - 4, T / 2 + 2, T / 2 + 4, T / 2 + radius + 3, T / 2);

    g.generateTexture(key, T, T);
  }

  _chip(g) {
    const c = T / 2;

    g.clear();
    g.fillStyle(CONFIG.colors.chip, 1);
    g.fillTriangle(c, c - 9, c + 9, c, c, c + 9);
    g.fillTriangle(c, c - 9, c, c + 9, c - 9, c);

    g.fillStyle(0xfff3d0, 1);
    g.fillRect(c - 2, c - 5, 4, 10);

    g.generateTexture('chip', T, T);
  }

  _exit(g) {
    g.clear();
    g.fillStyle(CONFIG.colors.exit, 0.22);
    g.fillRect(3, 3, T - 6, T - 6);

    g.lineStyle(3, CONFIG.colors.exit, 1);
    g.strokeRect(4, 4, T - 8, T - 8);

    g.generateTexture('exit', T, T);
  }

  _decoy(g) {
    const c = T / 2;

    g.clear();
    // Radio chassis
    g.fillStyle(0x283850, 1);
    g.fillRect(c - 8, c - 6, 16, 12);
    g.lineStyle(1, 0x66ccff, 0.9);
    g.strokeRect(c - 8, c - 6, 16, 12);

    // Antenna
    g.lineStyle(1, 0x90a8cc, 1);
    g.lineBetween(c - 5, c - 6, c - 5, c - 11);
    g.fillStyle(0x66ccff, 1);
    g.fillCircle(c - 5, c - 11, 1.5);

    // Speaker slits
    g.fillStyle(0x101a2e, 1);
    g.fillRect(c - 3, c - 3, 8, 2);
    g.fillRect(c - 3, c + 1, 8, 2);

    g.generateTexture('decoy', T, T);
  }
}
