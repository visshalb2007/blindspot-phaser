import { describe, it, expect } from 'vitest';

import { Pathfinder } from '../src/ai/Pathfinder.js';
import { CONFIG } from '../src/config.js';
import { Grid } from '../src/world/Grid.js';
import { LEVEL_ROWS } from '../src/world/LevelData.js';
import {
  LEVELS,
  LEVEL_COUNT,
  DEFAULT_LEVEL,
  levelAt,
  configFor,
  gadgetsFor,
  relayFor,
  featuresFor,
} from '../src/world/Levels.js';
import { Mission } from '../src/world/Mission.js';
import { guardPosts } from '../src/world/Roster.js';

describe('the ladder', () => {
  it('ships ten levels, with the one the project was built on as the default', () => {
    expect(LEVEL_COUNT).toBe(10);
    expect(DEFAULT_LEVEL).toBe(0);
    expect(levelAt().id).toBe('night-shift');
    expect(new Set(LEVELS.map((level) => level.id)).size).toBe(LEVEL_COUNT);
  });

  it('leaves level 1 exactly as it was', () => {
    // Every suite written before there was a ladder tests this map, so it is
    // held to the byte: same rows, same guard count.
    expect(levelAt(0).rows).toBe(LEVEL_ROWS);
    expect(levelAt(0).guards).toBe(CONFIG.enemy.count);
  });

  it('is numbered in the order it gets harder', () => {
    LEVELS.forEach((level, index) => {
      expect(level.difficulty).toBe(index + 1);
      expect(level.name.length).toBeGreaterThan(0);
      // The blurb has to fit one row of a panel on the start page.
      expect(level.blurb.length).toBeLessThanOrEqual(30);

      if (index > 0) {
        expect(level.guards).toBeGreaterThanOrEqual(LEVELS[index - 1].guards);
        expect(level.rows).not.toEqual(LEVELS[index - 1].rows);
      }
    });

    // And the top of the ladder is genuinely busier than the bottom of it.
    expect(LEVELS[LEVEL_COUNT - 1].guards).toBeGreaterThan(LEVELS[0].guards);
  });

  it('is picked by index, and clamps one it cannot use', () => {
    expect(levelAt(2).id).toBe(LEVELS[2].id);
    expect(levelAt(2.7).id).toBe(LEVELS[2].id);
    expect(levelAt(-1).id).toBe(LEVELS[0].id);
    expect(levelAt(99).id).toBe(LEVELS[LEVEL_COUNT - 1].id);
    expect(levelAt(NaN).id).toBe(LEVELS[0].id);
    expect(levelAt(undefined).id).toBe(LEVELS[0].id);
    expect(levelAt('three').id).toBe(LEVELS[0].id);
  });

  it('gives a level its own guard count without touching the shared config', () => {
    const config = configFor(levelAt(4)); // The Vault: a count, and nothing more.

    expect(config.enemy.count).toBe(5);
    // A plain level tunes nothing else: everything is still the game's own.
    expect(config.enemy.sightRange).toBe(CONFIG.enemy.sightRange);
    expect(config.enemy.searchDuration).toBe(CONFIG.enemy.searchDuration);
    expect(CONFIG.enemy.count).toBe(2);
    expect(config).not.toBe(CONFIG);
    expect(config.enemy).not.toBe(CONFIG.enemy);
  });

  it('merges a retuned level over the shared config, and the shared config never notices', () => {
    const blackOut = levelAt(LEVEL_COUNT - 1);
    const config = configFor(blackOut);

    expect(config.enemy.count).toBe(blackOut.guards);
    // The level's own sheet lands on top, and only on top: inherits what it
    // does not mention.
    for (const [key, value] of Object.entries(blackOut.tuning)) {
      expect(config.enemy[key]).toBe(value);
    }
    expect(config.enemy.searchSpeed).toBe(CONFIG.enemy.searchSpeed);
    expect(config.enemy.loseRange).toBe(CONFIG.enemy.loseRange);

    // And the singleton came out of it exactly as it went in, so the next
    // level, the next run and the next test cannot inherit a tune-up.
    expect(CONFIG.enemy.sightRange).toBe(180);
    expect(CONFIG.enemy.count).toBe(2);
    {
      const before = { ...CONFIG.enemy };
      configFor(blackOut);
      expect(CONFIG.enemy).toEqual(before);
    }

    // The untuned levels before it run on the shared sheet untouched.
    expect(configFor(levelAt(0)).enemy.sightRange).toBe(CONFIG.enemy.sightRange);
  });

  it('hammers tighter thresholds than it hands certainty out at', () => {
    // Every level object with its own tuning keeps the shape sane: thresholds
    // ordering is a config invariant, and per-level tuning must not break it.
    for (const level of LEVELS) {
      const enemy = configFor(level).enemy;
      expect(enemy.suspiciousAt).toBeGreaterThan(0);
      expect(enemy.chaseAt).toBeGreaterThan(enemy.suspiciousAt);
      expect(enemy.loseRange).toBeGreaterThan(enemy.sightRange);
      // The player is still able to outrun every chasing guard shipped.
      expect(CONFIG.player.speed).toBeGreaterThan(enemy.chaseSpeed);
    }
  });

  it('knows what it issues and what it never does', () => {
    // No gadgets, no grants: the early ladder is gadget-free, exactly as it
    // shipped before the radio existed.
    expect(gadgetsFor(levelAt(0)).decoys).toBe(0);
    expect(gadgetsFor(levelAt(4)).decoys).toBe(0);
    expect(gadgetsFor(levelAt(5)).decoys).toBe(2);
    expect(gadgetsFor(levelAt(LEVEL_COUNT - 1)).decoys).toBe(1);
    // And a level with no record of gadgets at all reads as zero, not as
    // undefined leaking into a HUD.
    expect(gadgetsFor({}).decoys).toBe(0);

    // The relay is wired only where the levels say so, and undefined means off.
    expect(relayFor(levelAt(8))).toBe(true);
    expect(relayFor(levelAt(9))).toBe(true);
    expect(relayFor(levelAt(0))).toBe(false);
    expect(relayFor({})).toBe(false);
  });

  it('tags itself with the features it actually has, and nothing it does not', () => {
    const tags = (index) => featuresFor(levelAt(index));

    // Levels one to five are geometry alone - no tags at all, because saying
    // "the map is the difficulty" in a tag would be a start page telling you
    // something the config cannot back up.
    for (let index = 0; index < 5; index += 1) {
      expect(tags(index)).toEqual([]);
    }

    expect(tags(5)).toContain('decoy radio');
    expect(tags(6)).toContain('edgy');
    expect(tags(7)).toContain('sharp eyes');
    expect(tags(8)).toContain('alarm relay');
    const last = tags(LEVEL_COUNT - 1);
    expect(last).toContain('decoy radio');
    expect(last).toContain('alarm relay');
    expect(last).toContain('sharp eyes');
  });
});

describe.each(LEVELS.map((level, index) => [index + 1, level]))('level %i', (_number, level) => {
  const grid = new Grid(level.rows);
  const pathfinder = new Pathfinder(grid);

  it('is the size the game draws, and parses without complaint', () => {
    expect(level.rows.length).toBe(CONFIG.map.rows);
    for (const row of level.rows) expect(row.length).toBe(CONFIG.map.cols);

    // The grid's warnings are the map author's only feedback, and the game
    // prints them to the console - so a warning here is a level that ships with
    // a console warning on it.
    expect(grid.warnings).toEqual([]);
  });

  it('has a spawn, an exit and something to steal', () => {
    expect(grid.spawn).toBeTruthy();
    expect(grid.exit).toBeTruthy();
    expect(grid.chips.length).toBeGreaterThanOrEqual(1);
  });

  it('can be finished on foot: every chip and the door are reachable', () => {
    for (const chip of grid.chips) {
      expect(pathfinder.findPath(grid.spawn, chip), `chip at ${chip.cx},${chip.cy}`).toBeTruthy();
    }

    expect(pathfinder.findPath(grid.spawn, grid.exit)).toBeTruthy();
  });

  it('has a patrol the guards can actually walk', () => {
    expect(grid.waypoints.length).toBeGreaterThanOrEqual(2);

    for (const waypoint of grid.waypoints) {
      expect(
        pathfinder.findPath(grid.spawn, waypoint),
        `waypoint ${waypoint.order} at ${waypoint.cx},${waypoint.cy}`,
      ).toBeTruthy();
    }

    for (const post of guardPosts(grid, { count: level.guards })) {
      const cell = grid.worldToCell(post.x, post.y);
      expect(grid.isWalkable(cell.cx, cell.cy), `${post.name} is not standing on floor`).toBe(true);
    }
  });

  it('posts the guards it asks for, and never more than it has posts', () => {
    const posts = guardPosts(grid, { count: level.guards });

    expect(posts.length).toBe(Math.min(level.guards, grid.waypoints.length));
    expect(posts.length).toBeGreaterThan(0);
  });

  it('builds a mission that starts shut and uncollected', () => {
    const mission = new Mission({ chips: grid.chips, exit: grid.exit });

    expect(mission.total).toBe(grid.chips.length);
    expect(mission.collected).toBe(0);
    expect(mission.isUnlocked).toBe(false);
  });
});
