import { CONFIG } from '../config.js';
import { angleDifference, degToRad, distance } from '../world/geometry.js';

/**
 * Decides whether a guard can see a target.
 *
 * Three independent tests, all of which must pass:
 *   1. range   - is the target close enough?
 *   2. cone    - is the target inside the guard's field of view?
 *   3. line    - is there a wall in the way? (injected, see below)
 *
 * The line-of-sight test is injected rather than imported so this module stays
 * free of the grid. Phase 5 hands it `LineOfSight.canSee`; a test can hand it
 * `() => false` to isolate the range and cone maths.
 *
 * Pure JavaScript, no Phaser import.
 */
export class Perception {
  constructor({
    range = CONFIG.enemy.sightRange,
    loseRange = CONFIG.enemy.loseRange,
    fov = CONFIG.enemy.fov,
    canSee = null,
  } = {}) {
    this.range = range;
    this.loseRange = loseRange;
    this.halfFov = degToRad(fov) / 2;
    this.canSee = canSee;

    /** Remembers last frame's verdict - this is what makes the hysteresis work. */
    this.wasVisible = false;
    this.lastSight = null;
  }

  /**
   * @param {{x: number, y: number}} self the guard
   * @param {number} facing the guard's heading in radians
   * @param {{x: number, y: number}} target
   * @returns {{seen: boolean, distance: number, angleOffset: number, inRange: boolean, inCone: boolean, clearLine: boolean, limit: number}}
   */
  sense(self, facing, target) {
    const dist = distance(self.x, self.y, target.x, target.y);

    // Hysteresis. A guard who has already spotted you keeps the wider "lose"
    // radius, so a player hovering exactly on the sight boundary cannot
    // strobe detection on and off frame by frame.
    const limit = this.wasVisible ? this.loseRange : this.range;
    const inRange = dist <= limit;

    const bearing = Math.atan2(target.y - self.y, target.x - self.x);
    const angleOffset = angleDifference(bearing, facing);
    const inCone = Math.abs(angleOffset) <= this.halfFov;

    const clearLine = this.canSee ? this.canSee(self, target) : true;

    const seen = inRange && inCone && clearLine;
    this.wasVisible = seen;

    this.lastSight = {
      seen,
      distance: dist,
      angleOffset,
      inRange,
      inCone,
      clearLine,
      limit,
    };

    return this.lastSight;
  }

  reset() {
    this.wasVisible = false;
    this.lastSight = null;
  }
}

export default Perception;
