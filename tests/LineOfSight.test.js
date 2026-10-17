import { describe, it, expect } from 'vitest';

import { Grid } from '../src/world/Grid.js';
import { LineOfSight } from '../src/world/LineOfSight.js';

/**
 * A room with a pillar in the middle and a corridor round the outside, at a
 * scale where one character is one 32px tile.
 *
 *   0 1 2 3 4 5 6
 * 0 # # # # # # #
 * 1 # . . . . . #
 * 2 # . # . . . #
 * 3 # . . . . . #
 * 4 # # # # # # #
 */
const ROOM = ['#######', '#.....#', '#.#...#', '#.....#', '#######'];

/** Two rooms with no way between them. */
const SPLIT = ['#########', '#...#...#', '#########'];

/** Nothing but floor, for testing the shape of the walk itself. */
const OPEN = ['#########', '#.......#', '#.......#', '#.......#', '#########'];

/** (1,2) and (2,1) touch only at a corner, flanked by two walls. */
const CORNER = ['#####', '#.#.#', '##..#', '#...#', '#####'];

const cell = (grid, cx, cy) => grid.cellToWorld(cx, cy);

describe('LineOfSight', () => {
  it('sees along an open row', () => {
    const grid = new Grid(ROOM);
    const los = new LineOfSight(grid);

    expect(los.canSee(cell(grid, 1, 1), cell(grid, 5, 1))).toBe(true);
  });

  it('is blocked by a wall between the two points', () => {
    const grid = new Grid(SPLIT);
    const los = new LineOfSight(grid);

    // (1,1) and (7,1) are in the two halves the wall at column 4 separates.
    expect(los.canSee(cell(grid, 1, 1), cell(grid, 7, 1))).toBe(false);
  });

  it('reports the cell that blocked it', () => {
    const grid = new Grid(SPLIT);
    const los = new LineOfSight(grid);

    const trace = los.trace(cell(grid, 1, 1), cell(grid, 7, 1));

    expect(trace.clear).toBe(false);
    expect(trace.blockedAt).toEqual({ cx: 4, cy: 1 });
    expect(trace.cells[trace.cells.length - 1]).toEqual(trace.blockedAt);
  });

  it('is blocked by a pillar it has to look past', () => {
    const grid = new Grid(ROOM);
    const los = new LineOfSight(grid);

    // The wall at (2,2) sits on the diagonal from (1,1) to (3,3).
    expect(los.canSee(cell(grid, 1, 1), cell(grid, 3, 3))).toBe(false);
  });

  it('sees around the same pillar when the ray misses it', () => {
    const grid = new Grid(ROOM);
    const los = new LineOfSight(grid);

    // Corner to corner the other way: nothing but floor on the way.
    expect(los.canSee(cell(grid, 1, 1), cell(grid, 5, 1))).toBe(true);
    expect(los.canSee(cell(grid, 1, 1), cell(grid, 1, 3))).toBe(true);
  });

  it('refuses to see through a corner where two walls only touch', () => {
    const grid = new Grid(CORNER);
    const los = new LineOfSight(grid);

    // From (1,1) to (2,2) the ray passes exactly through the shared corner of
    // (2,1) and (1,2), both of which are walls.
    expect(grid.isWall(2, 1)).toBe(true);
    expect(grid.isWall(1, 2)).toBe(true);
    expect(los.canSee(cell(grid, 1, 1), cell(grid, 2, 2))).toBe(false);
  });

  it('treats a straight line as clear however long it is', () => {
    const grid = new Grid(['#########', '#.......#', '#########']);
    const los = new LineOfSight(grid);

    expect(los.canSee(cell(grid, 1, 1), cell(grid, 7, 1))).toBe(true);
    expect(los.trace(cell(grid, 1, 1), cell(grid, 7, 1)).cells).toHaveLength(6);
  });

  it('sees in both directions, or neither', () => {
    const grid = new Grid(SPLIT);
    const los = new LineOfSight(grid);
    const a = cell(grid, 1, 1);
    const b = cell(grid, 7, 1);

    expect(los.canSee(a, b)).toBe(los.canSee(b, a));
  });

  it('is clear when both points are in the same cell', () => {
    const grid = new Grid(ROOM);
    const los = new LineOfSight(grid);

    const trace = los.trace({ x: 40, y: 40 }, { x: 50, y: 50 });

    expect(trace.clear).toBe(true);
    expect(trace.cells).toEqual([]);
  });

  it('does not report the observer cell as blocking its own view', () => {
    const grid = new Grid(SPLIT);
    const los = new LineOfSight(grid);

    // Stood in the doorway cell (3,1), with a wall directly behind at (2,1).
    const trace = los.trace(cell(grid, 3, 1), cell(grid, 3, 1));

    expect(trace.clear).toBe(true);
    expect(trace.blockedAt).toBeNull();
  });

  it('is blocked by the map edge rather than seeing off it', () => {
    const grid = new Grid(ROOM);
    const los = new LineOfSight(grid);

    // Out of bounds counts as solid, so a ray leaving the map is cut.
    expect(los.canSee(cell(grid, 1, 1), cell(grid, 1, 9))).toBe(false);
    expect(los.canSee(cell(grid, 1, 1), { x: -400, y: -400 })).toBe(false);
  });

  it('is blocked by a target standing inside a wall', () => {
    const grid = new Grid(SPLIT);
    const los = new LineOfSight(grid);

    expect(los.canSee(cell(grid, 1, 1), cell(grid, 4, 1))).toBe(false);
  });

  it('walks one cell per tile of distance, never skipping a wall', () => {
    const grid = new Grid(OPEN);
    const los = new LineOfSight(grid);

    const from = cell(grid, 1, 1);
    const to = cell(grid, 6, 3);
    const trace = los.trace(from, to);

    expect(trace.clear).toBe(true);

    // Every step is to an orthogonal or diagonal neighbour of the last, so no
    // wall can slip between two samples.
    let previous = grid.worldToCell(from.x, from.y);
    for (const step of trace.cells) {
      const dx = Math.abs(step.cx - previous.cx);
      const dy = Math.abs(step.cy - previous.cy);
      expect(Math.max(dx, dy)).toBe(1);
      previous = step;
    }

    // A six-by-two offset: at least five steps, and never more than the
    // staircase worst case of all seven cells.
    expect(trace.cells.length).toBeGreaterThanOrEqual(5);
    expect(trace.cells.length).toBeLessThanOrEqual(7);
    expect(trace.cells[trace.cells.length - 1]).toEqual(grid.worldToCell(to.x, to.y));
  });

  it('agrees with the level the game actually ships', () => {
    const grid = new Grid();
    const los = new LineOfSight(grid);

    // The spawn room and the first waypoint room are separated by the wall in
    // column 2, which is the case that used to let a guard see through it.
    const spawn = grid.spawn;
    const room = grid.waypoints[0];

    expect(los.canSee(spawn, room)).toBe(false);

    // But a clear stretch of the top corridor really is visible.
    expect(los.canSee(spawn, { x: spawn.x + 96, y: spawn.y })).toBe(true);
  });
});
