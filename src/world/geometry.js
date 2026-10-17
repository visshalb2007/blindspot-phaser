/**
 * Hand-written geometry and small math helpers.
 *
 * Nothing here imports Phaser. Phaser does ship equivalents (`Angle.Between`,
 * `Geometry.Intersects.LineToRectangle`, `Math.Distance.Between`), but the AI
 * depends on these paths being correct and easy to reason about, so they are
 * written out and unit tested rather than delegated.
 */

/** Keeps `value` inside the inclusive range [min, max]. */
export function clamp(value, min, max) {
  if (value < min) return min;
  if (value > max) return max;
  return value;
}

export function length(x, y) {
  return Math.hypot(x, y);
}

export function distance(ax, ay, bx, by) {
  return Math.hypot(bx - ax, by - ay);
}

/**
 * Scales a vector to unit length.
 *
 * This is what stops a diagonal input from being ~41% faster than a straight
 * one: (1, 1) becomes (0.707, 0.707) so the total speed stays constant.
 * A zero vector is returned unchanged rather than producing NaN.
 */
export function normalize(x, y) {
  const len = Math.hypot(x, y);
  if (len === 0) return { x: 0, y: 0 };
  return { x: x / len, y: y / len };
}

/** Linear interpolation, unclamped so it can overshoot. */
export function lerp(from, to, t) {
  return from + (to - from) * t;
}
