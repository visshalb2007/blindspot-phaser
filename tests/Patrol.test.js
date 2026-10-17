import { describe, it, expect } from 'vitest';

import { CONFIG } from '../src/config.js';
import { Grid } from '../src/world/Grid.js';
import { EnemyBrain } from '../src/ai/EnemyBrain.js';
import { STATE } from '../src/ai/states.js';

const DT = 1 / 60;

/**
 * Far outside the level, so range can never be satisfied. Most of these tests
 * are about the route, not about sight: a guard that starts chasing halfway
 * through has told us nothing about whether it can walk a patrol loop.
 */
const NOWHERE = { x: -10_000, y: -10_000 };

function makeGrid() {
  return new Grid();
}

/** Mirrors GameScene._spawnGuards: posts spaced evenly around the loop. */
function spawnGuards(grid, count = CONFIG.enemy.count) {
  const waypoints = grid.waypoints;
  const guards = [];

  for (let i = 0; i < Math.max(1, Math.min(count, waypoints.length)); i += 1) {
    const startIndex = Math.floor((i * waypoints.length) / Math.max(1, count));
    const post = waypoints[startIndex] ?? grid.spawn;
    const next = waypoints[(startIndex + 1) % waypoints.length];

    guards.push(
      new EnemyBrain({
        name: `guard-${i + 1}`,
        x: post.x,
        y: post.y,
        heading: next ? Math.atan2(next.y - post.y, next.x - post.x) : 0,
        waypoints,
        startIndex,
        grid,
      }),
    );
  }

  return guards;
}

function distance(a, b) {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

/**
 * Steps the guards for `seconds`, calling `inspect` after each frame.
 *
 * @param {Array<object>} guards
 * @param {number} seconds
 * @param {(guard: object, frame: number) => void} [inspect]
 * @param {{x: number, y: number}} [target]
 */
function run(guards, seconds, inspect = null, target = NOWHERE) {
  const frames = Math.round(seconds / DT);

  for (let frame = 0; frame < frames; frame += 1) {
    for (const guard of guards) {
      guard.update(DT, target);
      if (inspect) inspect(guard, frame);
    }
  }

  return frames;
}

/** Records the sequence of distinct states a guard passes through. */
function stateRecorder() {
  const states = [];
  return {
    states,
    record: (guard) => {
      if (states[states.length - 1] !== guard.state) states.push(guard.state);
    },
  };
}

describe('patrol route', () => {
  it('walks a full loop and stops at every waypoint in order', () => {
    const grid = makeGrid();
    const [guard] = spawnGuards(grid, 1);

    const arrivals = [];
    let wasWaiting = guard.waiting;

    // A little over two ~18s loops, so the sequence must come round again.
    run([guard], 40, () => {
      if (guard.waiting && !wasWaiting) arrivals.push(guard.waypointIndex);
      wasWaiting = guard.waiting;
    });

    const total = grid.waypoints.length;
    expect(arrivals.length).toBeGreaterThanOrEqual(total + 1);

    arrivals.forEach((index, i) => {
      if (i === 0) return;
      expect(index).toBe((arrivals[i - 1] + 1) % total);
    });
  });

  it('never stands in a wall, for two guards over a minute of patrol', () => {
    const grid = makeGrid();
    const guards = spawnGuards(grid, 2);

    run(guards, 60, (guard) => {
      expect(guard.canStandAt(guard.x, guard.y)).toBe(true);
    });
  });

  it('draws a route that never crosses a wall', () => {
    const grid = makeGrid();
    const guards = spawnGuards(grid, 2);
    let segments = 0;

    run(guards, 40, (guard) => {
      const path = guard.follower.path.slice(guard.follower.index);
      let previous = { x: guard.x, y: guard.y };

      for (const node of path) {
        segments += 1;
        expect(grid.lineIsWalkable(previous.x, previous.y, node.x, node.y)).toBe(true);
        previous = node;
      }
    });

    // If nothing was checked, the test would pass for the wrong reason.
    expect(segments).toBeGreaterThan(100);
  });

  it('takes both guards right around the shared loop', () => {
    const grid = makeGrid();
    const guards = spawnGuards(grid, 2);
    const visited = guards.map(() => new Set());

    run(guards, 40, (guard) => {
      visited[guards.indexOf(guard)].add(guard.waypointIndex);
    });

    for (const set of visited) {
      expect(set.size).toBe(grid.waypoints.length);
    }
  });

  it('scans in place when the level has no usable waypoints', () => {
    const grid = makeGrid();
    const brain = new EnemyBrain({
      x: grid.spawn.x,
      y: grid.spawn.y,
      heading: 0,
      waypoints: [],
      grid,
    });

    expect(brain.usingLookAroundFallback).toBe(true);

    const headings = [];
    run([brain], 3, () => headings.push(brain.heading));

    expect(brain.state).toBe(STATE.PATROL);
    expect(Math.max(...headings) - Math.min(...headings)).toBeGreaterThan(0);
    expect(brain.velocity).toEqual({ x: 0, y: 0 });
  });
});

describe('chase and return', () => {
  it('closes on a player it can see, then goes back to the post it left', () => {
    const grid = makeGrid();
    const post = grid.waypoints[1];
    const brain = new EnemyBrain({
      x: post.x,
      y: post.y,
      heading: 0,
      waypoints: grid.waypoints,
      startIndex: 1,
      grid,
    });

    // Straight east of the post, on the same floor row and well inside the
    // 180px sight range. No line-of-sight test exists yet (Phase 5), so being
    // in range and in the cone is enough to be seen.
    const startDistance = 80;
    const near = { x: post.x + startDistance, y: post.y };
    expect(distance(post, near)).toBeLessThan(CONFIG.enemy.sightRange);
    expect(grid.isWallAtWorld(near.x, near.y)).toBe(false);

    const { states, record } = stateRecorder();

    // A guard patrols while it is looking around, so by the time it spots the
    // player it may already be walking toward a later waypoint. That is the
    // post it should come back to, so remember it rather than assuming wp1.
    let abandoned = null;
    run(
      [brain],
      1.5,
      (guard) => {
        if (abandoned === null && guard.state === STATE.CHASE) abandoned = guard.currentWaypoint;
        record(guard);
      },
      near,
    );

    expect(states).toContain(STATE.CHASE);
    expect(abandoned).not.toBeNull();
    expect(distance(brain, near)).toBeLessThan(startDistance / 2);

    // The player vanishes. Run until the guard is back on duty, then stop, so
    // the assertions describe the moment it resumed rather than a later frame.
    let resumedAt = null;
    for (let frame = 0; frame < 60 * 30 && resumedAt === null; frame += 1) {
      brain.update(DT, NOWHERE);
      record(brain);

      if (brain.state === STATE.PATROL && states.includes(STATE.RETURN)) resumedAt = frame;
    }

    expect(states).toContain(STATE.RETURN);
    expect(resumedAt).not.toBeNull();
    expect(distance(abandoned, brain)).toBeLessThanOrEqual(CONFIG.enemy.arriveRadius);
    expect(grid.waypoints[brain.waypointIndex]).toBe(abandoned);
  });

  it('never transitions into a chase without the player in sight', () => {
    const grid = makeGrid();
    const guards = spawnGuards(grid, 2);
    const target = { x: grid.spawn.x, y: grid.spawn.y };
    const previous = new Map();

    run(
      guards,
      30,
      (guard) => {
        const was = previous.get(guard);
        previous.set(guard, guard.state);

        if (was !== undefined && was !== STATE.CHASE && guard.state === STATE.CHASE) {
          // Either state may lead into a chase, but both do it for one reason.
          expect(guard.sight.seen).toBe(true);
        }
      },
      target,
    );
  });
});
