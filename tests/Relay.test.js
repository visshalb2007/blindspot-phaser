import { describe, it, expect } from 'vitest';

import { EnemyBrain } from '../src/ai/EnemyBrain.js';
import { STATE } from '../src/ai/states.js';
import { CONFIG } from '../src/config.js';

/**
 * A field a guard can be stepped across without a grid: flat, open, and big
 * enough that two waypoints make a real route.
 */
function field() {
  return {
    waypoints: [
      { order: 0, x: 100, y: 100 },
      { order: 1, x: 400, y: 100 },
    ],
  };
}

function guard(x, y, heading = 0, tuning = null) {
  const { waypoints } = field();
  return new EnemyBrain({ x, y, heading, waypoints, tuning });
}

describe('the alarm relay', () => {
  it('turns nothing into intel when handed nothing to relay', () => {
    const brain = guard(0, 0);

    expect(brain.relayIntel(null)).toBe(false);
    expect(brain.hasHunch).toBe(false);
    expect(brain.alertness.isSuspicious).toBe(false);
  });

  it('leaves a place worth looking at and a meter worth acting on', () => {
    const brain = guard(0, 0);

    expect(brain.relayIntel({ x: 320, y: 240 })).toBe(true);

    // The shout carries the place, not the person: nobody was seen, so nobody
    // is being chased - a hunch and a lifted meter is the whole message.
    expect(brain.lastKnownPos).toEqual({ x: 320, y: 240 });
    expect(brain.hasHunch).toBe(true);
    expect(brain.alertness.isSuspicious).toBe(true);
    expect(brain.alertness.isAlarmed).toBe(false);
  });

  it('raises a guard rather than lowering one: a shouted meter only ever lifts', () => {
    const brain = guard(0, 0);

    // Half-warm already, then relayed: whatever lands must not pull it down.
    brain.alertness.raiseTo(brain.alertness.suspiciousAt - 5);
    brain.relayIntel({ x: 320, y: 240 });

    // The shout lands above the suspicion threshold with a second's worth of
    // silence paid up front - and nowhere near the chase threshold.
    expect(brain.alertness.value).toBe(brain.alertness.suspiciousAt + brain.alertness.decay);
    expect(brain.alertness.isAlarmed).toBe(false);
  });

  it('is heard by the state machine: a calm guard goes looking', () => {
    const brain = guard(100, 100, 0);
    expect(brain.state).toBe(STATE.PATROL);

    brain.relayIntel({ x: 500, y: 100 });

    // Enough steps to clear the state machine's own minimum-lifetime floor:
    // nothing can be seen - no target is anywhere a ray reaches - so whatever
    // happens next happened because the relay said so.
    for (let i = 0; i < 120; i += 1) {
      brain.update(1 / 60, { x: -1e6, y: -1e6 }, null);
    }

    expect(brain.state).not.toBe(STATE.PATROL);
    expect(brain.alertness.isAlarmed).toBe(false);
  });

  it('does not chase on intel alone, however loud the floor is', () => {
    const brain = guard(100, 100);
    brain.relayIntel({ x: 500, y: 100 });

    for (let i = 0; i < 120; i += 1) {
      brain.update(1 / 60, { x: -1e6, y: -1e6 }, null);
    }

    // Two seconds of relayed certainty on a floor with nobody on it, and the
    // guard is searching, not hunting. The chase rule has not moved: it still
    // takes eyes, exactly as it did before a radio existed.
    expect(brain.state).not.toBe(STATE.CHASE);
    expect(brain.state).not.toBe(STATE.ATTACK);
  });
});

describe('per-level tuning reaches the brain', () => {
  it('runs on the shared sheet when nothing is handed in', () => {
    const brain = guard(0, 0);

    expect(brain.tuning).toBe(CONFIG.enemy);
    expect(brain.tuning.sightRange).toBe(180);
  });

  it('runs on the level sheet when one is handed in, and inherits the rest', () => {
    const brain = guard(0, 0, 0, { sightRange: 225, fov: 105 });

    expect(brain.tuning.sightRange).toBe(225);
    expect(brain.tuning.fov).toBe(105);
    expect(brain.tuning.patrolSpeed).toBe(CONFIG.enemy.patrolSpeed);
  });

  it('sees further than the shared sheet says when the level widened the cone', () => {
    const far = { x: 300, y: 0 }; // 200px dead ahead: past the shared sheet.

    const shell = guard(100, 0, 0, { sightRange: 225 });
    expect(shell.perception.sense(shell, 0, far).seen).toBe(true);

    // And the same sightline from a stock guard is no sighting at all: the
    // verdict moved because the numbers moved, not the module.
    const stock = guard(100, 0, 0);
    expect(stock.perception.sense(stock, 0, far).seen).toBe(false);
    expect(stock.perception.range).toBe(180);

    // Neither sheet leaks into the singleton.
    expect(CONFIG.enemy.sightRange).toBe(180);
  });
});
