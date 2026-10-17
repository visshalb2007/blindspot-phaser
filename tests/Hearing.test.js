import { describe, it, expect } from 'vitest';

import { CONFIG } from '../src/config.js';
import { Hearing } from '../src/ai/Hearing.js';

/** A guard standing at the origin, listening. */
const guard = { x: 0, y: 0 };

/** A noise `distance` px away that carries for `radius`. */
function noiseAt(distance, radius = 100) {
  return { x: distance, y: 0, radius };
}

describe('Hearing', () => {
  it('does not hear a silent player at all', () => {
    const report = new Hearing().listen(guard, noiseAt(1, CONFIG.player.noise.sneak));

    expect(report.heard).toBe(false);
    expect(report.rate).toBe(0);
  });

  it('does not hear a noise that has stopped', () => {
    expect(new Hearing().listen(guard, null).heard).toBe(false);
  });

  it('hears a noise inside its radius, but not one at the rim', () => {
    const hearing = new Hearing();

    expect(hearing.listen(guard, noiseAt(99)).heard).toBe(true);

    const rim = hearing.listen(guard, noiseAt(100));
    expect(rim.heard).toBe(false);
    expect(rim.distance).toBe(100);
  });

  it('grows louder the closer the guard stands', () => {
    const hearing = new Hearing();

    const near = hearing.listen(guard, noiseAt(10));
    const far = hearing.listen(guard, noiseAt(80));

    expect(near.loudness).toBeCloseTo(0.9, 6);
    expect(far.loudness).toBeCloseTo(0.2, 6);
    expect(near.rate).toBeGreaterThan(far.rate);
  });

  it('is at its loudest at the source', () => {
    expect(new Hearing().listen(guard, noiseAt(0)).loudness).toBe(1);
  });

  it('reports the distance in whole pixels, the way sight does', () => {
    expect(new Hearing().listen(guard, noiseAt(42)).distance).toBe(42);
  });

  it('scales the rate by the gain', () => {
    const hearing = new Hearing({ gain: 10 });
    expect(hearing.listen(guard, noiseAt(50)).rate).toBeCloseTo(5, 6);
  });

  it('uses the configured gain and muffle by default', () => {
    const hearing = new Hearing();

    expect(hearing.gain).toBe(CONFIG.enemy.hearingGain);
    expect(hearing.muffled).toBe(CONFIG.enemy.hearingMuffled);
  });

  it('takes most of the volume out of a noise through a wall', () => {
    const clear = new Hearing().listen(guard, noiseAt(50));
    const muffled = new Hearing({ blocked: () => true }).listen(guard, noiseAt(50));

    expect(muffled.heard).toBe(true);
    expect(muffled.muffled).toBe(true);
    expect(muffled.rate).toBeCloseTo(clear.rate * CONFIG.enemy.hearingMuffled, 6);
  });

  it('still hears through a wall what it could not see', () => {
    // The whole reason hearing exists: noticing what is around a corner.
    const hearing = new Hearing({ blocked: () => true });
    expect(hearing.listen(guard, noiseAt(30)).heard).toBe(true);
  });

  it('asks the wall test about the two points it was given', () => {
    const asked = [];
    const hearing = new Hearing({
      blocked: (from, to) => {
        asked.push([from, to]);
        return false;
      },
    });

    hearing.listen(guard, noiseAt(50));

    expect(asked.length).toBe(1);
    expect(asked[0][0]).toBe(guard);
    expect(asked[0][1].x).toBe(50);
  });
});
