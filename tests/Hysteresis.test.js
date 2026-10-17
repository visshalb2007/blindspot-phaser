import { describe, it, expect } from 'vitest';

import { CONFIG } from '../src/config.js';
import { Perception } from '../src/ai/Perception.js';

const GUARD = { x: 0, y: 0 };
const EAST = 0;

const sightAt = (distance) => ({ x: distance, y: 0 });

/**
 * The sight range is the distance at which a guard *acquires* a target; the
 * lose range is the wider distance at which it *keeps* one. Tests here are
 * about that memory, not about the range and cone maths, which
 * `Perception.test.js` covers.
 */
describe('sight hysteresis', () => {
  it('uses the tighter range before the target has been spotted', () => {
    const perception = new Perception();
    const between = (CONFIG.enemy.sightRange + CONFIG.enemy.loseRange) / 2;

    const sight = perception.sense(GUARD, EAST, sightAt(between));

    expect(sight.inRange).toBe(false);
    expect(sight.seen).toBe(false);
    expect(sight.limit).toBe(CONFIG.enemy.sightRange);
  });

  it('keeps a target it has already spotted out to the lose range', () => {
    const perception = new Perception();
    const between = (CONFIG.enemy.sightRange + CONFIG.enemy.loseRange) / 2;

    // Acquired inside the sight range...
    expect(perception.sense(GUARD, EAST, sightAt(CONFIG.enemy.sightRange - 1)).seen).toBe(true);

    // ...and the player then backs away through the boundary.
    const sight = perception.sense(GUARD, EAST, sightAt(between));

    expect(sight.seen).toBe(true);
    expect(sight.inRange).toBe(true);
    expect(sight.limit).toBe(CONFIG.enemy.loseRange);
  });

  it('drops the target once it is past the lose range', () => {
    const perception = new Perception();

    perception.sense(GUARD, EAST, sightAt(CONFIG.enemy.sightRange - 1));

    const sight = perception.sense(GUARD, EAST, sightAt(CONFIG.enemy.loseRange + 1));

    expect(sight.seen).toBe(false);
    expect(sight.inRange).toBe(false);
  });

  it('forgets the widened range as soon as sight is lost', () => {
    const perception = new Perception();

    perception.sense(GUARD, EAST, sightAt(CONFIG.enemy.sightRange - 1));
    perception.sense(GUARD, EAST, sightAt(CONFIG.enemy.loseRange + 1));

    // Back inside the extra margin, but no longer grandfathered in.
    const between = (CONFIG.enemy.sightRange + CONFIG.enemy.loseRange) / 2;
    expect(perception.sense(GUARD, EAST, sightAt(between)).seen).toBe(false);
    expect(perception.sense(GUARD, EAST, sightAt(between)).limit).toBe(CONFIG.enemy.sightRange);
  });

  it('does not strobe on and off while the player hovers on the boundary', () => {
    const perception = new Perception();

    // Acquire, then jitter either side of the acquisition range the way a
    // player shuffling on the spot would.
    perception.sense(GUARD, EAST, sightAt(CONFIG.enemy.sightRange - 5));

    const verdicts = [];
    for (let i = 0; i < 40; i += 1) {
      const distance = CONFIG.enemy.sightRange + (i % 2 === 0 ? 5 : -5);
      verdicts.push(perception.sense(GUARD, EAST, sightAt(distance)).seen);
    }

    expect(verdicts.every(Boolean)).toBe(true);
  });

  it('loses a target that steps out of the field of view even if it is close', () => {
    const perception = new Perception();
    const behind = { x: -20, y: 0 };

    perception.sense(GUARD, EAST, { x: 20, y: 0 });

    // Hysteresis widens the range, never the cone.
    expect(perception.sense(GUARD, EAST, behind).seen).toBe(false);
  });

  it('loses a target that steps behind a wall even if it is in the cone', () => {
    let blocked = false;
    const perception = new Perception({ canSee: () => !blocked });

    expect(perception.sense(GUARD, EAST, { x: 20, y: 0 }).seen).toBe(true);

    blocked = true;
    const sight = perception.sense(GUARD, EAST, { x: 20, y: 0 });

    expect(sight.inRange).toBe(true);
    expect(sight.inCone).toBe(true);
    expect(sight.seen).toBe(false);
  });
});
