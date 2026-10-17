import { CONFIG } from '../config.js';
import { LEVEL_ROWS } from './LevelData.js';

/**
 * The five levels, in the order they get harder.
 *
 * Level 1 is `LevelData.js` untouched, and that is deliberate: it is the map the
 * whole project was built and tuned against, so it stays exactly as it is and
 * every earlier suite keeps testing the same level it always did.
 *
 * Difficulty here is geometry, not rubber-band numbers. There is no "hard mode"
 * multiplier hiding in the AI: the later levels are harder because they are more
 * open (long sightlines, nowhere to break a guard's view), bigger (more ground
 * to cover between chips, more time in the open), tighter (one-wide aisles you
 * cannot dodge in), and busier (more guards walking a longer loop). Per-level
 * sight ranges and reaction speeds would mean threading a config through every
 * AI module, which is a much larger change than the ladder needs - the map is
 * already the strongest difficulty knob a stealth game has.
 *
 * `guards` is how many are posted; `Guard` posts are spread evenly around the
 * level's own waypoint loop by `world/Roster.js`, so a level can never ask for
 * more guards than it has posts.
 */
export const LEVELS = Object.freeze([
  {
    id: 'night-shift',
    name: 'Night Shift',
    difficulty: 1,
    guards: 2,
    blurb: 'small rooms, short sightlines',
    rows: LEVEL_ROWS,
  },
  {
    id: 'loading-bay',
    name: 'Loading Bay',
    difficulty: 2,
    guards: 3,
    blurb: 'an open hall, long sightlines',
    rows: [
      '#########################',
      '#P......................#',
      '#.......................#',
      '#...##....##....##..##..#',
      '#...##....##....##..##..#',
      '#.......................#',
      '#.3.........4.........5.#',
      '#.......................#',
      '#......##....##....##...#',
      '#......##....##....##...#',
      '#.......................#',
      '#..............C........#',
      '#...#######..########...#',
      '#......#.......#........#',
      '#.0....#.2.....#.1......#',
      '#......#...C...#........#',
      '#C.....#...#...#.......E#',
      '#########################',
    ],
  },
  {
    id: 'cold-storage',
    name: 'Cold Storage',
    difficulty: 3,
    guards: 3,
    blurb: 'six straight aisles, no cover',
    rows: [
      '#########################',
      '#P.........1............#',
      '#...#...#...#...#...#...#',
      '#...#...#...#...#...#...#',
      '#.C.#...#...#...#...#...#',
      '#...#...#...#...#...#...#',
      '#...#...#...#...#...#...#',
      '#...#...#...#...#...#...#',
      '#.0...................2.#',
      '#...#...#...#...#...#...#',
      '#...#...#...#...#...#...#',
      '#...#...#.C.#...#...#...#',
      '#...#...#...#...#...#...#',
      '#...#...#...#...#...#...#',
      '#...#...#...#...#...#.C.#',
      '#...#...#...#...#...#...#',
      '#....4.....3...........E#',
      '#########################',
    ],
  },
  {
    id: 'server-floor',
    name: 'Server Floor',
    difficulty: 4,
    guards: 4,
    blurb: 'long lanes, little cover',
    rows: [
      '#########################',
      '#P....................C.#',
      '#.......................#',
      '#.....##........##......#',
      '#...........0...........#',
      '#.......................#',
      '#..########...########..#',
      '#.1.....................#',
      '#.......................#',
      '#.........##..........C.#',
      '#C..........2...........#',
      '#####..##########..######',
      '#...C.......3...........#',
      '#.......................#',
      '#.4..................5..#',
      '#.......................#',
      '#...........E...........#',
      '#########################',
    ],
  },
  {
    id: 'the-vault',
    name: 'The Vault',
    difficulty: 5,
    guards: 5,
    blurb: 'wide open, five guards',
    rows: [
      '#########################',
      '#P.....................C#',
      '#..........1............#',
      '#.......................#',
      '#.0..................2..#',
      '#.......................#',
      '#...##............##....#',
      '#...##............##....#',
      '#...........C...........#',
      '#7.....................3#',
      '#.......................#',
      '#.........##..##........#',
      '#.........##..##........#',
      '#.6..................4..#',
      '#.......................#',
      '#..........5............#',
      '#C..........E..........C#',
      '#########################',
    ],
  },
]);

export const LEVEL_COUNT = LEVELS.length;

/** The one a fresh player gets: level 1, the map this project was built on. */
export const DEFAULT_LEVEL = 0;

/**
 * The level at an index, clamped rather than trusted.
 *
 * @param {number} [index]
 * @returns {(typeof LEVELS)[number]}
 */
export function levelAt(index = DEFAULT_LEVEL) {
  if (!Number.isFinite(index)) return LEVELS[DEFAULT_LEVEL];

  return LEVELS[Math.min(Math.max(Math.trunc(index), 0), LEVELS.length - 1)];
}

/**
 * The config a level runs on: the game's own, with this level's guard count.
 *
 * The one rule for how many guards a level posts, so the scene that spawns them
 * and the start page that lists them agree by construction. Deliberately a copy
 * rather than a mutation: `CONFIG` is a module singleton, and a level must not
 * be able to leave its guard count behind for the next one.
 *
 * @param {(typeof LEVELS)[number]} level
 * @param {object} [config]
 */
export function configFor(level, config = CONFIG) {
  return { ...config, enemy: { ...config.enemy, count: level.guards } };
}
