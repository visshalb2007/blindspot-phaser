import { describe, it, expect } from 'vitest';

import { Grid } from '../src/world/Grid.js';
import { castRay, computeVisionCone } from '../src/world/VisionCone.js';

const ROOM = [
  '#######',
  '#.....#',
  '#.#...#',
  '#.....#',
  '#######',
];

describe('VisionCone raycasting', () => {
  it('travels full distance in open space', () => {
    const grid = new Grid(ROOM);
    // (1, 1) cell world center: x = 1.5 * 32 = 48, y = 48
    // Shooting right along row 1 (columns 1, 2, 3, 4, 5 are open, 6 is wall at x=192)
    // Distance from 48 to 192 is 144
    const ray = castRay({ x: 48, y: 48 }, 0, 80, grid);
    expect(ray.dist).toBeCloseTo(80);
    expect(ray.hitWall).toBe(false);
    expect(ray.x).toBeCloseTo(128);
    expect(ray.y).toBeCloseTo(48);
  });

  it('stops cleanly at vertical wall surface', () => {
    const grid = new Grid(ROOM);
    // Wall is at col 6 (x starts at 6 * 32 = 192)
    const ray = castRay({ x: 48, y: 48 }, 0, 200, grid);
    expect(ray.hitWall).toBe(true);
    expect(ray.dist).toBeCloseTo(144);
    expect(ray.x).toBeCloseTo(192);
    expect(ray.y).toBeCloseTo(48);
  });

  it('stops cleanly at horizontal wall surface', () => {
    const grid = new Grid(ROOM);
    // Wall above is at row 0 (y ends at 1 * 32 = 32)
    // Shooting up (-PI/2) from y = 48
    const ray = castRay({ x: 48, y: 48 }, -Math.PI / 2, 100, grid);
    expect(ray.hitWall).toBe(true);
    expect(ray.dist).toBeCloseTo(16);
    expect(ray.x).toBeCloseTo(48);
    expect(ray.y).toBeCloseTo(32);
  });

  it('stops at obstacle pillar in the room', () => {
    const grid = new Grid(ROOM);
    // Pillar is at col 2, row 2 (x: 64..96, y: 64..96)
    // From col 2, row 1 (x: 80, y: 48), shooting down (+PI/2)
    const ray = castRay({ x: 80, y: 48 }, Math.PI / 2, 100, grid);
    expect(ray.hitWall).toBe(true);
    expect(ray.dist).toBeCloseTo(16);
    expect(ray.x).toBeCloseTo(80);
    expect(ray.y).toBeCloseTo(64);
  });

  it('handles null grid safely', () => {
    const ray = castRay({ x: 100, y: 100 }, 0, 50, null);
    expect(ray.hitWall).toBe(false);
    expect(ray.dist).toBe(50);
    expect(ray.x).toBe(150);
    expect(ray.y).toBe(100);
  });

  it('computes outer and inner cone polygons matching FOV', () => {
    const grid = new Grid(ROOM);
    const cone = computeVisionCone({ x: 48, y: 48 }, 0, 90, 80, grid, 9);
    expect(cone.outer.length).toBe(9);
    expect(cone.inner.length).toBeGreaterThanOrEqual(3);

    // Center ray of outer cone should be along heading 0
    const centerOuter = cone.outer[4];
    expect(centerOuter.x).toBeGreaterThan(48);
    expect(centerOuter.y).toBeCloseTo(48);
  });
});
