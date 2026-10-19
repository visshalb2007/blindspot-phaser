/**
 * Fast 2D DDA raycaster and field-of-view cone generator.
 *
 * Casts rays across the tile grid to produce clean vision polygons that stop
 * precisely at wall surfaces. Pure JavaScript, zero Phaser dependencies.
 */

/**
 * Casts a single ray from an origin at a given angle through the tile grid.
 *
 * @param {{x: number, y: number}} origin observer world position
 * @param {number} angle ray heading in radians
 * @param {number} maxRange maximum travel distance in pixels
 * @param {import('./Grid.js').Grid|null} grid tile grid
 * @returns {{x: number, y: number, dist: number, hitWall: boolean}}
 */
export function castRay(origin, angle, maxRange, grid) {
  const x0 = origin.x;
  const y0 = origin.y;
  const dx = Math.cos(angle);
  const dy = Math.sin(angle);

  if (!grid || typeof grid.isWall !== 'function') {
    return {
      x: x0 + dx * maxRange,
      y: y0 + dy * maxRange,
      dist: maxRange,
      hitWall: false,
    };
  }

  const tile = grid.tileSize ?? 32;

  let cx = Math.floor(x0 / tile);
  let cy = Math.floor(y0 / tile);

  if (grid.isWall(cx, cy)) {
    return { x: x0, y: y0, dist: 0, hitWall: true };
  }

  const stepX = dx >= 0 ? 1 : -1;
  const stepY = dy >= 0 ? 1 : -1;

  const deltaDistX = Math.abs(dx) > 1e-7 ? Math.abs(tile / dx) : Infinity;
  const deltaDistY = Math.abs(dy) > 1e-7 ? Math.abs(tile / dy) : Infinity;

  let sideDistX;
  if (dx > 0) {
    sideDistX = ((cx + 1) * tile - x0) / dx;
  } else if (dx < 0) {
    const rem = x0 - cx * tile;
    sideDistX = (rem === 0 ? tile : rem) / -dx;
  } else {
    sideDistX = Infinity;
  }

  let sideDistY;
  if (dy > 0) {
    sideDistY = ((cy + 1) * tile - y0) / dy;
  } else if (dy < 0) {
    const rem = y0 - cy * tile;
    sideDistY = (rem === 0 ? tile : rem) / -dy;
  } else {
    sideDistY = Infinity;
  }

  let dist = 0;
  let hitWall = false;
  const maxSteps = Math.ceil(maxRange / tile) + 3;

  for (let s = 0; s < maxSteps; s += 1) {
    if (sideDistX < sideDistY) {
      dist = sideDistX;
      sideDistX += deltaDistX;
      cx += stepX;
    } else {
      dist = sideDistY;
      sideDistY += deltaDistY;
      cy += stepY;
    }

    if (dist >= maxRange) {
      dist = maxRange;
      break;
    }

    if (grid.isWall(cx, cy)) {
      hitWall = true;
      break;
    }
  }

  if (dist > maxRange) {
    dist = maxRange;
    hitWall = false;
  }

  return {
    x: x0 + dx * dist,
    y: y0 + dy * dist,
    dist,
    hitWall,
  };
}

/**
 * Computes polygon points for a vision cone stopping at walls.
 *
 * @param {{x: number, y: number}} origin
 * @param {number} heading in radians
 * @param {number} fovDegrees in degrees
 * @param {number} sightRange in pixels
 * @param {import('./Grid.js').Grid|null} grid
 * @param {number} rayCount number of rays across the arc
 * @returns {{ outer: Array<{x: number, y: number, dist: number, hitWall: boolean}>, inner: Array<{x: number, y: number, dist: number, hitWall: boolean}> }}
 */
export function computeVisionCone(
  origin,
  heading,
  fovDegrees,
  sightRange,
  grid,
  rayCount = 36,
) {
  const fovRad = (fovDegrees * Math.PI) / 180;
  const halfFov = fovRad / 2;
  const count = Math.max(3, rayCount);
  const step = fovRad / (count - 1);

  const outer = [];
  for (let i = 0; i < count; i += 1) {
    const angle = heading - halfFov + i * step;
    outer.push(castRay(origin, angle, sightRange, grid));
  }

  // Inner beam core: focused central 45% of the FOV at 85% range
  const innerFovRad = fovRad * 0.45;
  const innerHalf = innerFovRad / 2;
  const innerCount = Math.max(3, Math.round(count * 0.5));
  const innerStep = innerFovRad / (innerCount - 1);
  const innerRange = sightRange * 0.85;

  const inner = [];
  for (let i = 0; i < innerCount; i += 1) {
    const angle = heading - innerHalf + i * innerStep;
    inner.push(castRay(origin, angle, innerRange, grid));
  }

  return { outer, inner };
}
