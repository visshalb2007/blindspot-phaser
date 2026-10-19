import { CONFIG } from '../config.js';
import { clamp } from '../world/geometry.js';

/** The meter is a share of certainty, so it runs 0 to 100 rather than 0 to 1. */
const CEILING = 100;

/**
 * How sure a guard is that something is there.
 *
 * This is the difference between noticing and knowing, and it is why a guard no
 * longer snaps straight from patrolling to chasing. Seeing the player fills the
 * meter; losing sight drains it. The first threshold makes a guard suspicious
 * enough to stop and stare, the second makes it commit to a chase.
 *
 * The asymmetry is the point. At the shipped rates the meter fills to
 * "suspicious" in 0.5s and to "certain" in 1.7s, but takes 2.8s to fall back
 * below "suspicious" once the player is gone. A guard therefore remembers what
 * it just saw for longer than it took to see it, which is what stops the old
 * chase/return strobing at the state machine's 0.4s floor: the player has to be
 * genuinely gone for a while before the guard gives up.
 *
 * Pure JavaScript, no Phaser import.
 */
export class Alertness {
  constructor({
    gain = CONFIG.enemy.suspicionGain,
    decay = CONFIG.enemy.suspicionDecay,
    suspiciousAt = CONFIG.enemy.suspiciousAt,
    chaseAt = CONFIG.enemy.chaseAt,
  } = {}) {
    this.gain = gain;
    this.decay = decay;
    this.suspiciousAt = suspiciousAt;
    this.chaseAt = chaseAt;

    this.value = 0;
  }

  /** 0..1, for a UI bar. */
  get normalised() {
    return this.value / CEILING;
  }

  /** Enough doubt to stop and look. */
  get isSuspicious() {
    return this.value >= this.suspiciousAt;
  }

  /** Enough certainty to give chase. */
  get isAlarmed() {
    return this.value >= this.chaseAt;
  }

  /**
   * @param {number} dt seconds
   * @param {boolean} visible whether the guard can see the player this frame
   * @param {number} heard the rate the player is being heard at, in certainty
   *   per second, or 0 for silence
   * @returns {number} the meter after the step
   */
  update(dt, visible, heard = 0) {
    // A sighting outweighs any amount of noise and the two do not stack: being
    // seen is being seen. A noise worth hearing holds the drain off while it
    // lasts, which is the whole of what sound does to a guard's certainty.
    let rate = -this.decay;
    if (visible) {
      rate = this.gain;
    } else if (heard > 0) {
      rate = heard;
    }

    this.value = clamp(this.value + rate * dt, 0, CEILING);
    return this.value;
  }

  /**
   * Jumps straight to certain. For a guard that has been handed a reason to
   * hunt rather than having to work one out - a shout from another guard, or a
   * noise later on.
   */
  alarm() {
    this.value = CEILING;
  }

  /**
   * Lifts the meter to at least `value` - never down, never above the ceiling.
   * The alarm relay uses it to move every guard on the floor past the
   * suspicion threshold without pretending any of them saw anything: what a
   * radio call buys is a reason to come and look, never a chase.
   *
   * @param {number} value the level the meter should not sit below
   * @returns {number} the meter after the raise
   */
  raiseTo(value) {
    this.value = clamp(Math.max(this.value, value), 0, CEILING);
    return this.value;
  }

  reset() {
    this.value = 0;
  }
}

export default Alertness;
