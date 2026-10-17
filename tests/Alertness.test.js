import { describe, it, expect } from 'vitest';

import { CONFIG } from '../src/config.js';
import { Alertness } from '../src/ai/Alertness.js';

const DT = 1 / 60;

/** Steps the meter for `seconds`, returning how long that actually took. */
function hold(meter, seconds, visible) {
  const frames = Math.round(seconds / DT);
  for (let i = 0; i < frames; i += 1) meter.update(DT, visible);
  return frames * DT;
}

/** Seconds until `test` first passes, or Infinity if it never does. */
function timeTo(meter, visible, test, limitSeconds = 60) {
  const frames = Math.round(limitSeconds / DT);
  for (let i = 0; i < frames; i += 1) {
    meter.update(DT, visible);
    if (test(meter)) return (i + 1) * DT;
  }
  return Infinity;
}

describe('Alertness', () => {
  it('starts calm', () => {
    const meter = new Alertness();

    expect(meter.value).toBe(0);
    expect(meter.normalised).toBe(0);
    expect(meter.isSuspicious).toBe(false);
    expect(meter.isAlarmed).toBe(false);
  });

  it('becomes suspicious in about half a second of sight', () => {
    const meter = new Alertness();
    const seconds = timeTo(meter, true, (m) => m.isSuspicious);

    expect(seconds).toBeGreaterThan(0.4);
    expect(seconds).toBeLessThan(0.6);
  });

  it('becomes certain in about 1.7s of sight, so a crossing guard is escapable', () => {
    const meter = new Alertness();
    const seconds = timeTo(meter, true, (m) => m.isAlarmed);

    expect(seconds).toBeGreaterThan(1.5);
    expect(seconds).toBeLessThan(1.8);
  });

  it('is suspicious before it is certain, never the other way round', () => {
    const meter = new Alertness();
    let suspiciousFirst = null;

    for (let i = 0; i < 200; i += 1) {
      meter.update(DT, true);
      if (suspiciousFirst === null && meter.isSuspicious) suspiciousFirst = i;
      if (meter.isAlarmed) {
        expect(suspiciousFirst).not.toBeNull();
        return;
      }
    }

    throw new Error('the meter never filled');
  });

  it('remembers for longer than it took to notice', () => {
    const riseTime = timeTo(new Alertness(), true, (m) => m.isAlarmed);

    const drain = new Alertness();
    drain.alarm();
    const fallTime = timeTo(drain, false, (m) => !m.isSuspicious);

    // This asymmetry is the whole reason the state machine stopped strobing.
    expect(fallTime).toBeGreaterThan(riseTime);
  });

  it('drains while nothing is visible', () => {
    const meter = new Alertness();
    meter.alarm();

    const before = meter.value;
    meter.update(DT, false);

    expect(meter.value).toBeLessThan(before);
    expect(meter.value).toBeGreaterThan(0);
  });

  it('never runs past either end', () => {
    const meter = new Alertness();

    hold(meter, 30, true);
    expect(meter.value).toBe(100);
    expect(meter.normalised).toBe(1);

    hold(meter, 60, false);
    expect(meter.value).toBe(0);
    expect(meter.normalised).toBe(0);
  });

  it('does not fall back to calm during a brief interruption', () => {
    const meter = new Alertness();
    hold(meter, 2, true);
    const certain = meter.value;

    // The player ducks behind a pillar for a fifth of a second and reappears.
    hold(meter, 0.2, false);

    // Certainty costs a little, but the guard is nowhere near calm.
    expect(meter.value).toBeGreaterThan(meter.suspiciousAt);
    expect(meter.isSuspicious).toBe(true);
    expect(meter.value).toBeLessThan(certain);
  });

  it('forgets a glimpse entirely if nothing follows it', () => {
    const meter = new Alertness();
    hold(meter, 0.5, true); // long enough to be suspicious

    hold(meter, 5, false);

    expect(meter.value).toBe(0);
    expect(meter.isSuspicious).toBe(false);
  });

  it('can be told to be certain without working up to it', () => {
    const meter = new Alertness();
    meter.alarm();

    expect(meter.value).toBe(100);
    expect(meter.isAlarmed).toBe(true);
  });

  it('goes back to calm on reset', () => {
    const meter = new Alertness();
    meter.alarm();
    meter.reset();

    expect(meter.value).toBe(0);
    expect(meter.isSuspicious).toBe(false);
  });

  it('honours thresholds handed to it, so the knobs stay in one place', () => {
    const meter = new Alertness({ suspiciousAt: 10, chaseAt: 20 });

    expect(meter.isSuspicious).toBe(false);

    hold(meter, 0.2, true);
    expect(meter.isSuspicious).toBe(true);
    expect(meter.isAlarmed).toBe(false);

    hold(meter, 0.2, true);
    expect(meter.isAlarmed).toBe(true);
  });

  it('uses the config rates by default', () => {
    const meter = new Alertness();

    expect(meter.gain).toBe(CONFIG.enemy.suspicionGain);
    expect(meter.decay).toBe(CONFIG.enemy.suspicionDecay);
    expect(meter.suspiciousAt).toBe(CONFIG.enemy.suspiciousAt);
    expect(meter.chaseAt).toBe(CONFIG.enemy.chaseAt);
  });
});
