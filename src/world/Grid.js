import { CONFIG } from '../config.js';
import { LEVEL_ROWS, LEGEND, isWaypointChar } from './LevelData.js';

export const TILE_KIND = Object.freeze({
  FLOOR: 0,
  WALL: 1,
});

/** The eight compass offsets, with their movement costs. */
const AROUND_8 = Object.freeze([
  [1, 0, 1],
  [-1, 0, 1],
  [0, 1, 1],
  [0, -1, 1],
  [1, 1, Math.SQRT2],
  [1, -1, Math.SQRT2],
  [-1, 1, Math.SQRT2],
  [-1, -1, Math.SQRT2],
]);

/**
 * Parsed, queryable view of the ASCII level.
 *
 * Everything downstream (line of sight, A\*, the path follower) asks the grid
 * questions rather than reading the raw strings, so "is this solid?" has
 * exactly one answer in the codebase.
 *
 * Pure JavaScript on purpose: no Phaser import, so the whole thing is unit
 * testable in Node.
 */
export class Grid {
  constructor(rows = LEVEL_ROWS) {
    if (!Array.isArray(rows) || rows.length === 0) {
      throw new Error('Grid requires a non-empty array of row strings');
    }

    const lengths = rows.map((row) => row.length);
    this.rows = rows.length;
    this.cols = Math.max(...lengths);
    this.tileSize = CONFIG.tile;

    this.tiles = new Uint8Array(this.cols * this.rows);
    this.waypoints = [];
    this.chips = [];
    this.spawn = null;
    this.exit = null;
    this.warnings = [];
    this._rawLengths = lengths;

    this._parse(rows);
    this._validate();
  }

  // ---------------------------------------------------------------- geometry

  inBounds(cx, cy) {
    return cx >= 0 && cy >= 0 && cx < this.cols && cy < this.rows;
  }

  index(cx, cy) {
    return cy * this.cols + cx;
  }

  /**
   * Out-of-bounds counts as solid. Every consumer (LOS, pathfinding, geometry)
   * then gets the same safe answer at the map edge instead of each one having
   * to remember its own bounds check.
   */
  isWall(cx, cy) {
    if (!this.inBounds(cx, cy)) return true;
    return this.tiles[this.index(cx, cy)] === TILE_KIND.WALL;
  }

  isWalkable(cx, cy) {
    return !this.isWall(cx, cy);
  }

  isWallAtWorld(x, y) {
    const { cx, cy } = this.worldToCell(x, y);
    return this.isWall(cx, cy);
  }

  worldToCell(x, y) {
    return {
      cx: Math.floor(x / this.tileSize),
      cy: Math.floor(y / this.tileSize),
    };
  }

  /**
   * Centre of a cell in world pixels - the convention A\* returns.
   */
  cellToWorld(cx, cy) {
    return {
      x: cx * this.tileSize + this.tileSize / 2,
      y: cy * this.tileSize + this.tileSize / 2,
    };
  }

  // -------------------------------------------------------------- navigation

  /**
   * The cells a guard may step to from here, eight-directionally.
   *
   * Diagonals are refused unless *both* orthogonal neighbours are also open.
   * Without that rule a guard would squeeze between two wall corners that meet
   * point to point, which looks like clipping through the wall.
   *
   * @returns {Array<{cx: number, cy: number, cost: number}>}
   */
  neighbours(cx, cy) {
    const out = [];

    for (const [dx, dy, cost] of AROUND_8) {
      const nx = cx + dx;
      const ny = cy + dy;

      if (this.isWall(nx, ny)) continue;

      if (dx !== 0 && dy !== 0 && (this.isWall(cx + dx, cy) || this.isWall(cx, cy + dy))) {
        continue;
      }

      out.push({ cx: nx, cy: ny, cost });
    }

    return out;
  }

  /**
   * True when a straight world-space segment stays over floor tiles.
   *
   * Walks the segment in quarter-tile samples. Whenever the sample crosses into
   * a new cell diagonally, the two orthogonal cells are checked too, so this
   * agrees with `neighbours()` about what counts as a corner cut. Used to
   * straighten A\* output into a shorter, less robotic route.
   */
  lineIsWalkable(ax, ay, bx, by) {
    const start = this.worldToCell(ax, ay);
    if (this.isWall(start.cx, start.cy)) return false;

    const distance = Math.hypot(bx - ax, by - ay);
    const steps = Math.max(1, Math.ceil(distance / (this.tileSize / 4)));

    let prev = start;

    for (let i = 1; i <= steps; i += 1) {
      const t = i / steps;
      const cell = this.worldToCell(ax + (bx - ax) * t, ay + (by - ay) * t);

      if (this.isWall(cell.cx, cell.cy)) return false;

      const dx = cell.cx - prev.cx;
      const dy = cell.cy - prev.cy;

      if (dx !== 0 && dy !== 0) {
        if (this.isWall(prev.cx + dx, prev.cy) || this.isWall(prev.cx, prev.cy + dy)) {
          return false;
        }
      }

      prev = cell;
    }

    return true;
  }

  // ------------------------------------------------------------------ parsing

  _parse(rows) {
    for (let cy = 0; cy < rows.length; cy += 1) {
      const row = rows[cy];

      for (let cx = 0; cx < row.length; cx += 1) {
        const char = row[cx];
        const i = this.index(cx, cy);

        if (char === LEGEND.WALL) {
          this.tiles[i] = TILE_KIND.WALL;
          continue;
        }

        // Everything else is standable ground with an optional marker on it.
        this.tiles[i] = TILE_KIND.FLOOR;

        if (char === LEGEND.SPAWN) {
          this.spawn = { cx, cy, ...this.cellToWorld(cx, cy) };
        } else if (char === LEGEND.EXIT) {
          this.exit = { cx, cy, ...this.cellToWorld(cx, cy) };
        } else if (char === LEGEND.CHIP) {
          this.chips.push({ cx, cy, ...this.cellToWorld(cx, cy) });
        } else if (isWaypointChar(char)) {
          this.waypoints.push({
            order: Number(char),
            cx,
            cy,
            ...this.cellToWorld(cx, cy),
          });
        } else if (char !== LEGEND.FLOOR) {
          this.warnings.push(`unknown tile character "${char}" at (${cx}, ${cy})`);
        }
      }
    }

    this.waypoints.sort((a, b) => a.order - b.order);
  }

  _validate() {
    const expected = this._rawLengths[0];

    this._rawLengths.forEach((len, cy) => {
      if (len !== expected) {
        this.warnings.push(`row ${cy} is ${len} tiles wide, expected ${expected}`);
      }
    });

    if (!this.spawn) {
      this.warnings.push('no player spawn "P" in the level; falling back to the first floor tile');
      this.spawn = this._firstFloor();
    }

    if (!this.exit) {
      this.warnings.push('no exit "E" in the level; the win condition is unreachable');
    }

    if (this.waypoints.length < 2) {
      this.warnings.push(
        `only ${this.waypoints.length} waypoint(s); guards will use the look-around fallback`,
      );
    }

    for (const wp of this.waypoints) {
      if (this._floorNeighbourCount(wp.cx, wp.cy) === 0) {
        this.warnings.push(`waypoint ${wp.order} at (${wp.cx}, ${wp.cy}) is walled in on all sides`);
      }
    }
  }

  _firstFloor() {
    for (let cy = 0; cy < this.rows; cy += 1) {
      for (let cx = 0; cx < this.cols; cx += 1) {
        if (this.isWalkable(cx, cy)) return { cx, cy, ...this.cellToWorld(cx, cy) };
      }
    }
    return { cx: 0, cy: 0, x: 0, y: 0 };
  }

  _floorNeighbourCount(cx, cy) {
    const dirs = [
      [1, 0],
      [-1, 0],
      [0, 1],
      [0, -1],
    ];
    return dirs.reduce(
      (count, [dx, dy]) => count + (this.isWalkable(cx + dx, cy + dy) ? 1 : 0),
      0,
    );
  }
}

export default Grid;
