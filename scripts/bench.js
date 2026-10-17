/**
 * Measures the hand-written AI against a frame budget.
 *
 *     npm run bench
 *
 * Three questions, in the order they matter:
 *
 *   1. How long does one A\* search take? The guards re-plan whenever the
 *      player has moved a tile, so a slow search becomes a visible hitch.
 *   2. How long does one line-of-sight ray take? Two guards cast one every
 *      frame at 60 Hz, whether or not they can see anything.
 *   3. What does a whole simulated frame cost, and what is the worst one?
 *
 * Everything runs on the real level with the real config, because a benchmark
 * against a toy grid answers a question nobody asked. Timing is wall clock;
 * each suite is warmed up first so the numbers are not measuring the JIT.
 *
 * Exits non-zero if a budget is missed, so it can gate a release rather than
 * just print a number nobody reads.
 */

import { CONFIG } from '../src/config.js';
import { Grid } from '../src/world/Grid.js';
import { LineOfSight } from '../src/world/LineOfSight.js';
import { EnemyBrain } from '../src/ai/EnemyBrain.js';
import { Pathfinder } from '../src/ai/Pathfinder.js';
import { STATE } from '../src/ai/states.js';

/**
 * Performance targets, not gameplay tunables, so they live here rather than in
 * `config.js`. At 60 Hz a frame is 16.7 ms and the AI is only one of the things
 * being drawn; a single search getting anywhere near 16 ms would drop a frame.
 */
const BUDGET = {
  pathMedianMs: 0.5,
  pathP95Ms: 2.0,
  pathWorstMs: 5.0,
  losMeanUs: 20,
  frameMeanMs: 1.0,
  frameWorstMs: 5.0,
};

const FRAME_MS = 1000 / 60;
const DT = 1 / 60;
const PASSES = 5;

// ----------------------------------------------------------------- reporting

const results = [];

function record(name, value, budget, unit, { lowerIsBetter = true } = {}) {
  const ok = lowerIsBetter ? value <= budget : value >= budget;
  results.push({ name, value, budget, unit, ok });
  return ok;
}

function format(value) {
  if (value === 0) return '0';
  if (Math.abs(value) >= 100) return value.toFixed(0);
  if (Math.abs(value) >= 1) return value.toFixed(2);
  return value.toFixed(3);
}

function report() {
  const width = Math.max(...results.map((r) => r.name.length));
  console.log(`\n${'metric'.padEnd(width)}  ${'actual'.padStart(9)}   budget`);

  for (const r of results) {
    const mark = r.ok ? 'ok  ' : 'OVER';
    console.log(
      `${r.name.padEnd(width)}  ${format(r.value).padStart(6)}${r.unit.padEnd(3)}   ` +
        `<= ${format(r.budget)}${r.unit}  ${mark}`,
    );
  }
}

// ------------------------------------------------------------------- timing

function elapsedMs(fn) {
  const start = process.hrtime.bigint();
  fn();
  return Number(process.hrtime.bigint() - start) / 1e6;
}

function percentile(sorted, fraction) {
  if (sorted.length === 0) return 0;
  const index = Math.min(sorted.length - 1, Math.floor(sorted.length * fraction));
  return sorted[index];
}

/** Best of several passes: the least noise-contaminated estimate of the cost. */
function bestPass(passes, fn) {
  let best = Infinity;
  for (let i = 0; i < passes; i += 1) best = Math.min(best, elapsedMs(fn));
  return best;
}

/** Deterministic PRNG, so two runs sample the same pairs and can be compared. */
function mulberry32(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// --------------------------------------------------------------------- setup

const grid = new Grid();
const pathfinder = new Pathfinder(grid);
const los = new LineOfSight(grid);
const random = mulberry32(20251017);

const floor = [];
for (let cy = 0; cy < grid.rows; cy += 1) {
  for (let cx = 0; cx < grid.cols; cx += 1) {
    if (grid.isWalkable(cx, cy)) floor.push(grid.cellToWorld(cx, cy));
  }
}

const ROUTES = 200;
const routes = [];
for (let i = 0; i < ROUTES; i += 1) {
  const from = floor[Math.floor(random() * floor.length)];
  const to = floor[Math.floor(random() * floor.length)];
  routes.push([from, to]);
}

console.log(
  `level ${grid.cols}x${grid.rows}, ${floor.length} walkable tiles, ` +
    `${grid.waypoints.length} waypoints, ${ROUTES} sampled routes`,
);

// ---------------------------------------------------------------- A* search

pathfinder.findPath(floor[0], floor[floor.length - 1]);
for (let i = 0; i < 50; i += 1) {
  const [from, to] = routes[i % routes.length];
  pathfinder.findPath(from, to);
}

const perSearch = [];
let reached = 0;
let visitedTotal = 0;

const passMs = bestPass(PASSES, () => {
  perSearch.length = 0;
  reached = 0;
  visitedTotal = 0;

  for (const [from, to] of routes) {
    const start = process.hrtime.bigint();
    const result = pathfinder.findPath(from, to);
    perSearch.push(Number(process.hrtime.bigint() - start) / 1e6);

    if (result.reached) reached += 1;
    visitedTotal += result.visited;
  }
});

perSearch.sort((a, b) => a - b);

const searchesPerFrame = passMs / ROUTES / FRAME_MS;

console.log(
  `\nA*  ${(passMs / ROUTES).toFixed(3)} ms per search, ` +
    `${(visitedTotal / ROUTES).toFixed(0)} cells visited on average, ` +
    `${reached}/${ROUTES} reached, ` +
    `${(searchesPerFrame * 100).toFixed(2)}% of a frame each`,
);

record('A* median search', percentile(perSearch, 0.5), BUDGET.pathMedianMs, 'ms');
record('A* 95th percentile', percentile(perSearch, 0.95), BUDGET.pathP95Ms, 'ms');
record('A* worst search', perSearch[perSearch.length - 1], BUDGET.pathWorstMs, 'ms');

// ----------------------------------------------------------- line of sight

const RAYS = 2000;
const rays = [];
for (let i = 0; i < RAYS; i += 1) {
  rays.push([
    floor[Math.floor(random() * floor.length)],
    { x: random() * CONFIG.map.widthPx, y: random() * CONFIG.map.heightPx },
  ]);
}

for (let i = 0; i < 500; i += 1) los.canSee(rays[0][0], rays[0][1]);

const losMs = bestPass(PASSES, () => {
  for (const [from, to] of rays) los.canSee(from, to);
});

const losUs = (losMs / RAYS) * 1000;
console.log(
  `\nLOS ${losUs.toFixed(3)} us per ray, ` +
    `${CONFIG.enemy.count * 60} rays per second for ${CONFIG.enemy.count} guards at 60 Hz`,
);

record('LOS per ray', losUs, BUDGET.losMeanUs, 'us');

// ------------------------------------------------------ a simulated frame

/**
 * The realistic load: real guards on the real route, and a player that walks
 * that route *against* them.
 *
 * Walking with the guards put the player behind them, where a cone never looks,
 * and once certainty had to build over time rather than arriving with the first
 * glimpse almost nothing was picked up. Coming the other way means meeting each
 * guard head on: it sees the player, takes a moment, hunts, loses them and
 * searches, which is the state mix worth measuring.
 *
 * Counting searches through a wrapper rather than instrumenting the brain keeps
 * production code free of benchmark hooks.
 */

/** The patrol circuit as one continuous polyline, walked by the stand-in player. */
function buildCircuit() {
  const points = [];
  const waypoints = grid.waypoints;

  for (let i = 0; i < waypoints.length; i += 1) {
    const { path } = pathfinder.findPath(waypoints[i], waypoints[(i + 1) % waypoints.length]);
    points.push(...path);
  }

  return points;
}

const circuit = buildCircuit();
const circuitLength = circuit.reduce((sum, point, i) => {
  const next = circuit[(i + 1) % circuit.length];
  return sum + Math.hypot(next.x - point.x, next.y - point.y);
}, 0);

/** The point `distance` px along the circuit, wrapping round it either way. */
function pointAlong(polyline, distance) {
  let remaining = ((distance % circuitLength) + circuitLength) % circuitLength;

  for (let i = 0; i < polyline.length; i += 1) {
    const a = polyline[i];
    const b = polyline[(i + 1) % polyline.length];
    const segment = Math.hypot(b.x - a.x, b.y - a.y);

    if (remaining <= segment) {
      const t = segment === 0 ? 0 : remaining / segment;
      return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t };
    }

    remaining -= segment;
  }

  return { x: polyline[0].x, y: polyline[0].y };
}

/**
 * How far the stand-in player has walked by `frame`, in px, walking the circuit
 * backwards and stopping every couple of seconds to look around.
 *
 * The pauses matter. Certainty has to build over about a second and a half of
 * unbroken sight, and a guard only closes on a walking player at the difference
 * of their two speeds, so somebody who never stops crosses a cone and is gone
 * before any guard works up past suspicion. A player who stops is the case that
 * produces hunts.
 */
function walkedDistance(frame) {
  const seconds = frame * DT;
  const walk = 2;
  const rest = 2;
  const cycle = walk + rest;

  const cycles = Math.floor(seconds / cycle);
  const inCycle = seconds % cycle;

  return -(cycles * walk + Math.min(inCycle, walk)) * CONFIG.player.speed;
}

function simulate(seconds, playerMoves) {
  const original = Pathfinder.prototype.findPath;
  let searchesThisFrame = 0;

  Pathfinder.prototype.findPath = function wrapped(...args) {
    searchesThisFrame += 1;
    return original.apply(this, args);
  };

  const waypoints = grid.waypoints;
  const guards = [];
  const count = Math.max(1, CONFIG.enemy.count);

  for (let i = 0; i < count; i += 1) {
    const startIndex = Math.floor((i * waypoints.length) / count);
    const post = waypoints[startIndex] ?? grid.spawn;
    guards.push(
      new EnemyBrain({
        name: `guard-${i + 1}`,
        x: post.x,
        y: post.y,
        heading: 0,
        waypoints,
        startIndex,
        grid,
      }),
    );
  }

  const player = { x: grid.spawn.x, y: grid.spawn.y };
  const frames = Math.round(seconds / DT);
  const perFrame = [];
  let searchCount = 0;
  let maxSearchesInFrame = 0;
  let chaseFrames = 0;
  let worstIndex = 0;

  for (let frame = 0; frame < frames; frame += 1) {
    if (playerMoves) {
      const point = pointAlong(circuit, walkedDistance(frame));
      player.x = point.x;
      player.y = point.y;
    }

    searchesThisFrame = 0;
    const start = process.hrtime.bigint();
    for (const guard of guards) guard.update(DT, player);
    const ms = Number(process.hrtime.bigint() - start) / 1e6;

    perFrame.push(ms);
    searchCount += searchesThisFrame;
    if (searchesThisFrame > maxSearchesInFrame) maxSearchesInFrame = searchesThisFrame;
    if (guards.some((guard) => guard.state === STATE.CHASE)) chaseFrames += 1;
    if (ms >= perFrame[worstIndex]) worstIndex = frame;
  }

  Pathfinder.prototype.findPath = original;

  const total = perFrame.reduce((sum, ms) => sum + ms, 0);
  const sorted = [...perFrame].sort((a, b) => a - b);

  return {
    frames,
    mean: total / frames,
    worst: sorted[sorted.length - 1],
    worstIndex,
    p95: percentile(sorted, 0.95),
    chaseFrames,
    maxSearchesInFrame,
    searchesPerSecond: searchCount / seconds,
  };
}

simulate(2, true); // warm up, so the first measured frame is not measuring the JIT

const still = simulate(20, false);
const moving = simulate(20, true);

function describe(label, s) {
  const chase = ((s.chaseFrames / s.frames) * 100).toFixed(0);
  console.log(
    `AI frame, ${label}: ${s.mean.toFixed(3)} ms mean, ` +
      `${s.p95.toFixed(3)} ms p95, ${s.worst.toFixed(3)} ms worst ` +
      `(frame ${s.worstIndex}), chasing ${chase}% of frames, ` +
      `${s.searchesPerSecond.toFixed(1)} searches/s, up to ${s.maxSearchesInFrame}/frame`,
  );
}

describe('player still ', still);
describe('player walking', moving);

record('AI frame mean (walking)', moving.mean, BUDGET.frameMeanMs, 'ms');
record('AI frame p95 (walking)', moving.p95, BUDGET.frameWorstMs, 'ms');
record('AI frame worst (walking)', moving.worst, BUDGET.frameWorstMs, 'ms');

// ----------------------------------------------------------------- verdict

report();

const failed = results.filter((r) => !r.ok);
if (failed.length > 0) {
  console.error(`\n${failed.length} budget(s) missed: ${failed.map((f) => f.name).join(', ')}`);
  process.exitCode = 1;
} else {
  console.log('\nall budgets met');
}
