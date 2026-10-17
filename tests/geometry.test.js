import { describe, it, expect } from 'vitest';

import { clamp, distance, length, lerp, normalize } from '../src/world/geometry.js';

describe('clamp', () => {
  it('keeps a value inside the range', () => {
    expect(clamp(5, 0, 10)).toBe(5);
  });

  it('pulls out-of-range values back to the nearest bound', () => {
    expect(clamp(-3, 0, 10)).toBe(0);
    expect(clamp(42, 0, 10)).toBe(10);
  });

  it('treats the bounds themselves as inside', () => {
    expect(clamp(0, 0, 10)).toBe(0);
    expect(clamp(10, 0, 10)).toBe(10);
  });
});

describe('normalize', () => {
  it('returns a unit vector', () => {
    const v = normalize(3, 4);
    expect(length(v.x, v.y)).toBeCloseTo(1, 12);
    expect(v.x).toBeCloseTo(0.6, 12);
    expect(v.y).toBeCloseTo(0.8, 12);
  });

  it('gives a diagonal input the same length as a straight one', () => {
    const straight = normalize(1, 0);
    const diagonal = normalize(1, 1);

    expect(length(diagonal.x, diagonal.y)).toBeCloseTo(length(straight.x, straight.y), 12);
  });

  it('leaves a straight input pointing the same way', () => {
    expect(normalize(5, 0)).toEqual({ x: 1, y: 0 });
    expect(normalize(0, -5)).toEqual({ x: 0, y: -1 });
  });

  it('returns a zero vector for zero input instead of NaN from a divide by zero', () => {
    const v = normalize(0, 0);
    expect(v).toEqual({ x: 0, y: 0 });
    expect(Number.isNaN(v.x)).toBe(false);
    expect(Number.isNaN(v.y)).toBe(false);
  });
});

describe('distance and length', () => {
  it('measures a straight line', () => {
    expect(distance(0, 0, 3, 4)).toBe(5);
    expect(length(6, 8)).toBe(10);
  });

  it('is zero for identical points', () => {
    expect(distance(7, 7, 7, 7)).toBe(0);
  });
});

describe('lerp', () => {
  it('hits both ends exactly', () => {
    expect(lerp(10, 20, 0)).toBe(10);
    expect(lerp(10, 20, 1)).toBe(20);
  });

  it('interpolates in the middle and is allowed to overshoot', () => {
    expect(lerp(0, 10, 0.5)).toBe(5);
    expect(lerp(0, 10, 2)).toBe(20);
  });
});
