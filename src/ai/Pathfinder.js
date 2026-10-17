import { PriorityQueue } from './PriorityQueue.js';

const SQRT2 = Math.SQRT2;

/**
 * A\* over the tile grid, eight-directionally.
 *
 * Written from scratch rather than pulled in as a library, because the parts
 * that matter here are the parts a library hides: where the heuristic comes
 * from, why corner cutting is banned, and what to do when the goal cannot be
 * reached at all.
 *
 * Returns tile centres in world pixels, and never includes the cell the agent
 * is already standing in - the follower should look ahead, not walk backwards
 * to its own centre.
 *
 * Pure JavaScript, no Phaser import.
 */
export class Pathfinder {
  constructor(grid, { maxNodes = 4000 } = {}) {
    this.grid = grid;
    this.maxNodes = maxNodes;
    this.lastSearch = { visited: 0, reached: false, cells: 0, points: 0 };
  }

  /**
   * Octile distance: the exact cost of an unobstructed eight-directional walk.
   *
   * Because it is exact for an empty grid it can never overestimate the real
   * cost, which is the property A\* needs to return a shortest path. Straight
   * or Manhattan distance would both overestimate here (Manhattan badly, on
   * open ground) and turn A\* into a greedy search.
   */
  heuristic(cx, cy, gx, gy) {
    const dx = Math.abs(cx - gx);
    const dy = Math.abs(cy - gy);
    return Math.max(dx, dy) + (SQRT2 - 1) * Math.min(dx, dy);
  }

  /**
   * @param {{x: number, y: number}} from world position
   * @param {{x: number, y: number}} to world position
   * @returns {{path: Array<{x: number, y: number}>, reached: boolean, visited: number, goal: {cx: number, cy: number}}}
   *   When the goal is unreachable, `path` leads to the closest cell the search
   *   actually reached and `reached` is false.
   */
  findPath(from, to, { maxNodes = this.maxNodes } = {}) {
    const grid = this.grid;

    const start = this._nearestWalkable(grid.worldToCell(from.x, from.y));
    const goal = this._nearestWalkable(grid.worldToCell(to.x, to.y));

    const startKey = this._key(start.cx, start.cy);
    const goalKey = this._key(goal.cx, goal.cy);

    if (startKey === goalKey) {
      const only = grid.cellToWorld(goal.cx, goal.cy);
      this.lastSearch = { visited: 1, reached: true, cells: 1, points: 1 };
      return { path: [only], reached: true, visited: 1, goal };
    }

    const open = new PriorityQueue();
    const gScore = new Map([[startKey, 0]]);
    const cameFrom = new Map();
    const cells = new Map([[startKey, start]]);
    const closed = new Set();

    open.push(start, this.heuristic(start.cx, start.cy, goal.cx, goal.cy));

    let visited = 0;
    let best = start;
    let bestH = this.heuristic(start.cx, start.cy, goal.cx, goal.cy);
    let reached = false;

    while (!open.isEmpty && visited < maxNodes) {
      const current = open.pop();
      const currentKey = this._key(current.cx, current.cy);

      // A heap cannot decrease a key in place, so a cell can be queued more
      // than once. Anything already expanded is a stale duplicate.
      if (closed.has(currentKey)) continue;
      closed.add(currentKey);
      visited += 1;

      const h = this.heuristic(current.cx, current.cy, goal.cx, goal.cy);
      if (h < bestH) {
        bestH = h;
        best = current;
      }

      if (currentKey === goalKey) {
        reached = true;
        break;
      }

      const g = gScore.get(currentKey);

      for (const neighbour of grid.neighbours(current.cx, current.cy)) {
        const key = this._key(neighbour.cx, neighbour.cy);
        if (closed.has(key)) continue;

        const tentative = g + neighbour.cost;
        const known = gScore.get(key);
        if (known !== undefined && tentative >= known) continue;

        gScore.set(key, tentative);
        cameFrom.set(key, current);
        cells.set(key, neighbour);
        open.push(
          neighbour,
          tentative + this.heuristic(neighbour.cx, neighbour.cy, goal.cx, goal.cy),
        );
      }
    }

    const end = reached ? goal : best;
    const raw = this._reconstruct(cells, cameFrom, startKey, this._key(end.cx, end.cy));
    const path = this._smooth(raw);

    this.lastSearch = { visited, reached, cells: raw.length, points: path.length };

    return { path, reached, visited, goal: end };
  }

  /** Cell index packed into one integer, so the maps stay cheap. */
  _key(cx, cy) {
    return cy * this.grid.cols + cx;
  }

  /**
   * Walks parents back from the goal and returns world points, oldest first.
   * The starting cell is deliberately left out.
   */
  _reconstruct(cells, cameFrom, startKey, endKey) {
    const points = [];
    let key = endKey;
    let guard = 0;

    while (key !== startKey && guard <= this.grid.cols * this.grid.rows) {
      const cell = cells.get(key);
      if (!cell) break;

      points.push(this.grid.cellToWorld(cell.cx, cell.cy));

      const parent = cameFrom.get(key);
      if (!parent) break;

      key = this._key(parent.cx, parent.cy);
      guard += 1;
    }

    points.reverse();
    return points;
  }

  /**
   * Greedy string-pulling: keep the furthest ahead point that still has a clear
   * straight line from the last kept one. Turns the staircase A\* produces into
   * long diagonals, which stops a guard visibly zig-zagging down a corridor.
   */
  _smooth(points) {
    if (points.length <= 2) return points;

    const grid = this.grid;
    const out = [points[0]];
    let anchor = 0;

    for (let i = 2; i < points.length; i += 1) {
      const clear = grid.lineIsWalkable(points[anchor].x, points[anchor].y, points[i].x, points[i].y);

      if (!clear) {
        out.push(points[i - 1]);
        anchor = i - 1;
      }
    }

    out.push(points[points.length - 1]);
    return out;
  }

  /**
   * Snaps a cell onto the nearest walkable tile by spiralling outwards.
   *
   * A start or goal inside a wall is not a reason to crash or to return no
   * path: the caller gets the closest legal stand-in instead.
   */
  _nearestWalkable(cell) {
    if (this.grid.isWalkable(cell.cx, cell.cy)) return cell;

    const maxRadius = Math.max(this.grid.cols, this.grid.rows);

    for (let r = 1; r <= maxRadius; r += 1) {
      for (let dy = -r; dy <= r; dy += 1) {
        for (let dx = -r; dx <= r; dx += 1) {
          if (Math.max(Math.abs(dx), Math.abs(dy)) !== r) continue;

          const cx = cell.cx + dx;
          const cy = cell.cy + dy;
          if (this.grid.isWalkable(cx, cy)) return { cx, cy };
        }
      }
    }

    return cell;
  }
}

export default Pathfinder;
