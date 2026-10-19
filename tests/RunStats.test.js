import { describe, it, expect } from 'vitest';

import { CONFIG } from '../src/config.js';
import { RunStats, OUTCOME, STATS_VERSION, browserStorage } from '../src/world/RunStats.js';

const KEY = CONFIG.stats.key;

/** A stand-in for `localStorage`: a Map behind the two methods we use. */
function fakeStorage(initial = {}) {
  const map = new Map(Object.entries(initial));

  return {
    map,
    getItem: (key) => (map.has(key) ? map.get(key) : null),
    setItem: (key, value) => map.set(key, String(value)),
  };
}

/** A storage that throws on everything, like a private window with no quota. */
const hostileStorage = {
  getItem() {
    throw new Error('denied');
  },
  setItem() {
    throw new Error('denied');
  },
};

/** The stored blob, as it would look on disk. */
function stored(storage) {
  return JSON.parse(storage.map.get(KEY));
}

describe('RunStats', () => {
  it('has nothing to show before anything is played', () => {
    const stats = new RunStats({ storage: fakeStorage() });

    expect(stats.attempts).toBe(0);
    expect(stats.wins).toBe(0);
    expect(stats.catches).toBe(0);
    expect(stats.chips).toBe(0);
    expect(stats.bestTime).toBeNull();
    expect(stats.lastOutcome).toBeNull();
    expect(stats.hasHistory).toBe(false);
  });

  it('counts a run as soon as it begins, and writes it down', () => {
    const storage = fakeStorage();

    new RunStats({ storage }).startRun();

    // Written at the start rather than at the end, so a run abandoned by
    // closing the tab is still a run that was begun.
    expect(stored(storage).attempts).toBe(1);
  });

  it('counts an escape and sets the first best time', () => {
    const stats = new RunStats({ storage: fakeStorage() });

    stats.startRun().recordWin(83.44, 2);

    expect(stats.wins).toBe(1);
    expect(stats.bestTime).toBeCloseTo(83.44, 6);
    expect(stats.lastOutcome).toBe(OUTCOME.ESCAPED);
    expect(stats.lastTime).toBeCloseTo(83.44, 6);
    expect(stats.lastChips).toBe(2);
  });

  it('only lets a faster escape take the record', () => {
    const stats = new RunStats({ storage: fakeStorage() });

    stats.recordWin(90, 2);
    stats.recordWin(120, 2);
    expect(stats.bestTime).toBe(90);

    stats.recordWin(61.5, 2);
    expect(stats.bestTime).toBeCloseTo(61.5, 6);
  });

  it('never counts being caught as a personal best, however quick', () => {
    const stats = new RunStats({ storage: fakeStorage() });

    stats.recordCatch(4, 0);

    expect(stats.catches).toBe(1);
    expect(stats.bestTime).toBeNull();
    expect(stats.lastOutcome).toBe(OUTCOME.CAUGHT);
  });

  it('keeps a best time through a later capture', () => {
    const stats = new RunStats({ storage: fakeStorage() });

    stats.recordWin(70, 2).recordCatch(3, 1);

    expect(stats.bestTime).toBe(70);
    expect(stats.lastOutcome).toBe(OUTCOME.CAUGHT);
  });

  it('adds up the chips lifted, however the run ended', () => {
    const stats = new RunStats({ storage: fakeStorage() });

    stats.recordCatch(20, 1).recordWin(60, 2).recordCatch(9, 0);

    expect(stats.chips).toBe(3);
  });

  it('reports the escape rate, and zero before anything is played', () => {
    const stats = new RunStats({ storage: fakeStorage() });
    expect(stats.winRate).toBe(0);

    stats.startRun().recordWin(30, 2);
    stats.startRun().recordCatch(10, 1);
    stats.startRun().recordCatch(12, 1);

    expect(stats.winRate).toBeCloseTo(1 / 3, 6);
  });

  it('reads its own record back off the disk', () => {
    const storage = fakeStorage();

    new RunStats({ storage }).startRun().recordWin(42.5, 2);

    const again = new RunStats({ storage });

    expect(again.attempts).toBe(1);
    expect(again.wins).toBe(1);
    expect(again.chips).toBe(2);
    expect(again.bestTime).toBeCloseTo(42.5, 6);
    expect(again.lastOutcome).toBe(OUTCOME.ESCAPED);
    expect(again.lastChips).toBe(2);
  });

  it('writes the version it understands', () => {
    const storage = fakeStorage();

    new RunStats({ storage }).save();

    expect(stored(storage).version).toBe(STATS_VERSION);
  });

  it.each([
    ['nothing at all', undefined],
    ['an empty string', ''],
    ['not JSON', '{oops'],
    ['JSON that is not an object', '"nope"'],
    ['null', 'null'],
    ['an array', '[1, 2, 3]'],
    ['a record from a future build', '{"version":99,"attempts":5}'],
    ['a record with no version', '{"attempts":5,"wins":5}'],
  ])('starts over rather than throwing on %s', (_label, raw) => {
    const storage = raw === undefined ? fakeStorage() : fakeStorage({ [KEY]: raw });

    const stats = new RunStats({ storage });

    expect(stats.attempts).toBe(0);
    expect(stats.bestTime).toBeNull();
  });

  it('cannot be talked into a win rate above 100%', () => {
    const storage = fakeStorage({
      [KEY]: JSON.stringify({ version: STATS_VERSION, attempts: 2, wins: 9, catches: 7 }),
    });

    const stats = new RunStats({ storage });

    expect(stats.wins).toBe(2);
    expect(stats.catches).toBe(2);
    expect(stats.winRate).toBe(1);
  });

  it('turns junk numbers into nothing rather than into NaN', () => {
    const storage = fakeStorage({
      [KEY]: JSON.stringify({
        version: STATS_VERSION,
        attempts: 'four',
        wins: -3,
        catches: null,
        chips: NaN,
        bestTime: -1,
        lastOutcome: 'exploded',
        lastTime: 'ages',
        lastChips: {},
      }),
    });

    const stats = new RunStats({ storage });

    expect(stats.attempts).toBe(0);
    expect(stats.wins).toBe(0);
    expect(stats.catches).toBe(0);
    expect(stats.chips).toBe(0);
    expect(stats.bestTime).toBeNull();
    expect(stats.lastOutcome).toBeNull();
    expect(stats.lastTime).toBeNull();
    expect(stats.lastChips).toBe(0);
    expect(Number.isNaN(stats.chips)).toBe(false);
  });

  it('works with no storage at all', () => {
    const stats = new RunStats({ storage: null });

    stats.startRun().recordWin(10, 2);

    expect(stats.save()).toBe(false);
    expect(stats.wins).toBe(1);
    expect(stats.bestTime).toBe(10);
  });

  it('keeps the run in memory when storage refuses to write', () => {
    const stats = new RunStats({ storage: hostileStorage });

    expect(() => stats.startRun().recordWin(20, 2)).not.toThrow();
    expect(stats.wins).toBe(1);
    expect(stats.bestTime).toBe(20);
  });

  it('reads nothing out of storage that refuses to be read', () => {
    const stats = new RunStats({ storage: hostileStorage });

    expect(stats.attempts).toBe(0);
  });

  it('wipes the record, memory and disk', () => {
    const storage = fakeStorage();
    const stats = new RunStats({ storage });

    stats.startRun().recordWin(30, 2);
    stats.clear();

    expect(stats.hasHistory).toBe(false);
    expect(new RunStats({ storage }).hasHistory).toBe(false);
  });

  it('re-reads the disk on demand', () => {
    const storage = fakeStorage();
    const stats = new RunStats({ storage });
    expect(stats.attempts).toBe(0);

    new RunStats({ storage }).startRun();
    stats.load();

    expect(stats.attempts).toBe(1);
  });
});

describe('RunStats - per-level bests', () => {
  it('starts with every rung unclimbed', () => {
    const stats = new RunStats({ storage: null });

    expect(stats.bestTimeFor(0)).toBeNull();
    expect(stats.bestTimeFor(9)).toBeNull();
    expect(stats.levelsCleared).toBe(0);
  });

  it('keeps a best per level, separately from the global one', () => {
    const stats = new RunStats({ storage: null });

    stats.recordWin(50, 4, 0);
    stats.recordWin(30, 4, 2);

    expect(stats.bestTimeFor(0)).toBe(50);
    expect(stats.bestTimeFor(2)).toBe(30);
    expect(stats.bestTimeFor(1)).toBeNull();
    // The global best is the fastest anywhere - and the two books stay in
    // their own ledgers.
    expect(stats.bestTime).toBe(30);
    expect(stats.levelsCleared).toBe(2);
  });

  it('only lets a faster escape take a level, like the global book', () => {
    const stats = new RunStats({ storage: null });

    stats.recordWin(60, 2, 3);
    stats.recordWin(90, 2, 3);
    stats.recordWin(45, 2, 3);

    expect(stats.bestTimeFor(3)).toBe(45);
  });

  it('never counts a capture as a level cleared, however quick', () => {
    const stats = new RunStats({ storage: null });

    stats.recordCatch(4, 0, 1);

    expect(stats.bestTimeFor(1)).toBeNull();
    expect(stats.levelsCleared).toBe(0);
  });

  it('round-trips the per-level book through storage', () => {
    const storage = fakeStorage();
    new RunStats({ storage }).recordWin(41.5, 3, 6).recordWin(12.5, 1, 0);

    const again = new RunStats({ storage });

    expect(again.bestTimeFor(6)).toBeCloseTo(41.5, 6);
    expect(again.bestTimeFor(0)).toBeCloseTo(12.5, 6);
    expect(again.levelsCleared).toBe(2);
  });

  it('treats stored per-level book as hostile, like everything else on disk', () => {
    const storage = fakeStorage({
      [KEY]: JSON.stringify({
        version: STATS_VERSION,
        attempts: 1,
        wins: 1,
        bestByLevel: {
          0: 12.5, // fine
          3: 'a lie', // not a number
          7: -5, // not a duration
          cat: 9, // not a level index
          123456: 3, // hmm - a number, and a valid index: kept, whoever hears of level 123456 next clamps it back into the shipped ladder
        },
      }),
    });

    const stats = new RunStats({ storage });

    expect(stats.bestTimeFor(0)).toBeCloseTo(12.5, 6);
    expect(stats.bestTimeFor(3)).toBeNull();
    expect(stats.levelsCleared).toBe(2);
  });

  it('tracks ghost and clean escapes and remembers them per level', () => {
    const storage = fakeStorage();
    const stats = new RunStats({ storage });

    stats.startRun().recordWin(45.2, 3, 0, { ghost: true, clean: true });
    stats.startRun().recordWin(60.1, 4, 1, { ghost: false, clean: true });

    expect(stats.ghosts).toBe(1);
    expect(stats.cleans).toBe(2);
    expect(stats.isGhostFor(0)).toBe(true);
    expect(stats.isGhostFor(1)).toBe(false);

    // Survives reload from disk
    const reloaded = new RunStats({ storage });
    expect(reloaded.ghosts).toBe(1);
    expect(reloaded.cleans).toBe(2);
    expect(reloaded.isGhostFor(0)).toBe(true);
    expect(reloaded.isGhostFor(1)).toBe(false);
  });
});

describe('browserStorage', () => {
  it('hands back the real thing when there is one', () => {
    const fake = { localStorage: { getItem: () => null } };

    expect(browserStorage(fake)).toBe(fake.localStorage);
  });

  it('hands back nothing when there is no storage', () => {
    expect(browserStorage({})).toBeNull();
    expect(browserStorage(null)).toBeNull();
    expect(browserStorage(undefined)).toBeNull();
  });

  it('hands back nothing when even looking throws', () => {
    const trap = {
      get localStorage() {
        throw new Error('blocked');
      },
    };

    expect(browserStorage(trap)).toBeNull();
  });
});
