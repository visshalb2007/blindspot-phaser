import { describe, it, expect } from 'vitest';

import { CONFIG } from '../src/config.js';
import { Timer, clampDelta } from '../src/utils/Timer.js';

describe('clampDelta', () => {
  it('converts a normal frame to seconds', () => {
    expect(clampDelta(16.7)).toBeCloseTo(0.0167, 4);
  });

  it('clamps a long pause down to the configured maximum', () => {
    expect(clampDelta(9000)).toBeCloseTo(CONFIG.maxDelta / 1000, 10);
  });

  it('leaves a delta exactly at the limit alone', () => {
    expect(clampDelta(CONFIG.maxDelta)).toBeCloseTo(CONFIG.maxDelta / 1000, 10);
  });
});

describe('Timer', () => {
  it('is not done before its duration has elapsed', () => {
    const timer = new Timer(1);
    timer.tick(0.5);
    expect(timer.done).toBe(false);
    expect(timer.remaining).toBeCloseTo(0.5, 10);
  });

  it('fires exactly once, on the frame it completes', () => {
    const timer = new Timer(0.1);
    let fires = 0;

    for (let i = 0; i < 60; i += 1) {
      if (timer.tick(1 / 60)) fires += 1;
    }

    expect(fires).toBe(1);
  });

  it('does not fire again until it is restarted', () => {
    const timer = new Timer(0.05);
    timer.tick(0.05);
    expect(timer.tick(0.05)).toBe(false);
    expect(timer.tick(1)).toBe(false);
  });

  it('restarts cleanly with start()', () => {
    const timer = new Timer(0.05);
    timer.tick(0.05);
    timer.start();
    expect(timer.done).toBe(false);
    expect(timer.elapsed).toBe(0);
    expect(timer.tick(0.05)).toBe(true);
  });

  it('accepts a new duration through start()', () => {
    const timer = new Timer(1);
    timer.start(0.2);
    expect(timer.duration).toBe(0.2);
    expect(timer.tick(0.2)).toBe(true);
  });

  it('reports progress from 0 to 1 and pins it at 1 once done', () => {
    const timer = new Timer(1);
    expect(timer.progress).toBe(0);
    timer.tick(0.25);
    expect(timer.progress).toBeCloseTo(0.25, 10);
    timer.tick(5);
    expect(timer.progress).toBe(1);
  });

  it('treats a zero-length timer as immediately complete', () => {
    const timer = new Timer(0);
    expect(timer.done).toBe(true);
    expect(timer.progress).toBe(1);
    expect(timer.tick(0.016)).toBe(false);
  });

  it('never reports negative remaining time', () => {
    const timer = new Timer(0.1);
    timer.tick(10);
    expect(timer.remaining).toBe(0);
  });

  it('reset() rewinds without changing the duration', () => {
    const timer = new Timer(1);
    timer.tick(0.9);
    timer.reset();
    expect(timer.elapsed).toBe(0);
    expect(timer.duration).toBe(1);
  });

  it('a ten-second pause fires nothing extra when time is clamped first', () => {
    // This is the exact scenario from the manual checklist: switch tabs for
    // ten seconds, come back, and nothing should have jumped or double-fired.
    const timer = new Timer(0.3);
    const framesAfterReturn = 8;
    let fires = 0;

    for (let i = 0; i < framesAfterReturn; i += 1) {
      if (timer.tick(clampDelta(10000))) fires += 1;
    }

    // 8 frames of 50 ms is 0.4 s, so a 0.3 s timer completes exactly once.
    expect(fires).toBe(1);
    expect(timer.done).toBe(true);
  });
});
