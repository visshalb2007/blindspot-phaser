import { describe, it, expect } from 'vitest';

import { CONFIG } from '../src/config.js';
import { Grid } from '../src/world/Grid.js';
import { LEVEL_ROWS } from '../src/world/LevelData.js';
import { guardPosts } from '../src/world/Roster.js';

/** A loop of exactly one post, and a level with no loop at all. */
const LONE_POST = ['#######', '#P.0..#', '#######'];
const NO_POSTS = ['#######', '#P....#', '#######'];

describe('guardPosts', () => {
  it('posts the configured guards on the shipped level, evenly spaced', () => {
    const grid = new Grid(LEVEL_ROWS);

    const posts = guardPosts(grid);

    expect(posts.length).toBe(Math.min(CONFIG.enemy.count, grid.waypoints.length));
    // Two guards around four posts: the first two, not the first and last.
    expect(posts.map((post) => post.startIndex)).toEqual([0, 2]);
    expect(posts.map((post) => post.name)).toEqual(['guard-1', 'guard-2']);
  });

  it('stands each guard on its post, facing the next one', () => {
    const grid = new Grid(LEVEL_ROWS);

    for (const post of guardPosts(grid)) {
      const waypoint = grid.waypoints[post.startIndex];
      const next = grid.waypoints[(post.startIndex + 1) % grid.waypoints.length];

      expect(post.x).toBe(waypoint.x);
      expect(post.y).toBe(waypoint.y);
      expect(post.order).toBe(waypoint.order);
      expect(post.heading).toBeCloseTo(Math.atan2(next.y - post.y, next.x - post.x), 9);
    }
  });

  it('spreads guards by ratio rather than by stride', () => {
    // Three guards around four posts land on 0, 1 and 2. A stride of
    // floor(4/3) = 1 would put one of them on top of another.
    const grid = new Grid(LEVEL_ROWS);

    const posts = guardPosts(grid, { count: 3 });

    expect(posts.map((post) => post.startIndex)).toEqual([0, 1, 2]);
    expect(new Set(posts.map((post) => `${post.x},${post.y}`)).size).toBe(3);
  });

  it('never posts more guards than the loop has waypoints', () => {
    const grid = new Grid(LONE_POST);

    const posts = guardPosts(grid, { count: 4 });

    expect(posts.length).toBe(1);
    expect(posts[0].order).toBe(0);
  });

  it('falls back to the spawn tile when there is no loop to walk', () => {
    const grid = new Grid(NO_POSTS);

    const posts = guardPosts(grid, { count: 2 });

    expect(posts.length).toBe(1);
    expect(posts[0].x).toBe(grid.spawn.x);
    expect(posts[0].y).toBe(grid.spawn.y);
    expect(posts[0].heading).toBe(0);
  });

  it('always posts somebody, whatever it is asked for', () => {
    const grid = new Grid(LEVEL_ROWS);

    expect(guardPosts(grid, { count: 0 }).length).toBe(1);
    expect(guardPosts(grid, { count: -3 }).length).toBe(1);
  });

  it('leaves the grid it was given alone', () => {
    const grid = new Grid(LEVEL_ROWS);
    const before = JSON.stringify(grid.waypoints);

    guardPosts(grid, { count: 3 });

    expect(JSON.stringify(grid.waypoints)).toBe(before);
  });
});
