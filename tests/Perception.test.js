import { describe, it, expect } from 'vitest';

import { CONFIG } from '../src/config.js';
import { degToRad } from '../src/world/geometry.js';
import { Perception } from '../src/ai/Perception.js';

/** A guard at the origin, with the grid left out of it. */
const GUARD = { x: 0, y: 0 };

/** Faces east unless a test says otherwise. */
const EAST = 0;

function at(bearingDeg, distance) {
  const bearing = degToRad(bearingDeg);
  return { x: Math.cos(bearing) * distance, y: Math.sin(bearing) * distance };
}

describe('Perception', () => {
  it('sees a target dead ahead inside the sight range', () => {
    const perception = new Perception();
    const sight = perception.sense(GUARD, EAST, { x: 50, y: 0 });

    expect(sight.seen).toBe(true);
    expect(sight.inRange).toBe(true);
    expect(sight.inCone).toBe(true);
    expect(sight.distance).toBeCloseTo(50);
    expect(sight.angleOffset).toBeCloseTo(0);
  });

  it('cannot see a target behind it', () => {
    const perception = new Perception();
    const sight = perception.sense(GUARD, EAST, { x: -50, y: 0 });

    expect(sight.seen).toBe(false);
    expect(sight.inCone).toBe(false);
    expect(sight.inRange).toBe(true);
  });

  it('cannot see a target that is beyond the sight range', () => {
    const perception = new Perception();
    const sight = perception.sense(GUARD, EAST, at(0, CONFIG.enemy.sightRange + 1));

    expect(sight.seen).toBe(false);
    expect(sight.inRange).toBe(false);
    expect(sight.inCone).toBe(true);
  });

  it('counts the edge of the field of view as inside it', () => {
    const perception = new Perception();
    const half = CONFIG.enemy.fov / 2;

    expect(perception.sense(GUARD, EAST, at(half, 40)).inCone).toBe(true);
    expect(perception.sense(GUARD, EAST, at(-half, 40)).inCone).toBe(true);
    expect(perception.sense(GUARD, EAST, at(half + 1, 40)).inCone).toBe(false);
  });

  it('measures the angular offset the short way round the circle', () => {
    const perception = new Perception();
    // Facing 181 degrees, looking at a target on 179: the honest answer is a
    // 2 degree offset. Working out the difference without wrapping would give
    // roughly minus 360 degrees and put the target outside the cone.
    const sight = perception.sense(GUARD, degToRad(-179), at(179, 40));

    expect(Math.abs(sight.angleOffset)).toBeLessThan(degToRad(5));
    expect(sight.inCone).toBe(true);
  });

  it('reports the range limit it actually applied', () => {
    const perception = new Perception();
    expect(perception.sense(GUARD, EAST, { x: 10, y: 0 }).limit).toBe(CONFIG.enemy.sightRange);
  });

  it('lets an injected line-of-sight test veto a sighting', () => {
    const blocked = new Perception({ canSee: () => false });
    const sight = blocked.sense(GUARD, EAST, { x: 20, y: 0 });

    expect(sight.inRange).toBe(true);
    expect(sight.inCone).toBe(true);
    expect(sight.clearLine).toBe(false);
    expect(sight.seen).toBe(false);
  });

  it('passes the guard and the target to the line-of-sight test', () => {
    const calls = [];
    const perception = new Perception({
      canSee: (self, target) => {
        calls.push([self, target]);
        return true;
      },
    });

    const target = { x: 30, y: 10 };
    perception.sense(GUARD, EAST, target);

    expect(calls).toEqual([[GUARD, target]]);
  });

  it('defaults to a clear line when no test is injected', () => {
    const perception = new Perception();
    expect(perception.sense(GUARD, EAST, { x: 20, y: 0 }).clearLine).toBe(true);
  });

  it('accepts a custom range and field of view', () => {
    // Fresh instances, so the widowed runtime memory of one case cannot leak
    // into the next and turn a range check into a hysteresis check.
    const options = { range: 100, loseRange: 120, fov: 180 };

    expect(new Perception(options).sense(GUARD, EAST, { x: 90, y: 0 }).seen).toBe(true);
    expect(new Perception(options).sense(GUARD, EAST, { x: 130, y: 0 }).seen).toBe(false);
    // A 180 degree cone reaches a target directly above, but not one behind.
    expect(new Perception(options).sense(GUARD, EAST, { x: 0, y: 90 }).seen).toBe(true);
    expect(new Perception(options).sense(GUARD, EAST, { x: -90, y: 0 }).seen).toBe(false);
  });

  it('forgets that it had seen anything when reset', () => {
    const perception = new Perception();
    perception.sense(GUARD, EAST, { x: 20, y: 0 });

    expect(perception.wasVisible).toBe(true);

    perception.reset();

    expect(perception.wasVisible).toBe(false);
    expect(perception.lastSight).toBeNull();
  });
});
