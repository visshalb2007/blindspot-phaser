import { describe, it, expect } from 'vitest';

import { Grid } from '../src/world/Grid.js';
import { LEVEL_ROWS } from '../src/world/LevelData.js';

/** Breadth-first walk over 4-connected floor tiles, used to prove the map is usable. */
function reachableFrom(grid, start) {
  const seen = new Set([`${start.cx},${start.cy}`]);
  const queue = [start];

  while (queue.length > 0) {
    const { cx, cy } = queue.shift();
    for (const [dx, dy] of [
      [1, 0],
      [-1, 0],
      [0, 1],
      [0, -1],
    ]) {
      const nx = cx + dx;
      const ny = cy + dy;
      const key = `${nx},${ny}`;
      if (seen.has(key) || grid.isWall(nx, ny)) continue;
      seen.add(key);
      queue.push({ cx: nx, cy: ny });
    }
  }

  return seen;
}

describe('Grid parsing', () => {
  it('reports the dimensions and derives tile size from config', () => {
    const grid = new Grid();
    expect(grid.cols).toBe(25);
    expect(grid.rows).toBe(18);
    expect(grid.tileSize).toBe(32);
  });

  it('parses the shipped level without warnings', () => {
    const grid = new Grid();
    expect(grid.warnings).toEqual([]);
  });

  it('places walls and floors where the ascii says', () => {
    const grid = new Grid();
    expect(grid.isWall(0, 0)).toBe(true);
    expect(grid.isWall(1, 1)).toBe(false);
    expect(grid.isWall(2, 2)).toBe(true);
  });

  it('treats out-of-bounds as solid so callers never need their own bounds check', () => {
    const grid = new Grid();
    expect(grid.isWall(-1, 5)).toBe(true);
    expect(grid.isWall(5, -1)).toBe(true);
    expect(grid.isWall(25, 5)).toBe(true);
    expect(grid.isWall(5, 18)).toBe(true);
  });

  it('finds the spawn, exit, chips and waypoints', () => {
    const grid = new Grid();
    expect(grid.spawn).toMatchObject({ cx: 1, cy: 1 });
    expect(grid.exit).toMatchObject({ cx: 22, cy: 16 });
    expect(grid.chips).toHaveLength(2);
    expect(grid.waypoints).toHaveLength(4);
  });

  it('orders waypoints by their digit, not by their position in the file', () => {
    const grid = new Grid();
    expect(grid.waypoints.map((w) => w.order)).toEqual([0, 1, 2, 3]);
    expect(grid.waypoints[0]).toMatchObject({ cx: 4, cy: 4 });
  });

  it('converts between cell and world coordinates around the tile centre', () => {
    const grid = new Grid();
    expect(grid.cellToWorld(4, 4)).toEqual({ x: 4 * 32 + 16, y: 4 * 32 + 16 });
    expect(grid.worldToCell(4 * 32 + 16, 4 * 32 + 16)).toEqual({ cx: 4, cy: 4 });
    expect(grid.worldToCell(0, 0)).toEqual({ cx: 0, cy: 0 });
  });
});

describe('Grid validation', () => {
  it('warns about a waypoint that is walled in on all sides', () => {
    // The waypoint at (3, 3) is boxed in by walls on all four sides.
    const rows = [
      '#########',
      '#P......#',
      '#.#####.#',
      '#.#0#.#.#',
      '#.#####.#',
      '#.......#',
      '#########',
    ];

    const grid = new Grid(rows);
    expect(grid.warnings.some((w) => w.includes('walled in'))).toBe(true);
  });

  it('warns when there is no spawn and falls back to the first floor tile', () => {
    const rows = ['#########', '#.......#', '#########'];
    const grid = new Grid(rows);

    expect(grid.spawn).toMatchObject({ cx: 1, cy: 1 });
    expect(grid.warnings.some((w) => w.includes('no player spawn'))).toBe(true);
  });

  it('warns when a row is the wrong width', () => {
    const grid = new Grid(['#####', '#...#', '###']);
    expect(grid.warnings.some((w) => w.includes('tiles wide'))).toBe(true);
  });

  it('warns when there are fewer than two waypoints, which arms the look-around fallback', () => {
    const grid = new Grid(['#########', '#P..0...#', '#########']);
    expect(grid.warnings.some((w) => w.includes('look-around'))).toBe(true);
  });

  it('warns about an unknown tile character instead of throwing', () => {
    const grid = new Grid(['#########', '#P..Z...#', '#########']);
    expect(grid.warnings.some((w) => w.includes('unknown tile character'))).toBe(true);
  });

  it('rejects a completely empty level', () => {
    expect(() => new Grid([])).toThrow(/non-empty/);
  });
});

describe('shipped level layout', () => {
  it('connects the spawn to every waypoint, every chip and the exit', () => {
    const grid = new Grid();
    const reachable = reachableFrom(grid, grid.spawn);

    for (const point of [...grid.waypoints, ...grid.chips, grid.exit]) {
      expect(
        reachable.has(`${point.cx},${point.cy}`),
        `(${point.cx}, ${point.cy}) should be walkable from the spawn`,
      ).toBe(true);
    }
  });

  it('leaves the spawn out of every waypoint tile so guards do not start on the player', () => {
    const grid = new Grid();
    const spawnKey = `${grid.spawn.cx},${grid.spawn.cy}`;
    const waypointKeys = grid.waypoints.map((w) => `${w.cx},${w.cy}`);
    expect(waypointKeys).not.toContain(spawnKey);
  });
});

describe('shipped level data', () => {
  it('is exactly the documented 25 x 18 grid', () => {
    expect(LEVEL_ROWS).toHaveLength(18);
    for (const line of LEVEL_ROWS) expect(line).toHaveLength(25);
  });
});
