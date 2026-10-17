import { describe, it, expect } from 'vitest';

import { CONFIG } from '../src/config.js';
import { Grid } from '../src/world/Grid.js';
import { EnemyBrain } from '../src/ai/EnemyBrain.js';
import { STATE } from '../src/ai/states.js';

const DT = 1 / 60;

/**
 * A one-tile corridor with a waypoint at each end, so a guard's whole approach
 * happens along a straight, unobstructed line:
 *
 *   0  1  2  3  4  5  6  7  8  9  10 11 12
 * 0 #  #  #  #  #  #  #  #  #  #  #  #  #
 * 1 #  P  0  .  .  .  .  .  .  .  .  1  #
 * 2 #  #  #  #  #  #  #  #  #  #  #  #  #
 *
 * Nothing in the corridor can accidentally block sight, so a test can say
 * exactly when the guard sees the player and when it stops.
 */
const CORRIDOR = ['#############', '#P0........1#', '#############'];

/** Nowhere near the level: range can never be satisfied. */
const FAR_AWAY = { x: -10_000, y: -10_000 };

/** A big empty room, for tests where nothing should ever be in the way. */
function openRoom(cols = 21, rows = 13) {
  const middle = Math.floor(rows / 2);
  const lines = [];

  for (let y = 0; y < rows; y += 1) {
    if (y === 0 || y === rows - 1) {
      lines.push('#'.repeat(cols));
      continue;
    }

    const cells = Array.from({ length: cols }, () => '.');
    cells[0] = '#';
    cells[cols - 1] = '#';
    if (y === middle) {
      cells[1] = 'P';
      cells[2] = '0';
      cells[cols - 3] = '1';
    }
    lines.push(cells.join(''));
  }

  return new Grid(lines);
}

/**
 * Records the states a guard passes through and when each one started, which is
 * what makes the timing assertions readable.
 */
class Recorder {
  constructor(brain) {
    this.brain = brain;
    this.elapsed = 0;
    this.states = [brain.state];
    this.entries = [{ state: brain.state, at: 0 }];
  }

  step(dt, target) {
    // A function target is re-evaluated every frame, which is how a test can
    // keep the player pinned in front of a guard that is turning.
    const point = typeof target === 'function' ? target(this.brain) : target;

    this.brain.update(dt, point);
    this.elapsed += dt;

    const current = this.states[this.states.length - 1];
    if (this.brain.state !== current) {
      this.states.push(this.brain.state);
      this.entries.push({ state: this.brain.state, at: this.elapsed });
    }
  }

  run(seconds, target) {
    const frames = Math.round(seconds / DT);
    for (let i = 0; i < frames; i += 1) this.step(DT, target);
    return this;
  }

  /** Runs until the guard is in `state`, or it runs out of patience. */
  runUntil(state, seconds, target) {
    const frames = Math.round(seconds / DT);
    for (let i = 0; i < frames && this.brain.state !== state; i += 1) this.step(DT, target);
    return this;
  }

  /** How many times the guard entered `state`. */
  visits(state) {
    return this.entries.filter((entry) => entry.state === state).length;
  }

  /** Seconds until the guard first entered `state`, or null if it never did. */
  firstAt(state) {
    const entry = this.entries.find((candidate) => candidate.state === state);
    return entry ? entry.at : null;
  }

  /** The state the guard moved to after `state`, the first time it was in it. */
  after(state) {
    const index = this.states.indexOf(state);
    return index === -1 ? null : (this.states[index + 1] ?? null);
  }
}

/** A guard at the head of the corridor, walking east. */
function corridorGuard(options = {}) {
  const grid = new Grid(CORRIDOR);

  return {
    grid,
    brain: new EnemyBrain({
      x: grid.waypoints[0].x,
      y: grid.waypoints[0].y,
      heading: 0,
      waypoints: grid.waypoints,
      startIndex: 0,
      grid,
      ...options,
    }),
  };
}

/** A point `distance` px east of the guard's first post, always on the floor. */
function downCorridor(grid, distance) {
  return { x: grid.waypoints[0].x + distance, y: grid.waypoints[0].y };
}

/**
 * A point `distance` px along the guard's current heading, or nowhere when that
 * point is not somewhere it could actually see. Because it uses the guard's own
 * raycast, a test that means "keep it in view" cannot be surprised by a wall.
 */
function inFrontOrNowhere(brain, distance) {
  const spot = {
    x: brain.x + Math.cos(brain.heading) * distance,
    y: brain.y + Math.sin(brain.heading) * distance,
  };

  if (brain.grid.isWallAtWorld(spot.x, spot.y)) return FAR_AWAY;
  if (!brain.lineOfSight.canSee(brain, spot)) return FAR_AWAY;

  return spot;
}

describe('suspicion', () => {
  it('escalates from patrol to suspicion to a chase, in that order', () => {
    const { grid, brain } = corridorGuard();
    const rec = new Recorder(brain);

    rec.run(3, downCorridor(grid, 144));

    expect(rec.states).toEqual([STATE.PATROL, STATE.SUSPICIOUS, STATE.CHASE, STATE.ATTACK]);

    const suspiciousAt = rec.firstAt(STATE.SUSPICIOUS);
    const chaseAt = rec.firstAt(STATE.CHASE);

    // Half a second of doubt, then another second or so of certainty.
    expect(suspiciousAt).toBeGreaterThan(0.3);
    expect(suspiciousAt).toBeLessThan(0.8);
    expect(chaseAt).toBeGreaterThan(1.4);
    expect(chaseAt).toBeLessThan(2.2);
  });

  it('does not commit to anything after a glance', () => {
    const { grid, brain } = corridorGuard();
    const rec = new Recorder(brain);

    // A quarter of a second of being seen is under the suspicion threshold, and
    // then nothing at all for three seconds.
    rec.run(0.4, downCorridor(grid, 144));
    rec.run(3, FAR_AWAY);

    expect(rec.states).toEqual([STATE.PATROL]);
    expect(brain.alertness.value).toBe(0);
  });

  it('takes a beat before it even turns to look', () => {
    const { grid, brain } = corridorGuard();
    const rec = new Recorder(brain);
    const player = downCorridor(grid, 144);

    rec.runUntil(STATE.SUSPICIOUS, 3, player);
    const headingOnSeeing = brain.heading;

    // For the length of `alertPause` the guard does not move or turn at all.
    rec.run(CONFIG.enemy.alertPause * 0.5, player);
    expect(brain.speed).toBe(0);
    expect(brain.heading).toBeCloseTo(headingOnSeeing, 6);

    // Once the beat is over, it faces the sighting squarely and walks at it.
    rec.run(CONFIG.enemy.alertPause, player);
    expect(brain.heading).toBeCloseTo(0, 1);
    expect(brain.speed).toBeGreaterThan(0);
  });

  it('goes back to its route when nothing comes of it', () => {
    const { grid, brain } = corridorGuard();
    const rec = new Recorder(brain);

    rec.runUntil(STATE.SUSPICIOUS, 3, downCorridor(grid, 144));
    rec.run(6, FAR_AWAY);

    expect(rec.after(STATE.SUSPICIOUS)).toBe(STATE.PATROL);
    expect(brain.alertness.value).toBe(0);
    // And back on the loop, not stranded wherever the doubt left it.
    expect([0, 1]).toContain(brain.waypointIndex);
  });
});

describe('search', () => {
  it('searches where the player was last seen instead of going home', () => {
    const { grid, brain } = corridorGuard();
    const rec = new Recorder(brain);

    // 150px east of the post: 230, comfortably inside a tile rather than on the
    // boundary at 224, so stopping a stride short cannot cross into the tile
    // next door and make the assertion below wrong for the right reason.
    rec.runUntil(STATE.CHASE, 5, downCorridor(grid, 150));
    const lastSeen = { ...brain.lastKnownPos };

    rec.runUntil(STATE.RETURN, 15, FAR_AWAY);

    // The regression this phase exists for. Losing a chase used to send the
    // guard straight home, where it could be re-triggered a frame later.
    expect(rec.states).toEqual([
      STATE.PATROL,
      STATE.SUSPICIOUS,
      STATE.CHASE,
      STATE.SEARCH,
      STATE.RETURN,
    ]);
    expect(rec.after(STATE.CHASE)).toBe(STATE.SEARCH);
    expect(rec.visits(STATE.CHASE)).toBe(1);

    // It searched the tile the player was standing in rather than the post it
    // was walking toward. Comparing tiles rather than pixels because routes
    // land on tile centres, which are up to half a tile from the point asked
    // for.
    expect(grid.worldToCell(brain.x, brain.y)).toEqual(grid.worldToCell(lastSeen.x, lastSeen.y));

    // And only then walked home, once.
    rec.runUntil(STATE.PATROL, 10, FAR_AWAY);
    expect(rec.visits(STATE.RETURN)).toBe(1);
  });

  it('gives up after its time budget, whether or not it had far to go', () => {
    const { grid, brain } = corridorGuard();
    const rec = new Recorder(brain);

    rec.runUntil(STATE.CHASE, 5, downCorridor(grid, 144));
    rec.runUntil(STATE.SEARCH, 5, FAR_AWAY);

    const startedSearchingAt = rec.elapsed;
    rec.runUntil(STATE.RETURN, 10, FAR_AWAY);
    const spentSearching = rec.elapsed - startedSearchingAt;

    expect(spentSearching).toBeGreaterThanOrEqual(CONFIG.enemy.searchDuration);
    expect(spentSearching).toBeLessThan(CONFIG.enemy.searchDuration + 0.5);
  });

  it('sweeps the ground it is standing on', () => {
    const { grid, brain } = corridorGuard();
    const rec = new Recorder(brain);

    rec.runUntil(STATE.CHASE, 5, downCorridor(grid, 144));
    rec.runUntil(STATE.SEARCH, 5, FAR_AWAY);

    const headings = [];
    rec.run(3, () => {
      headings.push(brain.heading);
      return FAR_AWAY;
    });

    const spread = Math.max(...headings) - Math.min(...headings);
    expect(spread).toBeGreaterThan(0.2);
  });

  it('goes straight back to the chase when the player reappears', () => {
    // An open room, so the player can be held in front of a guard whose head is
    // sweeping about without ever landing inside a wall.
    const grid = openRoom();
    const brain = new EnemyBrain({
      x: grid.spawn.x + 288,
      y: grid.spawn.y,
      heading: 0,
      waypoints: grid.waypoints,
      startIndex: 0,
      grid,
    });
    const rec = new Recorder(brain);

    rec.runUntil(STATE.CHASE, 6, { x: brain.x - 150, y: brain.y });
    expect(brain.state).toBe(STATE.CHASE);

    rec.runUntil(STATE.SEARCH, 5, FAR_AWAY);
    expect(brain.state).toBe(STATE.SEARCH);

    // Back in view while the guard is still warm on the trail: there is no
    // second meter to fill, so it goes straight back to chasing.
    const shown = () => inFrontOrNowhere(brain, 40);
    rec.runUntil(STATE.CHASE, 2, shown);

    expect(rec.after(STATE.SEARCH)).toBe(STATE.CHASE);
    expect(rec.visits(STATE.SUSPICIOUS)).toBe(1);
  });
});

describe('attack', () => {
  it('swings at a steady cadence while the player stays close', () => {
    let hits = 0;
    const { grid, brain } = corridorGuard({
      onHit: () => {
        hits += 1;
      },
    });

    const rec = new Recorder(brain);
    rec.run(8, downCorridor(grid, 30));

    expect(rec.states).toContain(STATE.ATTACK);
    expect(hits).toBeGreaterThanOrEqual(4);

    // One blow per windup + cooldown, not one per frame: the whole point of the
    // pair of timers. Without the cooldown this would be in the hundreds.
    const perSwing = CONFIG.enemy.attackWindup + CONFIG.enemy.attackCooldown;
    const swingingFor = rec.elapsed - rec.firstAt(STATE.ATTACK);
    expect(hits).toBeLessThanOrEqual(swingingFor / perSwing + 1);
  });

  it('stops swinging when the player gets away', () => {
    const { grid, brain } = corridorGuard();
    const rec = new Recorder(brain);

    rec.runUntil(STATE.ATTACK, 8, downCorridor(grid, 30));

    // Out of the exit radius but still in plain sight, so this is testing the
    // radius and not the rule about losing sight.
    rec.runUntil(STATE.CHASE, 3, downCorridor(grid, 150));

    expect(rec.after(STATE.ATTACK)).toBe(STATE.CHASE);
    expect(brain.swinging).toBe(false);
  });

  it('reports a hit without needing to know what it means', () => {
    const seen = [];
    const { grid, brain } = corridorGuard({ onHit: (guard) => seen.push(guard) });

    const rec = new Recorder(brain);
    rec.runUntil(STATE.ATTACK, 8, downCorridor(grid, 30));
    rec.run(2, downCorridor(grid, 30));

    expect(seen.length).toBeGreaterThan(0);
    expect(seen[0]).toBe(brain);
    expect(brain.hitsLanded).toBe(seen.length);
  });
});

describe('awareness housekeeping', () => {
  it('stays in the hunt through brief losses of sight', () => {
    const { grid, brain } = corridorGuard();
    const rec = new Recorder(brain);
    const player = downCorridor(grid, 144);

    rec.runUntil(STATE.CHASE, 5, player);

    // Ducking out of view for less than the loss budget, over and over. On the
    // old rules each of these gaps was enough to end the chase, which is what
    // made a guard at the edge of cover pulse between states.
    const gap = CONFIG.enemy.losLostTime / 2;
    for (let i = 0; i < 20; i += 1) {
      rec.run(gap, player);
      rec.run(gap, FAR_AWAY);
    }

    expect(rec.visits(STATE.CHASE)).toBe(1);
    expect(rec.visits(STATE.SEARCH)).toBe(0);
    expect(rec.visits(STATE.RETURN)).toBe(0);
  });

  it('forgets everything on reset', () => {
    const { grid, brain } = corridorGuard();

    const rec = new Recorder(brain);
    rec.runUntil(STATE.ATTACK, 8, downCorridor(grid, 30));
    // Keep swinging until a blow actually lands: reaching the state only means
    // the wind-up has started.
    rec.run(CONFIG.enemy.attackWindup + 0.2, downCorridor(grid, 30));
    expect(brain.hitsLanded).toBeGreaterThan(0);

    brain.reset();

    expect(brain.state).toBe(STATE.PATROL);
    expect(brain.alertness.value).toBe(0);
    expect(brain.timeSinceSeen).toBe(Infinity);
    expect(brain.hitsLanded).toBe(0);
    expect(brain.swinging).toBe(false);
    expect(brain.searchTarget).toBeNull();
  });
});
