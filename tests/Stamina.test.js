import { describe, it, expect } from 'vitest';

import { CONFIG } from '../src/config.js';
import { Stamina } from '../src/utils/Stamina.js';

const DT = 1 / 60;
const { drain, regen, stamina: max, sprintRecoverAt } = CONFIG.player;

/** Runs `seconds` worth of frames and returns how many frames were sprinting. */
function run(stamina, seconds, { wantsSprint = true, moving = true } = {}) {
  let sprintFrames = 0;
  const frames = Math.round(seconds / DT);
  for (let i = 0; i < frames; i += 1) {
    if (stamina.update(DT, wantsSprint, moving)) sprintFrames += 1;
  }
  return sprintFrames;
}

describe('Stamina', () => {
  it('starts full', () => {
    const stamina = new Stamina();
    expect(stamina.value).toBe(max);
    expect(stamina.ratio).toBe(1);
    expect(stamina.exhausted).toBe(false);
  });

  it('sprints and drains at the configured rate', () => {
    const stamina = new Stamina();
    expect(stamina.update(DT, true, true)).toBe(true);
    expect(stamina.value).toBeCloseTo(max - drain * DT, 10);
  });

  it('empties after stamina/drain seconds of sprinting', () => {
    const stamina = new Stamina();
    let seconds = 0;

    while (stamina.value > 0 && seconds < 10) {
      stamina.update(DT, true, true);
      seconds += DT;
    }

    expect(stamina.value).toBe(0);
    expect(stamina.exhausted).toBe(true);
    expect(seconds).toBeCloseTo(max / drain, 1);
  });

  it('regenerates instead of draining once the bar is empty, and never goes negative', () => {
    const stamina = new Stamina();

    for (let i = 0; i < 2000; i += 1) {
      stamina.update(DT, true, true);
      expect(stamina.value).toBeGreaterThanOrEqual(0);
    }
  });

  it('does not drain when the player is standing still', () => {
    const stamina = new Stamina();
    stamina.value = 50;
    const sprinted = run(stamina, 1, { moving: false });
    expect(sprinted).toBe(0);
    expect(stamina.value).toBeCloseTo(50 + regen, 1);
  });

  it('refills at the configured rate when sprint is released', () => {
    const stamina = new Stamina();
    stamina.value = 40;
    run(stamina, 1, { wantsSprint: false });
    expect(stamina.value).toBeCloseTo(40 + regen, 1);
  });

  it('never refills past the maximum', () => {
    const stamina = new Stamina();
    run(stamina, 20, { wantsSprint: false });
    expect(stamina.value).toBe(max);
  });

  it('refuses to sprint again until the recovery threshold is reached', () => {
    const stamina = new Stamina();
    stamina.value = 0;
    stamina.exhausted = true;

    let frames = 0;
    while (!stamina.update(DT, true, true) && frames < 600) frames += 1;
    const waited = frames * DT;

    const expected = sprintRecoverAt / regen;
    expect(waited).toBeGreaterThanOrEqual(expected - DT * 2);
    expect(waited).toBeLessThan(expected + DT * 2);
  });

  it('does not flicker sprint on and off during the recovery window', () => {
    const stamina = new Stamina();
    stamina.value = 0;
    stamina.exhausted = true;

    // Every frame up to just before the threshold must report "not sprinting".
    const frames = Math.floor(sprintRecoverAt / regen / DT) - 2;
    for (let i = 0; i < frames; i += 1) {
      expect(stamina.update(DT, true, true)).toBe(false);
    }
  });

  it('clears the exhausted latch once the threshold is crossed', () => {
    const stamina = new Stamina();
    stamina.value = 0;
    stamina.exhausted = true;

    run(stamina, sprintRecoverAt / regen + 0.2, { wantsSprint: false });
    expect(stamina.exhausted).toBe(false);
  });

  it('reset() restores a full bar and clears the latch', () => {
    const stamina = new Stamina();
    run(stamina, 30);
    stamina.reset();
    expect(stamina.value).toBe(max);
    expect(stamina.exhausted).toBe(false);
  });
});
