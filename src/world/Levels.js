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
 *
 * Levels six and up carry more than geometry. Three optional fields turn the
 * same AI up:
 *
 *   `tuning`  - fields merged over `CONFIG.enemy` by `configFor()` below, so
 *               every module and every start-page panel quotes the same numbers.
 *               Deliberately a merge, not a replacement: a level tunes the two
 *               things it needs and inherits the rest.
 *   `gadgets` - what the player is issued. `decoys` is how many noise lures the
 *               run hands out; zero means the key does nothing.
 *   `relay`   - guards share a chase over their radios: the first guard to
 *               commit passes its last-known position to every other guard as a
 *               place worth looking. Noise still never chases anyone - it just
 *               brings the whole building round.
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
  {
    id: 'executive-wing',
    name: 'Executive Wing',
    difficulty: 6,
    guards: 5,
    blurb: 'carpet offices, a decoy radio',
    gadgets: { decoys: 2 },
    rows: [
      '#########################',
      '#P.....#.........#.....C#',
      '#......#....0....#......#',
      '#......#.........#...####',
      '#.#####......#####......#',
      '#.#..C#.................#',
      '#.#...#....##....#......#',
      '#.#...#....##....#...C..#',
      '#.#...#.........1.......#',
      '#.#...#.........#.......#',
      '#.#...###########.......#',
      '#.#..2........##....C...#',
      '#.#...........##........#',
      '#.####...3....#####..####',
      '#.........C.............#',
      '#.......................#',
      '#4....5............E....#',
      '#########################',
    ],
  },
  {
    id: 'security-wing',
    name: 'Security Wing',
    difficulty: 7,
    guards: 6,
    blurb: 'jumpy guards, deep searches',
    tuning: { suspicionGain: 90, suspicionDecay: 20, searchDuration: 5.5 },
    rows: [
      '#########################',
      '#P......0...............#',
      '#.......................#',
      '#....##.....##.....##...#',
      '#....##..C..##..C..##...#',
      '#.......................#',
      '#1......................#',
      '#.......................#',
      '#....##.....##.....##...#',
      '#....##..C..##..C..##...#',
      '#...........2...........#',
      '#.................3.....#',
      '#..C....................#',
      '#.....................4.#',
      '#....##.....##.....##...#',
      '#5......................#',
      '#....................E..#',
      '#########################',
    ],
  },
  {
    id: 'the-atrium',
    name: 'The Atrium',
    difficulty: 8,
    guards: 6,
    blurb: 'wide cones, long sightlines',
    tuning: { sightRange: 220, fov: 110 },
    rows: [
      '#########################',
      '#P.........0...........E#',
      '#.......................#',
      '#...###..........###....#',
      '#...###....C.....###....#',
      '#.......................#',
      '#.C...1..............C..#',
      '#.......................#',
      '#...###...........###...#',
      '#...###...........###...#',
      '#........2..............#',
      '#.......................#',
      '#......................3#',
      '#..C......C.............#',
      '#.......................#',
      '#4......................#',
      '#....................E.5#',
      '#########################',
    ],
  },
  {
    id: 'the-exchange',
    name: 'The Exchange',
    difficulty: 9,
    guards: 7,
    blurb: 'they radio every sighting',
    relay: true,
    tuning: { chaseSpeed: 165, patrolSpeed: 95, losLostTime: 1.4 },
    rows: [
      '#########################',
      '#P......#.......#......C#',
      '#.......#...0...#.......#',
      '#..1....#.......#...2...#',
      '#.......#.......#.......#',
      '#.#######.......###.#####',
      '#.......#..C....#.......#',
      '#.......#.......#.......#',
      '#..##...#....C..#..##...#',
      '#..##...#.......#..##...#',
      '#.......#########.......#',
      '#...3.............4.....#',
      '#.......................#',
      '#.###.##########........#',
      '#..#......5...#####.C...#',
      '#..#..C.......6.........#',
      '#..#..........7.....E...#',
      '#########################',
    ],
  },
  {
    id: 'blackout',
    name: 'Blackout',
    difficulty: 10,
    guards: 8,
    blurb: 'everything at once, 8 guards',
    relay: true,
    gadgets: { decoys: 1 },
    tuning: { sightRange: 225, fov: 105, chaseSpeed: 168, searchDuration: 6, suspicionGain: 75 },
    rows: [
      '#########################',
      '#P........0............E#',
      '#.......................#',
      '#...##....##....##......#',
      '#...##..C.##..C.##......#',
      '#.1...........6.........#',
      '#.......................#',
      '#.......................#',
      '#......##....##.....##..#',
      '#......##..C.##.....##..#',
      '#...........2...........#',
      '#..........C............#',
      '#...##....##....##......#',
      '#...##.C..##..C.##....3.#',
      '#.......................#',
      '#4....................5.#',
      '#.....................7.#',
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
 * The config a level runs on: the game's own, with this level's guard count
 * and - where the level lists one - its guard tuning merged over the shared
 * numbers.
 *
 * The one rule for how many guards a level posts and how hard they are tuned,
 * so the scene that spawns them and the start page that lists them agree by
 * construction. Deliberately a copy rather than a mutation: `CONFIG` is a
 * module singleton, and a level must not be able to leave its guard count or
 * its tuning behind for the next one.
 *
 * @param {(typeof LEVELS)[number]} level
 * @param {object} [config]
 */
export function configFor(level, config = CONFIG) {
  return {
    ...config,
    enemy: { ...config.enemy, count: level.guards, ...level.tuning },
  };
}

/** What the player is issued on a level, or zeros when it issues nothing. */
export function gadgetsFor(level) {
  return { decoys: 0, ...level.gadgets };
}

/** Whether a level's guards are wired into the alarm relay. */
export function relayFor(level) {
  return Boolean(level.relay);
}

/**
 * One-word tags a start page can print about a level, derived rather than
 * remembered: a retuned level tags itself what it actually tunes.
 */
export function featuresFor(level) {
  const tags = [];

  if (gadgetsFor(level).decoys > 0) tags.push('decoy radio');
  if (relayFor(level)) tags.push('alarm relay');

  const tuning = level.tuning ?? {};
  if (tuning.sightRange || tuning.fov) tags.push('sharp eyes');
  if (tuning.suspicionGain) tags.push('edgy');
  if (tuning.chaseSpeed) tags.push('sprinters');
  if (tuning.searchDuration) tags.push('deep searches');

  return tags;
}
