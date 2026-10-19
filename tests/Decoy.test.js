import { describe, it, expect } from 'vitest';

import { Decoy, loudestNoise } from '../src/world/Decoy.js';
import { CONFIG } from '../src/config.js';

const SPECS = { x: 320, y: 240, radius: 170, duration: 3.5 };
const INSTANT = { x: 0, y: 0, radius: 10, duration: 1 };

describe('Decoy', () => {
  it('blares where it was dropped, and nowhere else', () => {
    const decoy = new Decoy(SPECS);

    expect(decoy.position).toEqual({ x: SPECS.x, y: SPECS.y });
    expect(decoy.noise).toEqual({ x: SPECS.x, y: SPECS.y, radius: SPECS.radius });
  });

  it('is active for exactly its battery, then is spent forever', () => {
    const decoy = new Decoy(SPECS);

    expect(decoy.active).toBe(true);
    expect(decoy.update(1)).toBe(true);
    expect(decoy.update(1)).toBe(true);
    expect(decoy.update(1)).toBe(true);
    expect(decoy.active).toBe(true);
    expect(decoy.update(1)).toBe(false);
    expect(decoy.active).toBe(false);
    expect(decoy.remaining).toBe(0);

    // Spent is a wall, not a suggestion: ticking time again cannot relight it.
    expect(decoy.update(1)).toBe(false);
    expect(decoy.active).toBe(false);
  });

  it('runs down the battery a second at a time, and reports it', () => {
    const decoy = new Decoy(INSTANT);

    decoy.update(0.25);
    expect(decoy.remaining).toBeCloseTo(0.75, 6);
    decoy.update(0.25);
    expect(decoy.remaining).toBeCloseTo(0.5, 6);
  });

  it('is not fooled by a negative step into rewinding its battery', () => {
    const decoy = new Decoy(INSTANT);

    decoy.update(0.9);
    decoy.update(-10); // junk dt is clamped by the scene, but a hostile step
    // must not push the battery back up either.

    expect(decoy.remaining).toBeCloseTo(0.1, 6);
    expect(decoy.active).toBe(true);

    // ...and the honest next step still finishes the battery on time.
    decoy.update(0.2);
    expect(decoy.active).toBe(false);
  });
});

describe('loudestNoise', () => {
  const PLAYER = { x: 10, y: 10, radius: 140 };
  const blaring = () => new Decoy({ x: 5, y: 5, radius: CONFIG.decoy.radius, duration: 5 });
  const spent = () => {
    const d = blaring();
    d.update(9);
    return d;
  };

  it('hands the player noise over when there is nothing on the floor', () => {
    expect(loudestNoise(PLAYER, [])).toEqual(PLAYER);
    expect(loudestNoise(PLAYER, [spent()])).toEqual(PLAYER);
  });

  it('drowns the player out while a decoy blares', () => {
    const noise = loudestNoise(PLAYER, [blaring()]);

    expect(noise.radius).toBeGreaterThan(PLAYER.radius);
    expect(noise.x).toBe(5);
    expect(noise.y).toBe(5);
  });

  it('passes silence through as silence, decoy or not', () => {
    expect(loudestNoise(null, [])).toBeNull();
    expect(loudestNoise(null, [spent()])).toBeNull();
  });

  it('hands exactly one sound back, however many decoys are blaring', () => {
    const noise = loudestNoise(PLAYER, [blaring(), blaring()]);

    expect(noise.radius).toBe(CONFIG.decoy.radius);
    expect(noise.x).toBe(5);
  });
});
