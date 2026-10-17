import { CONFIG } from '../config.js';
import { clamp } from '../world/geometry.js';

/**
 * Converts Phaser's millisecond delta into clamped seconds.
 *
 * Phaser reports the real wall-clock time between frames. After an alt-tab, a
 * breakpoint or a garbage collection pause that number can be thousands of
 * milliseconds. Feeding that straight into movement would teleport actors
 * through walls and fire every timer at once, so it is clamped here, at the
 * single point where engine time enters the simulation.
 */
export function clampDelta(deltaMs, maxMs = CONFIG.maxDelta) {
  return Math.min(deltaMs, maxMs) / 1000;
}

/**
 * A countdown timer driven by accumulated delta rather than by Phaser's clock.
 *
 * Own timers mean the AI can be stepped in a headless test at any rate - and
 * that a pause cannot fire a queue of overdue callbacks.
 */
export class Timer {
  constructor(duration = 0) {
    this.duration = duration;
    this.elapsed = 0;
  }

  get remaining() {
    return Math.max(0, this.duration - this.elapsed);
  }

  /** 0..1, for UI bars. A zero-length timer counts as complete. */
  get progress() {
    if (this.duration <= 0) return 1;
    return clamp(this.elapsed / this.duration, 0, 1);
  }

  get done() {
    return this.elapsed >= this.duration;
  }

  /** Reloads the timer with a new (or the same) duration and restarts it. */
  start(duration = this.duration) {
    this.duration = duration;
    this.elapsed = 0;
    return this;
  }

  reset() {
    this.elapsed = 0;
    return this;
  }

  /**
   * Advances the timer.
   *
   * @returns {boolean} true on the single frame the timer completes, so a
   * `if (timer.tick(dt)) ...` block runs exactly once per start().
   */
  tick(dt) {
    if (this.done) return false;
    this.elapsed += dt;
    return this.done;
  }
}

export default Timer;
