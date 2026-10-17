import { describe, it, expect } from 'vitest';

import { CONFIG } from '../src/config.js';

describe('CONFIG', () => {
  it('derives the pixel size of the map from tiles and grid dimensions', () => {
    expect(CONFIG.map.widthPx).toBe(CONFIG.map.cols * CONFIG.tile);
    expect(CONFIG.map.heightPx).toBe(CONFIG.map.rows * CONFIG.tile);
  });

  it('keeps the player faster than a chasing enemy so the game is winnable', () => {
    expect(CONFIG.player.speed).toBeGreaterThan(CONFIG.enemy.chaseSpeed);
  });

  it('lets the player lose a pursuer by sprinting, at the cost of stamina', () => {
    expect(CONFIG.player.sprint).toBeGreaterThan(CONFIG.player.speed);
    expect(CONFIG.player.drain).toBeGreaterThan(CONFIG.player.regen);
  });

  it('puts the suspicion thresholds in a sane order', () => {
    const { suspiciousAt, chaseAt } = CONFIG.enemy;
    expect(suspiciousAt).toBeGreaterThan(0);
    expect(chaseAt).toBeGreaterThan(suspiciousAt);
    expect(chaseAt).toBe(100);
  });

  it('uses a hysteresis band for sight so the boundary does not flicker', () => {
    expect(CONFIG.enemy.loseRange).toBeGreaterThan(CONFIG.enemy.sightRange);
  });

  it('clamps delta well below a one-second frame', () => {
    expect(CONFIG.maxDelta).toBeLessThanOrEqual(100);
    expect(CONFIG.maxDelta).toBeGreaterThan(0);
  });
});
