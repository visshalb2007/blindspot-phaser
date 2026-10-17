import { describe, it, expect } from 'vitest';

import { CONFIG } from '../src/config.js';
import { Grid } from '../src/world/Grid.js';
import { LEVEL_ROWS } from '../src/world/LevelData.js';
import { Mission } from '../src/world/Mission.js';
import { Pathfinder } from '../src/ai/Pathfinder.js';

/** Three chips in a line and a door at the far end of a corridor. */
const CORRIDOR = ['#############', '#P.C.C.C...E#', '#############'];

function corridor() {
  const grid = new Grid(CORRIDOR);

  return {
    grid,
    mission: new Mission({ chips: grid.chips, exit: grid.exit }),
  };
}

/** Every chip collected, without caring how the player got there. */
function takeEverything(mission) {
  for (const chip of mission.chips) mission.tryCollect({ x: chip.x, y: chip.y });
}

describe('Mission', () => {
  it('finds the chips and the door the level was built with', () => {
    const { grid, mission } = corridor();

    expect(mission.total).toBe(3);
    expect(mission.collected).toBe(0);
    expect(mission.remaining).toBe(3);
    expect(mission.isUnlocked).toBe(false);
    expect(mission.won).toBe(false);
    expect(mission.exit).toEqual({ x: grid.exit.x, y: grid.exit.y });
  });

  it('takes a chip the player walks onto', () => {
    const { grid, mission } = corridor();
    const chip = grid.chips[0];

    const taken = mission.tryCollect({ x: chip.x, y: chip.y });

    expect(taken).toBe(mission.chips[0]);
    expect(taken.collected).toBe(true);
    expect(mission.collected).toBe(1);
    expect(mission.remaining).toBe(2);
  });

  it('takes a chip from within reach, not from the tile centre exactly', () => {
    const { grid, mission } = corridor();
    const chip = grid.chips[0];

    expect(mission.tryCollect({ x: chip.x + mission.pickupRadius, y: chip.y })).not.toBeNull();
  });

  it('leaves a chip alone until the player is close to it', () => {
    const { grid, mission } = corridor();
    const chip = grid.chips[0];

    expect(mission.tryCollect({ x: chip.x + mission.pickupRadius + 1, y: chip.y })).toBeNull();
    expect(mission.collected).toBe(0);
  });

  it('takes the nearest chip when two are in reach', () => {
    const mission = new Mission({
      chips: [
        { x: 0, y: 0 },
        { x: 10, y: 0 },
      ],
      exit: { x: 200, y: 0 },
    });

    const taken = mission.tryCollect({ x: 8, y: 0 });

    expect(taken).toBe(mission.chips[1]);
    expect(mission.collected).toBe(1);
  });

  it('cannot take the same chip twice', () => {
    const { grid, mission } = corridor();

    mission.tryCollect({ x: grid.chips[0].x, y: grid.chips[0].y });
    const again = mission.tryCollect({ x: grid.chips[0].x, y: grid.chips[0].y });

    expect(again).toBeNull();
    expect(mission.collected).toBe(1);
  });

  it('unlocks the door when the last chip is taken', () => {
    const { mission } = corridor();

    for (const chip of mission.chips) {
      expect(mission.isUnlocked).toBe(false);
      mission.tryCollect({ x: chip.x, y: chip.y });
    }

    expect(mission.isUnlocked).toBe(true);
    expect(mission.remaining).toBe(0);
  });

  it('treats a level with no chips as a straight run for the door', () => {
    const mission = new Mission({ chips: [], exit: { x: 100, y: 100 } });

    expect(mission.isUnlocked).toBe(true);
    expect(mission.reachedExit({ x: 100, y: 100 })).toBe(true);
    expect(mission.won).toBe(true);
  });

  it('will not let the player out while chips are outstanding', () => {
    const { grid, mission } = corridor();

    // Standing right in the doorway: this is not a matter of distance.
    expect(mission.isAtExit({ x: grid.exit.x, y: grid.exit.y })).toBe(true);
    expect(mission.reachedExit({ x: grid.exit.x, y: grid.exit.y })).toBe(false);
    expect(mission.won).toBe(false);
  });

  it('does not quietly bank a win from an earlier visit to the door', () => {
    const { grid, mission } = corridor();

    mission.reachedExit({ x: grid.exit.x, y: grid.exit.y });
    takeEverything(mission);

    // Chips in hand, but the player is back down the corridor.
    expect(mission.isUnlocked).toBe(true);
    expect(mission.reachedExit({ x: grid.chips[0].x, y: grid.chips[0].y })).toBe(false);
    expect(mission.won).toBe(false);
  });

  it('wins when the player walks out with everything', () => {
    const { grid, mission } = corridor();
    takeEverything(mission);

    expect(mission.reachedExit({ x: grid.exit.x, y: grid.exit.y })).toBe(true);
    expect(mission.won).toBe(true);
  });

  it('counts the doorway, not the whole room', () => {
    const { grid, mission } = corridor();
    takeEverything(mission);

    expect(mission.isAtExit({ x: grid.exit.x + mission.exitRadius + 1, y: grid.exit.y })).toBe(
      false,
    );
    expect(mission.reachedExit({ x: grid.exit.x + mission.exitRadius + 1, y: grid.exit.y })).toBe(
      false,
    );
  });

  it('latches a win once it has happened', () => {
    const { grid, mission } = corridor();
    takeEverything(mission);
    mission.reachedExit({ x: grid.exit.x, y: grid.exit.y });

    // Wandering back off the doorway, or failing to collect anything else, does
    // not take the win away.
    expect(mission.reachedExit({ x: 0, y: 0 })).toBe(false);
    expect(mission.tryCollect({ x: 0, y: 0 })).toBeNull();
    expect(mission.won).toBe(true);
  });

  it('has no door to reach in a level without an exit', () => {
    const { grid } = corridor();
    const mission = new Mission({ chips: grid.chips, exit: null });

    expect(mission.isAtExit({ x: 0, y: 0 })).toBe(false);
    expect(mission.reachedExit({ x: 0, y: 0 })).toBe(false);
    expect(mission.won).toBe(false);
  });

  it('puts the chips back and re-locks the door on reset', () => {
    const { grid, mission } = corridor();
    takeEverything(mission);
    mission.reachedExit({ x: grid.exit.x, y: grid.exit.y });

    mission.reset();

    expect(mission.collected).toBe(0);
    expect(mission.remaining).toBe(3);
    expect(mission.isUnlocked).toBe(false);
    expect(mission.won).toBe(false);
    expect(mission.chips.every((chip) => !chip.collected)).toBe(true);
  });

  it('uses the configured reach', () => {
    const { mission } = corridor();

    expect(mission.pickupRadius).toBe(CONFIG.mission.pickupRadius);
    expect(mission.exitRadius).toBe(CONFIG.mission.exitRadius);
  });

  describe('the shipped level', () => {
    it('puts every chip and the door on walkable ground', () => {
      const grid = new Grid(LEVEL_ROWS);

      expect(grid.chips.length).toBeGreaterThan(1);
      expect(grid.exit).not.toBeNull();

      for (const chip of [...grid.chips, grid.exit]) {
        expect(grid.isWalkable(chip.cx, chip.cy)).toBe(true);
      }
    });

    it('can actually be finished', () => {
      const grid = new Grid(LEVEL_ROWS);
      const pathfinder = new Pathfinder(grid);

      // Every chip has to be reachable from the spawn, and the door reachable
      // from every chip, or a future edit to the map could quietly make the
      // level impossible to win.
      for (const chip of grid.chips) {
        expect(pathfinder.findPath(grid.spawn, chip).reached).toBe(true);
        expect(pathfinder.findPath(chip, grid.exit).reached).toBe(true);
      }
    });
  });
});
