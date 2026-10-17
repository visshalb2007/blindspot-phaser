import { CONFIG } from '../config.js';

/** The stored shape. The key carries the version too, so a bump starts over. */
export const STATS_VERSION = 1;

/** How a run ended. Only two ways out of the level, and both are quiet. */
export const OUTCOME = Object.freeze({
  ESCAPED: 'escaped',
  CAUGHT: 'caught',
});

/**
 * The browser's storage, or null where there is none. Never throws.
 *
 * Touching `localStorage` can itself throw - a sandboxed iframe, storage
 * switched off, a privacy mode - so even the lookup is guarded, and everything
 * that follows tolerates a null here.
 *
 * @param {object} scope where to look, so a test can hand it a fake window
 */
export function browserStorage(scope = globalThis) {
  try {
    return scope?.localStorage ?? null;
  } catch {
    return null;
  }
}

/** A stored number, or zero if it is missing, negative, a string or a NaN. */
function count(value) {
  return Number.isFinite(value) && value > 0 ? Math.floor(value) : 0;
}

/** A stored duration, or null. Never zero: no run takes no time. */
function timeOrNull(value) {
  return Number.isFinite(value) && value > 0 ? value : null;
}

/**
 * What the game remembers between runs.
 *
 * Deliberately a plain record with an *injected* storage port rather than
 * something that reaches for `localStorage` itself: a test hands it a Map, the
 * scenes hand it the real thing, and a browser with storage turned off gets the
 * same object with nothing behind it and no special casing at the call site.
 *
 * Every load is treated as hostile. The value came off a disk, possibly written
 * by an older build, possibly hand-edited, so anything unrecognised falls back
 * to a fresh record instead of throwing on the title screen. A corrupt
 * scoreboard must never be the reason the game will not start.
 */
export class RunStats {
  constructor({ storage = null, key = CONFIG.stats.key } = {}) {
    this.storage = storage;
    this.key = key;

    // Loaded on construction rather than on request: an instance always
    // reflects what is on disk, so a caller cannot read a blank record and then
    // save over a real one by forgetting a step.
    this.load();
  }

  /** Back to nothing played. Does not touch storage: see `clear()`. */
  reset() {
    this.attempts = 0;
    this.wins = 0;
    this.catches = 0;
    this.chips = 0;
    this.bestTime = null;
    this.lastOutcome = null;
    this.lastTime = null;
    this.lastChips = 0;
    return this;
  }

  /** Escapes as a share of runs begun, 0..1. */
  get winRate() {
    return this.attempts > 0 ? this.wins / this.attempts : 0;
  }

  get hasHistory() {
    return this.attempts > 0;
  }

  /** A run just started. Counted here rather than at the end, so a run that is
   *  abandoned by closing the tab is still a run you began. */
  startRun() {
    this.attempts += 1;
    this.save();
    return this;
  }

  /**
   * The player got out with the loot.
   *
   * @param {number} seconds how long the run took
   * @param {number} chips how many were lifted on the way
   */
  recordWin(seconds, chips = 0) {
    const time = timeOrNull(seconds);

    this.wins += 1;
    this.chips += count(chips);
    this._remember(OUTCOME.ESCAPED, time, chips);

    // Only ever on a win, and only ever faster: a quick capture is not a
    // record, and a slow escape still is one the first time.
    if (time !== null && (this.bestTime === null || time < this.bestTime)) {
      this.bestTime = time;
    }

    this.save();
    return this;
  }

  /** The guards got the player. Never a personal best, whatever the clock said. */
  recordCatch(seconds, chips = 0) {
    this.catches += 1;
    this.chips += count(chips);
    this._remember(OUTCOME.CAUGHT, timeOrNull(seconds), chips);

    this.save();
    return this;
  }

  _remember(outcome, time, chips) {
    this.lastOutcome = outcome;
    this.lastTime = time;
    this.lastChips = count(chips);
  }

  /** The shape that gets written to storage, and the only thing read back. */
  toJSON() {
    return {
      version: STATS_VERSION,
      attempts: this.attempts,
      wins: this.wins,
      catches: this.catches,
      chips: this.chips,
      bestTime: this.bestTime,
      lastOutcome: this.lastOutcome,
      lastTime: this.lastTime,
      lastChips: this.lastChips,
    };
  }

  /**
   * Reads the record back, discarding anything it does not recognise. Called on
   * construction, and again by anything that wants to re-read the disk.
   *
   * @returns {this} so a caller can write `new RunStats({ storage }).load()`
   */
  load() {
    this.reset();

    const data = this._read();
    if (!data) return this;

    this.attempts = count(data.attempts);

    // Clamped against attempts rather than trusted: a record claiming more
    // escapes than runs would otherwise show a win rate above 100%.
    this.wins = Math.min(count(data.wins), this.attempts);
    this.catches = Math.min(count(data.catches), this.attempts);

    this.chips = count(data.chips);
    this.bestTime = timeOrNull(data.bestTime);
    this.lastOutcome =
      data.lastOutcome === OUTCOME.ESCAPED || data.lastOutcome === OUTCOME.CAUGHT
        ? data.lastOutcome
        : null;
    this.lastTime = timeOrNull(data.lastTime);
    this.lastChips = count(data.lastChips);

    return this;
  }

  /** @returns {object|null} the stored object, or null if there is not a usable one. */
  _read() {
    if (!this.storage) return null;

    let raw;
    try {
      raw = this.storage.getItem(this.key);
    } catch {
      return null;
    }

    if (typeof raw !== 'string' || raw === '') return null;

    let data;
    try {
      data = JSON.parse(raw);
    } catch {
      return null;
    }

    if (!data || typeof data !== 'object' || data.version !== STATS_VERSION) return null;

    return data;
  }

  /**
   * Writes the record.
   *
   * @returns {boolean} whether it landed. A full disk or a storage-blocked
   *   browser gets `false` and keeps its record for this session in memory
   *   only - losing a scoreboard is not a reason to interrupt a run.
   */
  save() {
    if (!this.storage) return false;

    try {
      this.storage.setItem(this.key, JSON.stringify(this));
      return true;
    } catch {
      return false;
    }
  }

  /** Wipes the record, in memory and on disk. */
  clear() {
    this.reset();
    this.save();
    return this;
  }
}

export default RunStats;
