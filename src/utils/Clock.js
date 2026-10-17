/**
 * Formats a duration in seconds as `m:ss.t`.
 *
 * Tenths rather than hundredths for two reasons: a digit that changes sixty
 * times a second cannot be read while walking, and a hundredth is not a unit
 * anybody runs a level to. Shared with the scoreboard, so a best time and the
 * clock it came from can never be formatted two different ways.
 *
 * @param {number} seconds
 * @returns {string}
 */
export function formatDuration(seconds) {
  const safe = Number.isFinite(seconds) && seconds > 0 ? seconds : 0;

  // Work in whole tenths so the rounding is done once, on an integer, and the
  // seconds and minutes are then plain division on that.
  const tenths = Math.floor(safe * 10);
  const minutes = Math.floor(tenths / 600);
  const secs = Math.floor((tenths % 600) / 10);

  return `${minutes}:${String(secs).padStart(2, '0')}.${tenths % 10}`;
}

/**
 * A stopwatch for one run.
 *
 * It counts *up*, which is the point: nothing about a run is on a deadline, so
 * there is no fail state hiding in here, and the number is a score rather than
 * a countdown. The clock is stopped explicitly when a run ends, so the time on
 * the banner is the time the run took and not the time since it started.
 *
 * Pure, and driven by a delta the caller already clamped (`clampDelta`), so a
 * headless test can run a whole stopwatch without an engine.
 */
export class Clock {
  constructor({ running = false } = {}) {
    this.elapsed = 0;
    this.running = running;
  }

  get seconds() {
    return this.elapsed;
  }

  /** The display form, `m:ss.t`. */
  get formatted() {
    return formatDuration(this.elapsed);
  }

  start() {
    this.running = true;
    return this;
  }

  stop() {
    this.running = false;
    return this;
  }

  /** Back to zero. Leaves the clock running if it was: a new run, same watch. */
  reset() {
    this.elapsed = 0;
    return this;
  }

  /**
   * @param {number} dt seconds
   * @returns {number} the elapsed time after the step
   */
  tick(dt) {
    // A stopped clock does not move, and a zero or negative delta must never
    // wind a score backwards.
    if (this.running && Number.isFinite(dt) && dt > 0) this.elapsed += dt;
    return this.elapsed;
  }
}

export default Clock;
