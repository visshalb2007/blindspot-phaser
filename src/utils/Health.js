import { CONFIG } from '../config.js';

/**
 * Health, with a window of invulnerability after every hit.
 *
 * Modelled on `Stamina`: the rules live in a pure object that a test can step
 * directly, and `src/entities/Player.js` is a thin wrapper that draws them.
 *
 * The window is doing real work rather than being flavour. Two guards can land
 * a blow on the same frame, and a single guard stands on top of a player while
 * it swings, so without it a caught player would lose their whole bar in three
 * frames and never see what happened.
 *
 * Pure JavaScript, no Phaser import.
 */
export class Health {
  constructor({ max = CONFIG.player.health, iFrames = CONFIG.player.iFrames } = {}) {
    this.max = max;
    this.iFrames = iFrames;
    this.value = max;
    this.invulnerable = 0;
  }

  get isDead() {
    return this.value <= 0;
  }

  /** Whether a blow landing right now would be shrugged off. */
  get isHurt() {
    return this.invulnerable > 0;
  }

  /** Health as a 0..1 share, for a bar. */
  get fraction() {
    return this.max === 0 ? 0 : this.value / this.max;
  }

  /**
   * @returns {boolean} whether the blow counted. A blow inside the window, or
   *   after the player is already down, is ignored rather than clamped, so the
   *   caller can tell the difference between a hit and a shrug.
   */
  takeHit() {
    if (this.invulnerable > 0 || this.isDead) return false;

    this.value -= 1;
    this.invulnerable = this.iFrames;
    return true;
  }

  update(dt) {
    if (this.invulnerable > 0) {
      this.invulnerable = Math.max(0, this.invulnerable - dt);
    }
  }

  reset() {
    this.value = this.max;
    this.invulnerable = 0;
  }
}

export default Health;
