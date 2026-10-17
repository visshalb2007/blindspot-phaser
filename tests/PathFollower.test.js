import { describe, it, expect } from 'vitest';

import { CONFIG } from '../src/config.js';
import { PathFollower } from '../src/ai/PathFollower.js';

/**
 * Stands in for `EnemyBrain`: the follower only ever reads `x`/`y` and calls
 * `steerTo`, so a stub is enough to test the walking logic in isolation.
 */
class StubAgent {
  constructor(x = 0, y = 0) {
    this.x = x;
    this.y = y;
    this.velocity = { x: 0, y: 0 };
    this.steers = 0;
  }

  steerTo(point, speed) {
    const dx = point.x - this.x;
    const dy = point.y - this.y;
    const dist = Math.hypot(dx, dy);

    this.steers += 1;

    if (dist < 1e-6) {
      this.velocity = { x: 0, y: 0 };
      return 0;
    }

    this.velocity = { x: (dx / dist) * speed, y: (dy / dist) * speed };
    return dist;
  }

  /** Mirrors EnemyBrain._integrate, minus the wall test: no obstacles here. */
  advance(dt) {
    this.x += this.velocity.x * dt;
    this.y += this.velocity.y * dt;
  }
}

const DT = 1 / 60;
const SPEED = 120;

/**
 * 0.25 is exact in binary, so `n * 0.25` hits the stall window boundary dead
 * on instead of landing at 0.9999999999999999 and making the test flap.
 */
const EXACT_DT = 0.25;

function distanceTo(agent, point) {
  return Math.hypot(agent.x - point.x, agent.y - point.y);
}

describe('PathFollower', () => {
  it('reports arrival and stops the agent when it has no path', () => {
    const follower = new PathFollower();
    const agent = new StubAgent(50, 50);
    agent.velocity = { x: 10, y: 10 };

    const status = follower.update(agent, DT, SPEED);

    expect(status).toEqual({ arrived: true, stuck: false, skipped: 0 });
    expect(agent.velocity).toEqual({ x: 0, y: 0 });
    expect(follower.hasPath).toBe(false);
  });

  it('starts a new path at its first node', () => {
    const follower = new PathFollower();
    const agent = new StubAgent(0, 0);
    follower.setPath([{ x: 32, y: 0 }, { x: 64, y: 0 }], agent);

    expect(follower.hasPath).toBe(true);
    expect(follower.currentNode).toEqual({ x: 32, y: 0 });
    expect(follower.remaining).toBe(2);
  });

  it('rejects a non-array path instead of throwing later', () => {
    const follower = new PathFollower();
    follower.setPath(null);

    expect(follower.hasPath).toBe(false);
    expect(follower.path).toEqual([]);
  });

  it('steers toward the current node and points the velocity at it', () => {
    const follower = new PathFollower();
    const agent = new StubAgent(0, 0);
    follower.setPath([{ x: 100, y: 0 }], agent);

    follower.update(agent, DT, SPEED);

    expect(agent.steers).toBe(1);
    expect(agent.velocity.x).toBeCloseTo(SPEED);
    expect(agent.velocity.y).toBeCloseTo(0);
  });

  it('consumes nodes it is already standing on', () => {
    const follower = new PathFollower();
    const agent = new StubAgent(0, 0);
    follower.setPath([{ x: 0, y: 0 }, { x: 0, y: 0 }, { x: 200, y: 0 }], agent);

    const status = follower.update(agent, DT, SPEED);

    expect(status.skipped).toBe(2);
    expect(follower.currentNode).toEqual({ x: 200, y: 0 });
    expect(follower.remaining).toBe(1);
  });

  it('walks a multi-node path to its end and stops there', () => {
    const follower = new PathFollower();
    const agent = new StubAgent(0, 0);
    const goal = { x: 160, y: 64 };

    follower.setPath([{ x: 64, y: 0 }, { x: 64, y: 64 }, goal], agent);

    let arrived = false;
    let frames = 0;

    while (!arrived && frames < 2000) {
      const status = follower.update(agent, DT, SPEED);
      agent.advance(DT);
      arrived = status.arrived;
      frames += 1;
    }

    expect(arrived).toBe(true);
    expect(distanceTo(agent, goal)).toBeLessThanOrEqual(CONFIG.enemy.arriveRadius);
    expect(agent.velocity).toEqual({ x: 0, y: 0 });
    expect(follower.hasPath).toBe(false);
  });

  it('does not report stuck while the agent is making progress', () => {
    const follower = new PathFollower();
    const agent = new StubAgent(0, 0);
    follower.setPath([{ x: 100000, y: 0 }], agent);

    // Two whole stuck windows' worth of frames, all of them productive.
    const frames = Math.ceil((CONFIG.enemy.stuckTime * 2) / DT) + 5;
    const stuckReports = [];

    for (let i = 0; i < frames; i += 1) {
      if (follower.update(agent, DT, SPEED).stuck) stuckReports.push(i);
      agent.advance(DT);
    }

    expect(stuckReports).toEqual([]);
  });

  it('reports stuck once per window when the agent is pinned', () => {
    const follower = new PathFollower();
    const agent = new StubAgent(0, 0);
    follower.setPath([{ x: 500, y: 0 }], agent);

    // Ten frames of 0.25s with a 1s window: the agent is told where to go but
    // never actually moves, so exactly two windows close.
    let reports = 0;
    for (let i = 0; i < 10; i += 1) {
      if (follower.update(agent, EXACT_DT, SPEED).stuck) reports += 1;
    }

    expect(reports).toBe(2);
  });

  it('treats a crawl below stuckDist as no progress', () => {
    const follower = new PathFollower();
    const agent = new StubAgent(0, 0);
    follower.setPath([{ x: 500, y: 0 }], agent);

    const frames = Math.ceil(CONFIG.enemy.stuckTime / EXACT_DT);
    const crawl = CONFIG.enemy.stuckDist / 4;

    let sawStuck = false;
    for (let i = 0; i < frames; i += 1) {
      if (follower.update(agent, EXACT_DT, SPEED).stuck) sawStuck = true;
      agent.x += crawl;
    }

    expect(sawStuck).toBe(true);
    // The guard did move - just not far enough over the whole window.
    expect(agent.x).toBeGreaterThan(0);
    expect(agent.x).toBeLessThanOrEqual(CONFIG.enemy.stuckDist);
  });

  it('forgets a stall once a fresh path is set', () => {
    const follower = new PathFollower();
    const agent = new StubAgent(0, 0);
    follower.setPath([{ x: 500, y: 0 }], agent);

    let stalled = false;
    for (let i = 0; i < 4; i += 1) {
      stalled = follower.update(agent, EXACT_DT, SPEED).stuck;
    }
    expect(stalled).toBe(true);

    follower.setPath([{ x: 500, y: 0 }], agent);

    expect(follower.stuckTimer).toBe(0);
    expect(follower.update(agent, EXACT_DT, SPEED).stuck).toBe(false);
  });

  it('clear() drops the path and the stall clock', () => {
    const follower = new PathFollower();
    const agent = new StubAgent(0, 0);
    follower.setPath([{ x: 500, y: 0 }, { x: 600, y: 0 }], agent);
    follower.update(agent, DT, SPEED);

    follower.clear();

    expect(follower.hasPath).toBe(false);
    expect(follower.remaining).toBe(0);
    expect(follower.stuckTimer).toBe(0);
    expect(follower.update(agent, DT, SPEED).arrived).toBe(true);
  });
});
