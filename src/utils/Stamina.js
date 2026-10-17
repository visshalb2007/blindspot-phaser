import { CONFIG } from '../config.js';
import { clamp } from '../world/geometry.js';

/**
 * Sprint budget for the player.
 *
 * Kept as a pure class with no Phaser import so the fiddly part - the recovery
 * threshold - can be unit tested without a browser.
 */
export class Stamina {
  constructor(max = CONFIG.player.stamina) {
    this.max = max;
    this.value = max;
    this.exhausted = false;
  }

  /** 0..1, for the HUD bar. */
  get ratio() {
    return this.value / this.max;
  }

  /**
   * @param {number} dt seconds
   * @param {boolean} wantsSprint whether the sprint key is held this frame
   * @param {boolean} moving whether the player actually moved this frame
   * @returns {boolean} whether the player sprints this frame
   */
  update(dt, wantsSprint, moving) {
    const sprinting = wantsSprint && moving && !this.exhausted && this.value > 0;

    if (sprinting) {
      this.value = clamp(this.value - CONFIG.player.drain * dt, 0, this.max);
      if (this.value === 0) this.exhausted = true;
      return true;
    }

    this.value = clamp(this.value + CONFIG.player.regen * dt, 0, this.max);

    // `exhausted` deliberately latches until the bar clears the recovery
    // threshold. Without the latch, a bar sitting at zero would refill by a
    // sliver each frame and immediately drain again, so sprint would flicker
    // on and off many times a second.
    if (this.exhausted && this.value >= CONFIG.player.sprintRecoverAt) {
      this.exhausted = false;
    }

    return false;
  }

  reset() {
    this.value = this.max;
    this.exhausted = false;
  }
}

export default Stamina;
