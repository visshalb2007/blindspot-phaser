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

export const TAU = Math.PI * 2;

export function degToRad(degrees) {
  return (degrees * Math.PI) / 180;
}

export function radToDeg(radians) {
  return (radians * 180) / Math.PI;
}

/**
 * Signed shortest difference between two angles, in the range (-PI, PI].
 *
 * The naive `a - b` is wrong across the wrap point: 179 degrees and -179
 * degrees are two degrees apart, but subtracting gives 358. Because guards
 * face every direction over a patrol, every cone test goes through here.
 * Phaser's `Angle.ShortestBetween` would do the job, but the AI depends on
 * this being right, so it is written out and unit tested.
 */
export function angleDifference(a, b) {
  let diff = (a - b) % TAU;
  if (diff > Math.PI) diff -= TAU;
  if (diff < -Math.PI) diff += TAU;
  return diff;
}
