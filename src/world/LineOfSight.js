/**
 * Can one point see another across the tile grid?
 *
 * This is the third test in `Perception` (range, cone, line) and the one that
 * makes a wall mean something. It is deliberately a separate module from
 * `Grid.lineIsWalkable`, even though both walk a line across the same cells,
 * because they answer different questions:
 *
 *   - `Grid.lineIsWalkable` is about *movement*. It is what A\* uses to
 *     straighten a route, so it has to be conservative: a route that grazes a
 *     wall corner would have the guard's shoulders clipping through it.
 *   - `LineOfSight.canSee` is about *sight*. It is an eye ray between two
 *     points, it never has to account for the guard's width, and it reports
 *     *where* the view was cut short so the debug overlay can draw it.
 *
 * Pure JavaScript, no Phaser import.
 */
export class LineOfSight {
  /**
   * @param {import('./Grid.js').Grid} grid
   */
  constructor(grid) {
    this.grid = grid;
  }

  /**
   * @param {{x: number, y: number}} from the observer
   * @param {{x: number, y: number}} to what it is looking at
   * @returns {boolean} true when no wall stands between the two
   */
  canSee(from, to) {
    return this.trace(from, to).clear;
  }

  /**
   * Walks the ray cell by cell.
   *
   * @returns {{clear: boolean, blockedAt: {cx: number, cy: number}|null, cells: Array<{cx: number, cy: number}>}}
   *   `cells` is every cell the ray entered after the observer's own, oldest
   *   first, ending at the cell that blocked it when one did.
   */
  trace(from, to) {
    const grid = this.grid;
    const start = grid.worldToCell(from.x, from.y);
    const end = grid.worldToCell(to.x, to.y);

    const dx = end.cx - start.cx;
    const dy = end.cy - start.cy;
    const nx = Math.abs(dx);
    const ny = Math.abs(dy);
    const sx = Math.sign(dx);
    const sy = Math.sign(dy);

    const cells = [];

    // The observer's own cell is never reported: a guard standing in a doorway
    // is touching the wall beside it and must not be blinded by it.
    let cx = start.cx;
    let cy = start.cy;
    let ix = 0;
    let iy = 0;

    while (ix < nx || iy < ny) {
      // Integer-only decision variable, so the ray is identical on every
      // machine and cannot drift through a wall on a floating point rounding.
      // Zero means the ray passes exactly through the corner shared by four
      // cells: it steps diagonally and the two cells being cut across are
      // checked below.
      const decision = (1 + 2 * ix) * ny - (1 + 2 * iy) * nx;
      const prevX = cx;
      const prevY = cy;
      let diagonal = false;

      if (decision === 0) {
        cx += sx;
        cy += sy;
        ix += 1;
        iy += 1;
        diagonal = true;
      } else if (decision < 0) {
        cx += sx;
        ix += 1;
      } else {
        cy += sy;
        iy += 1;
      }

      const cell = { cx, cy };
      cells.push(cell);

      if (grid.isWall(cx, cy)) {
        return { clear: false, blockedAt: cell, cells };
      }

      // A diagonal step into the gap between two walls. Squeezing through a
      // corner that only touches at a point is not something an eye can do, so
      // either flanking wall cuts the view - the same rule A\* applies to
      // movement, which keeps sight and routes agreeing about that corner.
      if (diagonal) {
        if (grid.isWall(prevX + sx, prevY)) {
          return { clear: false, blockedAt: { cx: prevX + sx, cy: prevY }, cells };
        }

        if (grid.isWall(prevX, prevY + sy)) {
          return { clear: false, blockedAt: { cx: prevX, cy: prevY + sy }, cells };
        }
      }
    }

    return { clear: true, blockedAt: null, cells };
  }
}

export default LineOfSight;
