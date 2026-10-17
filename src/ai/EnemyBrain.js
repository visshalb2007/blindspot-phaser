import { CONFIG } from '../config.js';
import { Timer } from '../utils/Timer.js';
import { degToRad } from '../world/geometry.js';
import { Perception } from './Perception.js';
import { StateMachine } from './StateMachine.js';
import { STATE, createGuardStates } from './states.js';

/**
 * All of a guard's decision making, with no Phaser import anywhere.
 *
 * The brain owns its own position and integrates its own movement, which means
 * a headless test can step it in a fixed loop and assert on the exact state
 * sequence. `src/entities/Enemy.js` is a thin sprite that copies `x`, `y` and
 * `heading` out of the brain and draws them.
 *
 * Per-frame order matters and is deliberate:
 *   1. sense      - what can the guard see right now?
 *   2. decide     - run the state machine, which may transition
 *   3. act        - move, then slide along anything solid
 */
export class EnemyBrain {
  constructor({
    name = 'guard',
    x,
    y,
    heading = 0,
    waypoints = [],
    startIndex = 0,
    grid = null,
    lineOfSight = null,
  } = {}) {
    this.name = name;
    this.radius = CONFIG.enemy.radius;
    this.grid = grid;

    this.spawn = { x, y, heading, startIndex };
    this.x = x;
    this.y = y;
    this.heading = heading;
    this.baseHeading = heading;

    this.velocity = { x: 0, y: 0 };
    this.target = { x, y };
    this.sight = this._blankSight();
    this.lastKnownPos = null;

    this.waypoints = waypoints;
    this.waypointIndex = startIndex % Math.max(1, waypoints.length);
    this.returnIndex = this.waypointIndex;
    this.waiting = false;
    this.waitTimer = new Timer(CONFIG.enemy.waitAtWaypoint);

    this.lookAroundAngle = 0;
    this.lookAroundDirection = 1;

    this.perception = new Perception({
      canSee: lineOfSight ? (self, target) => lineOfSight.canSee(self, target) : null,
    });

    this.fsm = new StateMachine({
      states: createGuardStates(),
      initial: STATE.PATROL,
      owner: this,
      minStateTime: CONFIG.enemy.minStateTime,
    });
  }

  // ------------------------------------------------------------ observation

  get state() {
    return this.fsm.current;
  }

  get timeInState() {
    return this.fsm.timeInState;
  }

  get speed() {
    return Math.hypot(this.velocity.x, this.velocity.y);
  }

  /** Two or more waypoints means a real route; fewer arms the scan fallback. */
  get hasPatrolRoute() {
    return this.waypoints.length >= 2;
  }

  get usingLookAroundFallback() {
    return !this.hasPatrolRoute;
  }

  get currentWaypoint() {
    return this.waypoints[this.waypointIndex] ?? null;
  }

  get position() {
    return { x: this.x, y: this.y };
  }

  // -------------------------------------------------------------- per frame

  update(dt, target) {
    this.senseTarget(target ?? this.target);
    this.fsm.update(dt);
    this._integrate(dt);
  }

  senseTarget(target) {
    this.target = { x: target.x, y: target.y };
    this.sight = this.perception.sense(this, this.heading, target);

    if (this.sight.seen) {
      this.lastKnownPos = { x: target.x, y: target.y };
    }

    return this.sight;
  }

  canSeeTarget() {
    return this.sight.seen;
  }

  // -------------------------------------------------------------- movement

  /**
   * Points the guard at a target and sets its velocity.
   *
   * @returns {number} the distance to the target, before moving
   */
  steerTo(target, speed) {
    const dx = target.x - this.x;
    const dy = target.y - this.y;
    const dist = Math.hypot(dx, dy);

    if (dist < 1e-6) {
      this.velocity = { x: 0, y: 0 };
      return 0;
    }

    this.velocity = { x: (dx / dist) * speed, y: (dy / dist) * speed };
    this.heading = Math.atan2(dy, dx);
    return dist;
  }

  /**
   * Moves by velocity x dt, refusing to enter a solid tile.
   *
   * If the full step is blocked it retries on each axis alone, so the guard
   * slides along a wall instead of stopping dead. Phase 6 replaces this with
   * real A\* path following - this is a safety net, not a navigation system.
   */
  _integrate(dt) {
    const dx = this.velocity.x * dt;
    const dy = this.velocity.y * dt;

    if (dx === 0 && dy === 0) return;

    if (this.canStandAt(this.x + dx, this.y + dy)) {
      this.x += dx;
      this.y += dy;
      return;
    }
    if (dx !== 0 && this.canStandAt(this.x + dx, this.y)) {
      this.x += dx;
      return;
    }
    if (dy !== 0 && this.canStandAt(this.x, this.y + dy)) {
      this.y += dy;
      return;
    }

    this.velocity = { x: 0, y: 0 };
  }

  /**
   * Samples four points around the guard's footprint rather than only its
   * centre, so a guard whose centre is still on the floor cannot push its
   * shoulders into a wall.
   */
  canStandAt(x, y) {
    if (!this.grid) return true;

    const r = this.radius;
    return (
      !this.grid.isWallAtWorld(x - r, y) &&
      !this.grid.isWallAtWorld(x + r, y) &&
      !this.grid.isWallAtWorld(x, y - r) &&
      !this.grid.isWallAtWorld(x, y + r)
    );
  }

  // ----------------------------------------------------------------- patrol

  /** Called on entering PATROL, including from RETURN, so it resumes cleanly. */
  onEnterPatrol() {
    this.waiting = false;
    this.waitTimer.reset();
    this.lookAroundAngle = 0;
    this.lookAroundDirection = 1;
  }

  patrolStep(dt) {
    // Fewer than two waypoints is a configuration problem, not a reason to
    // freeze: the guard stands still and scans instead.
    if (this.usingLookAroundFallback) {
      this.velocity = { x: 0, y: 0 };
      this._lookAround(dt);
      return;
    }

    if (this.waiting) {
      this.velocity = { x: 0, y: 0 };
      this._lookAround(dt);

      if (this.waitTimer.tick(dt)) {
        this.waiting = false;
        this.advanceWaypoint();
      }
      return;
    }

    const dist = this.steerTo(this.currentWaypoint, CONFIG.enemy.patrolSpeed);

    if (dist <= CONFIG.enemy.arriveRadius) {
      this.velocity = { x: 0, y: 0 };
      this.waiting = true;
      this.lookAroundAngle = 0;
      this._faceNextWaypoint();
      this.waitTimer.start();
    }
  }

  advanceWaypoint() {
    this.waypointIndex = (this.waypointIndex + 1) % this.waypoints.length;
    this.lookAroundAngle = 0;
  }

  /** Turns to face where the route continues, so the pause reads as a scan. */
  _faceNextWaypoint() {
    const next = this.waypoints[(this.waypointIndex + 1) % this.waypoints.length];
    if (!next) return;

    const dx = next.x - this.x;
    const dy = next.y - this.y;
    if (dx === 0 && dy === 0) return;

    this.baseHeading = Math.atan2(dy, dx);
    this.heading = this.baseHeading;
  }

  /** Sweeps the head back and forth across `baseHeading`. */
  _lookAround(dt) {
    const sweep = degToRad(CONFIG.enemy.lookAroundSweep);

    this.lookAroundAngle += this.lookAroundDirection * degToRad(CONFIG.enemy.lookAroundRate) * dt;

    if (this.lookAroundAngle > sweep) {
      this.lookAroundAngle = sweep;
      this.lookAroundDirection = -1;
    } else if (this.lookAroundAngle < -sweep) {
      this.lookAroundAngle = -sweep;
      this.lookAroundDirection = 1;
    }

    this.heading = this.baseHeading + this.lookAroundAngle;
  }

  // ------------------------------------------------------------------ reset

  reset() {
    this.x = this.spawn.x;
    this.y = this.spawn.y;
    this.heading = this.spawn.heading;
    this.baseHeading = this.spawn.heading;

    this.velocity = { x: 0, y: 0 };
    this.target = { x: this.x, y: this.y };
    this.sight = this._blankSight();
    this.lastKnownPos = null;

    this.waypointIndex = this.spawn.startIndex % Math.max(1, this.waypoints.length);
    this.returnIndex = this.waypointIndex;
    this.waiting = false;
    this.waitTimer.reset();

    this.lookAroundAngle = 0;
    this.lookAroundDirection = 1;

    this.perception.reset();
    this.fsm.reset();
    this.onEnterPatrol();
  }

  _blankSight() {
    return {
      seen: false,
      distance: Infinity,
      angleOffset: 0,
      inRange: false,
      inCone: false,
      clearLine: true,
      limit: CONFIG.enemy.sightRange,
    };
  }
}

export default EnemyBrain;
