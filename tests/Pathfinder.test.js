import { describe, it, expect } from 'vitest';

import { Grid } from '../src/world/Grid.js';
import { Pathfinder } from '../src/ai/Pathfinder.js';
import { PriorityQueue } from '../src/ai/PriorityQueue.js';
import { LEVEL_ROWS } from '../src/world/LevelData.js';

function pathLength(points) {
  let total = 0;
  for (let i = 1; i < points.length; i += 1) {
    total += Math.hypot(points[i].x - points[i - 1].x, points[i].y - points[i - 1].y);
  }
  return total;
}

const OPEN_ROOM = ['#########', '#.......#', '#.......#', '#.......#', '#.......#', '#########'];

/** Two rooms with no way between them. */
const SPLIT_ROOMS = ['#########', '#...#...#', '#########'];

/** (1, 1) and (2, 2) are floor but touch only at a corner. */
const CORNER_TOUCH = ['####', '#.##', '##.#', '####'];

describe('PriorityQueue', () => {
  it('pops items in priority order regardless of insertion order', () => {
    const queue = new PriorityQueue();
    queue.push('c', 3);
    queue.push('a', 1);
    queue.push('d', 4);
    queue.push('b', 2);

    expect([queue.pop(), queue.pop(), queue.pop(), queue.pop()]).toEqual(['a', 'b', 'c', 'd']);
  });

  it('handles duplicate priorities', () => {
    const queue = new PriorityQueue();
    queue.push('x', 1);
    queue.push('y', 1);
    expect(queue.size).toBe(2);
    expect(['x', 'y']).toContain(queue.pop());
  });

  it('returns undefined when empty', () => {
    const queue = new PriorityQueue();
    expect(queue.isEmpty).toBe(true);
    expect(queue.pop()).toBeUndefined();
  });

  it('stays ordered across a large random-ish load', () => {
    const queue = new PriorityQueue();
    const values = [];
    for (let i = 0; i < 500; i += 1) {
      const p = (i * 7919) % 500;
      queue.push(p, p);
      values.push(p);
    }

    const popped = [];
    while (!queue.isEmpty) popped.push(queue.pop());
    expect(popped).toEqual([...values].sort((a, b) => a - b));
  });
});

describe('Grid.neighbours', () => {
  it('offers all eight directions on open ground', () => {
    const grid = new Grid(OPEN_ROOM);
    expect(grid.neighbours(2, 2)).toHaveLength(8);
  });

  it('refuses to squeeze diagonally between two wall corners', () => {
    const grid = new Grid(CORNER_TOUCH);
    const keys = grid.neighbours(1, 1).map((n) => `${n.cx},${n.cy}`);

    // (2, 2) is floor, but (2, 1) and (1, 2) are both wall, so the diagonal
    // counts as clipping through the corner point.
    expect(keys).not.toContain('2,2');
    expect(keys).toEqual([]);
  });

  it('allows the same diagonal when the orthogonal cells are open', () => {
    const grid = new Grid(OPEN_ROOM);
    const keys = grid.neighbours(2, 2).map((n) => `${n.cx},${n.cy}`);
    expect(keys).toContain('3,3');
  });

  it('charges sqrt(2) for a diagonal and 1 for a straight step', () => {
    const grid = new Grid(OPEN_ROOM);
    const diagonal = grid.neighbours(2, 2).find((n) => n.cx === 3 && n.cy === 3);
    const straight = grid.neighbours(2, 2).find((n) => n.cx === 3 && n.cy === 2);

    expect(diagonal.cost).toBeCloseTo(Math.SQRT2, 12);
    expect(straight.cost).toBe(1);
  });
});

describe('Pathfinder heuristic', () => {
  it('matches the real cost of an unobstructed eight-directional walk', () => {
    const grid = new Grid(OPEN_ROOM);
    const pf = new Pathfinder(grid);
    expect(pf.heuristic(0, 0, 6, 3)).toBeCloseTo(6 + (Math.SQRT2 - 1) * 3, 12);
  });

  it('never overestimates, which is what keeps A* optimal', () => {
    const grid = new Grid(OPEN_ROOM);
    const pf = new Pathfinder(grid);
    expect(pf.heuristic(1, 1, 4, 4)).toBeLessThanOrEqual(3 * Math.SQRT2);
  });
});

describe('Pathfinder.findPath', () => {
  const grid = new Grid(OPEN_ROOM);
  const pf = new Pathfinder(grid);

  it('takes a straight line across an open room', () => {
    const from = grid.cellToWorld(1, 1);
    const to = grid.cellToWorld(7, 4);

    const result = pf.findPath(from, to);
    const straight = Math.hypot(to.x - from.x, to.y - from.y);

    expect(result.reached).toBe(true);
    expect(pathLength(result.path)).toBeLessThan(straight * 1.05);
  });

  it('ends on the goal cell centre', () => {
    const from = grid.cellToWorld(1, 1);
    const to = grid.cellToWorld(6, 3);

    const last = pf.findPath(from, to).path.at(-1);
    const goal = grid.cellToWorld(6, 3);
    expect(last).toEqual(goal);
  });

  it('does not include the cell the agent is already standing in', () => {
    const from = grid.cellToWorld(1, 1);
    const path = pf.findPath(from, grid.cellToWorld(7, 4)).path;

    for (const point of path) {
      expect(Math.hypot(point.x - from.x, point.y - from.y)).toBeGreaterThan(1);
    }
  });

  it('returns a single point when the start is already the goal', () => {
    const here = grid.cellToWorld(3, 3);
    const result = pf.findPath(here, here);

    expect(result.reached).toBe(true);
    expect(result.path).toEqual([here]);
    expect(result.visited).toBe(1);
  });

  it('walks around a wall instead of through it', () => {
    const maze = new Grid(['#########', '#...#...#', '#.#.#.#.#', '#.......#', '#########']);
    const from = maze.cellToWorld(1, 1);
    const to = maze.cellToWorld(7, 3);

    const result = new Pathfinder(maze).findPath(from, to);
    const points = [from, ...result.path];

    expect(result.reached).toBe(true);
    for (let i = 1; i < points.length; i += 1) {
      expect(maze.lineIsWalkable(points[i - 1].x, points[i - 1].y, points[i].x, points[i].y)).toBe(
        true,
      );
    }
  });

  it('refuses a diagonal squeeze between two wall corners', () => {
    const corners = new Grid(CORNER_TOUCH);
    const result = new Pathfinder(corners).findPath(
      corners.cellToWorld(1, 1),
      corners.cellToWorld(2, 2),
    );

    // Allowing the cut would make these two diagonally adjacent cells look
    // connected. They are not.
    expect(result.reached).toBe(false);
    expect(result.path).toEqual([]);
  });

  it('returns the closest reachable cell when the goal is sealed off', () => {
    const split = new Grid(SPLIT_ROOMS);
    const result = new Pathfinder(split).findPath(
      split.cellToWorld(1, 1),
      split.cellToWorld(7, 1),
    );

    expect(result.reached).toBe(false);
    expect(result.path.length).toBeGreaterThan(0);

    // The closest cell the search could actually expand is the far side of
    // the dividing wall, at column 3.
    expect(result.path.at(-1)).toEqual(split.cellToWorld(3, 1));
  });

  it('snaps a goal that sits inside a wall onto the nearest floor tile', () => {
    const result = pf.findPath(grid.cellToWorld(1, 1), grid.cellToWorld(0, 0));

    expect(result.reached).toBe(true);
    const last = result.path.at(-1);
    expect(grid.isWallAtWorld(last.x, last.y)).toBe(false);
  });

  it('snaps a start that sits inside a wall onto the nearest floor tile', () => {
    const result = pf.findPath(grid.cellToWorld(0, 0), grid.cellToWorld(5, 3));

    expect(result.reached).toBe(true);
    expect(result.path.length).toBeGreaterThan(0);
  });
});

describe('Pathfinder on the shipped level', () => {
  const grid = new Grid(LEVEL_ROWS);
  const pf = new Pathfinder(grid);

  it('connects the spawn to the exit', () => {
    expect(pf.findPath(grid.spawn, grid.exit).reached).toBe(true);
  });

  it('connects the spawn to every waypoint, which is what patrol needs', () => {
    for (const waypoint of grid.waypoints) {
      expect(
        pf.findPath(grid.spawn, waypoint).reached,
        `waypoint ${waypoint.order} should be reachable`,
      ).toBe(true);
    }
  });

  it('connects every waypoint to the next one in the loop, both ways', () => {
    for (let i = 0; i < grid.waypoints.length; i += 1) {
      const from = grid.waypoints[i];
      const to = grid.waypoints[(i + 1) % grid.waypoints.length];
      expect(pf.findPath(from, to).reached, `${i} -> next`).toBe(true);
      expect(pf.findPath(to, from).reached, `next -> ${i}`).toBe(true);
    }
  });

  it('produces legs that are all individually walkable after smoothing', () => {
    const result = pf.findPath(grid.spawn, grid.exit);
    const points = [grid.spawn, ...result.path];

    for (let i = 1; i < points.length; i += 1) {
      expect(
        grid.lineIsWalkable(points[i - 1].x, points[i - 1].y, points[i].x, points[i].y),
        `leg ${i} from (${points[i - 1].x}, ${points[i - 1].y})`,
      ).toBe(true);
    }
  });

  it('explores far fewer nodes than the whole grid', () => {
    const result = pf.findPath(grid.spawn, grid.exit);
    expect(result.visited).toBeGreaterThan(0);
    expect(result.visited).toBeLessThan(grid.cols * grid.rows);
  });
});
