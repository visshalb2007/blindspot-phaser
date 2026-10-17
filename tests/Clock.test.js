import { describe, it, expect } from 'vitest';

import { Clock, formatDuration } from '../src/utils/Clock.js';

const DT = 1 / 60;

describe('formatDuration', () => {
  it('reads as minutes, seconds and tenths', () => {
    expect(formatDuration(0)).toBe('0:00.0');
    expect(formatDuration(7.25)).toBe('0:07.2');
    expect(formatDuration(60)).toBe('1:00.0');
    expect(formatDuration(83.44)).toBe('1:23.4');
    expect(formatDuration(600)).toBe('10:00.0');
    expect(formatDuration(3600)).toBe('60:00.0');
  });

  it('truncates rather than rounding into the next second', () => {
    // A clock reading 0:01.0 before a second has passed would be lying about
    // the time, and the time is the score.
    expect(formatDuration(0.99)).toBe('0:00.9');
    expect(formatDuration(59.99)).toBe('0:59.9');
  });

  it('never shows a negative, a NaN or a missing time', () => {
    expect(formatDuration(-5)).toBe('0:00.0');
    expect(formatDuration(NaN)).toBe('0:00.0');
    expect(formatDuration(Infinity)).toBe('0:00.0');
    expect(formatDuration(null)).toBe('0:00.0');
    expect(formatDuration(undefined)).toBe('0:00.0');
    expect(formatDuration('12')).toBe('0:00.0');
  });
});

describe('Clock', () => {
  it('starts at zero, and stopped', () => {
    const clock = new Clock();

    expect(clock.seconds).toBe(0);
    expect(clock.running).toBe(false);
    expect(clock.formatted).toBe('0:00.0');
  });

  it('counts up while it is running', () => {
    const clock = new Clock({ running: true });

    for (let i = 0; i < 60; i += 1) clock.tick(DT);

    expect(clock.seconds).toBeCloseTo(1, 6);
  });

  it('does not move until it is started', () => {
    const clock = new Clock();

    clock.tick(1);
    expect(clock.seconds).toBe(0);

    clock.start().tick(1);
    expect(clock.seconds).toBe(1);
  });

  it('freezes wherever it is stopped', () => {
    const clock = new Clock({ running: true });

    clock.tick(2);
    clock.stop();
    clock.tick(10);

    expect(clock.seconds).toBe(2);
  });

  it('ignores a zero or negative delta', () => {
    const clock = new Clock({ running: true });

    clock.tick(-5);
    clock.tick(0);

    expect(clock.seconds).toBe(0);
  });

  it('resets to zero without stopping', () => {
    const clock = new Clock({ running: true });

    clock.tick(3);
    clock.reset().tick(1);

    expect(clock.seconds).toBe(1);
    expect(clock.running).toBe(true);
  });

  it('formats its own elapsed time', () => {
    const clock = new Clock({ running: true });

    clock.tick(65.5);

    expect(clock.formatted).toBe('1:05.5');
  });
});
