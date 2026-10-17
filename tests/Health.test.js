import { describe, it, expect } from 'vitest';

import { CONFIG } from '../src/config.js';
import { Health } from '../src/utils/Health.js';

const DT = 1 / 60;

describe('Health', () => {
  it('starts full and alive', () => {
    const health = new Health();

    expect(health.value).toBe(CONFIG.player.health);
    expect(health.max).toBe(CONFIG.player.health);
    expect(health.fraction).toBe(1);
    expect(health.isDead).toBe(false);
    expect(health.isHurt).toBe(false);
  });

  it('charges one point per blow that lands', () => {
    const health = new Health({ max: 3, iFrames: 1 });

    expect(health.takeHit()).toBe(true);
    expect(health.value).toBe(2);
    expect(health.isHurt).toBe(true);
  });

  it('shrugs off a second blow inside the window', () => {
    const health = new Health({ max: 3, iFrames: 1 });

    health.takeHit();
    expect(health.takeHit()).toBe(false);
    expect(health.value).toBe(2);
  });

  it('can be hit again once the window has passed', () => {
    const health = new Health({ max: 3, iFrames: 1 });

    health.takeHit();
    for (let i = 0; i < Math.round(1 / DT) + 1; i += 1) health.update(DT);

    expect(health.isHurt).toBe(false);
    expect(health.takeHit()).toBe(true);
    expect(health.value).toBe(1);
  });

  it('runs the window down to exactly zero, never past it', () => {
    const health = new Health({ max: 3, iFrames: 0.5 });

    health.takeHit();
    for (let i = 0; i < Math.round(5 / DT); i += 1) health.update(DT);

    expect(health.invulnerable).toBe(0);
  });

  it('ignores updates when nothing is pending', () => {
    const health = new Health();

    health.update(DT);

    expect(health.invulnerable).toBe(0);
  });

  it('dies when the bar runs out', () => {
    const health = new Health({ max: 2, iFrames: 0 });

    health.takeHit();
    health.takeHit();

    expect(health.value).toBe(0);
    expect(health.isDead).toBe(true);
    expect(health.fraction).toBe(0);
  });

  it('stays down, however many blows arrive', () => {
    const health = new Health({ max: 1, iFrames: 0 });

    health.takeHit();

    expect(health.takeHit()).toBe(false);
    expect(health.takeHit()).toBe(false);
    expect(health.value).toBe(0);
  });

  it('lets two blows on the same frame cost only one point', () => {
    const health = new Health({ max: 3, iFrames: 1 });

    // Both guards swing on the same tick.
    const first = health.takeHit();
    const second = health.takeHit();

    expect(first).toBe(true);
    expect(second).toBe(false);
    expect(health.value).toBe(2);
  });

  it('gives a caught player a few seconds of life, not a few frames', () => {
    const health = new Health();
    let seconds = 0;

    // A guard swinging as fast as the config allows, against the window.
    const perHit = CONFIG.enemy.attackWindup + CONFIG.enemy.attackCooldown;
    while (!health.isDead && seconds < 30) {
      health.takeHit();
      const wait = Math.min(perHit, CONFIG.player.iFrames);
      for (let elapsed = 0; elapsed < wait; elapsed += DT) health.update(DT);
      seconds += wait;
    }

    // Three points at one every second and a bit: seconds, not fractions of one.
    expect(seconds).toBeGreaterThan(2);
  });

  it('comes back full on reset', () => {
    const health = new Health({ max: 3, iFrames: 1 });

    health.takeHit();
    health.reset();

    expect(health.value).toBe(3);
    expect(health.invulnerable).toBe(0);
    expect(health.isDead).toBe(false);
    expect(health.fraction).toBe(1);
  });

  it('uses the config defaults', () => {
    const health = new Health();

    expect(health.iFrames).toBe(CONFIG.player.iFrames);
  });
});
