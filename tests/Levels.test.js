import { describe, it, expect } from 'vitest';

import { Pathfinder } from '../src/ai/Pathfinder.js';
import { CONFIG } from '../src/config.js';
import { Grid } from '../src/world/Grid.js';
import { LEVEL_ROWS } from '../src/world/LevelData.js';
import { LEVELS, LEVEL_COUNT, DEFAULT_LEVEL, levelAt, configFor } from '../src/world/Levels.js';
import { Mission } from '../src/world/Mission.js';
import { guardPosts } from '../src/world/Roster.js';

describe('the ladder', () => {
  it('ships five levels, with the one the project was built on as the default', () => {
    expect(LEVEL_COUNT).toBe(5);
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
    const level = levelAt(LEVEL_COUNT - 1);
    const config = configFor(level);

    expect(config.enemy.count).toBe(level.guards);
    // Only the count moves: everything else is still the game's own tuning.
    expect(config.enemy.sightRange).toBe(CONFIG.enemy.sightRange);
    expect(config.enemy.searchDuration).toBe(CONFIG.enemy.searchDuration);
    expect(CONFIG.enemy.count).toBe(2);
    expect(config).not.toBe(CONFIG);
    expect(config.enemy).not.toBe(CONFIG.enemy);
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
