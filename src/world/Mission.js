import { CONFIG } from '../config.js';
import { distance } from './geometry.js';

/**
 * The job the level is set up for: take every chip, then get to the exit.
 *
 * This is the whole of the win condition, and it is pure JavaScript with no
 * Phaser import: the scene draws what it decides and hands it the player's
 * position once a frame. Nothing in here knows about sprites, and a test can
 * walk a virtual player around the level without a renderer.
 *
 * A level with no chips at all is a straight run for the door, which is a
 * defensible reading of "take everything you came for".
 */
export class Mission {
  constructor({
    chips = [],
    exit = null,
    pickupRadius = CONFIG.mission.pickupRadius,
    exitRadius = CONFIG.mission.exitRadius,
  } = {}) {
    this.chips = chips.map((chip) => ({ x: chip.x, y: chip.y, collected: false }));
    this.exit = exit ? { x: exit.x, y: exit.y } : null;
    this.pickupRadius = pickupRadius;
    this.exitRadius = exitRadius;

    /** Latches once the player walks out with everything. */
    this.won = false;
  }

  get total() {
    return this.chips.length;
  }

  get collected() {
    return this.chips.filter((chip) => chip.collected).length;
  }

  get remaining() {
    return this.total - this.collected;
  }

  /** Everything is in hand, so the exit is worth walking to. */
  get isUnlocked() {
    return this.remaining === 0;
  }

  /**
   * Takes the nearest chip within reach of `point`.
   *
   * @returns the chip that was taken, or null. Handing the chip back lets the
   *   caller put away the right sprite: the mission decides *what* happened,
   *   the scene decides what that looks like.
   */
  tryCollect(point) {
    let taken = null;
    let closest = this.pickupRadius;

    for (const chip of this.chips) {
      if (chip.collected) continue;

      const reach = distance(point.x, point.y, chip.x, chip.y);
      if (reach <= closest) {
        taken = chip;
        closest = reach;
      }
    }

    if (taken) taken.collected = true;
    return taken;
  }

  /** Whether the player is standing in the doorway. */
  isAtExit(point) {
    if (!this.exit) return false;

    return distance(point.x, point.y, this.exit.x, this.exit.y) <= this.exitRadius;
  }

  /**
   * @returns {boolean} whether this is the frame the run was won. Walking into
   *   the exit while it is still locked does nothing at all - it does not
   *   quietly bank a win for later.
   */
  reachedExit(point) {
    if (this.won || !this.isUnlocked || !this.isAtExit(point)) return false;

    this.won = true;
    return true;
  }

  reset() {
    for (const chip of this.chips) {
      chip.collected = false;
    }

    this.won = false;
  }
}

export default Mission;
