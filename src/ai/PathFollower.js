import { CONFIG } from '../config.js';

/**
 * Walks an agent along a list of world-space waypoints.
 *
 * This module deliberately knows nothing about A\* or about the grid: it is
 * handed a path and drives the agent along it. That separation is what lets
 * the pathfinder be tested on its own and the follower be tested with a stub
 * agent.
 *
 * The agent must expose `x`, `y` and `steerTo(point, speed)`. `EnemyBrain`
 * satisfies that, so it can be stepped headlessly.
 */
export class PathFollower {
  constructor() {
    this.path = [];
    this.index = 0;
    this.stuckTimer = 0;
    this.markPos = { x: 0, y: 0 };
  }

  /** True while there is still a node left to walk to. */
  get hasPath() {
    return this.index < this.path.length;
  }

  get currentNode() {
    return this.path[this.index] ?? null;
  }

  get remaining() {
    return Math.max(0, this.path.length - this.index);
  }

  /**
   * @param {Array<{x: number, y: number}>} path
   * @param {{x: number, y: number}} [agent] used to anchor stuck detection
   */
  setPath(path, agent = null) {
    this.path = Array.isArray(path) ? path : [];
    this.index = 0;
    this.stuckTimer = 0;

    if (agent) this.markPos = { x: agent.x, y: agent.y };

    return this;
  }

  clear() {
    this.path = [];
    this.index = 0;
    this.stuckTimer = 0;
  }

  /**
   * Steps the agent toward the current node.
   *
   * @returns {{arrived: boolean, stuck: boolean, skipped: number}}
   *   `arrived` means the end of the path has been reached. `stuck` is a
   *   request for the caller to plan a fresh route: it fires once per
   *   `stuckTime` window in which the agent failed to make progress, so the
   *   caller is never asked to replan on every frame.
   */
  update(agent, dt, speed) {
    if (this.path.length === 0) {
      agent.velocity = { x: 0, y: 0 };
      return { arrived: true, stuck: false, skipped: 0 };
    }

    let skipped = 0;

    // Consume every node we are already standing on. arriveRadius is small
    // (4 px) and nodes sit a tile apart, so this advances at most one node on
    // a normal frame.
    while (this.hasPath && this._distanceTo(agent, this.currentNode) <= CONFIG.enemy.arriveRadius) {
      this.index += 1;
      skipped += 1;
    }

    if (!this.hasPath) {
      // Zero the velocity rather than letting the last steering force persist:
      // that is what makes a guard orbit its final waypoint forever.
      agent.velocity = { x: 0, y: 0 };
      return { arrived: true, stuck: false, skipped };
    }

    agent.steerTo(this.currentNode, speed);

    return { arrived: false, stuck: this._checkStuck(agent, dt), skipped };
  }

  /**
   * Progress is measured over a whole `stuckTime` window rather than per frame.
   * A guard walking at 80 px/s moves about 1.3 px in a frame, which is less
   * than `stuckDist`, so a per-frame test would report every guard as stuck.
   *
   * A stalled guard is not lost: the brain answers this by planning a fresh
   * route from where it stands, which is what actually clears a wedge. The
   * signal repeats at most once per window, so that costs one A\* per second
   * at worst.
   */
  _checkStuck(agent, dt) {
    this.stuckTimer += dt;
    if (this.stuckTimer < CONFIG.enemy.stuckTime) return false;

    const travelled = Math.hypot(agent.x - this.markPos.x, agent.y - this.markPos.y);

    this.stuckTimer = 0;
    this.markPos = { x: agent.x, y: agent.y };

    return travelled < CONFIG.enemy.stuckDist;
  }

  _distanceTo(agent, point) {
    return Math.hypot(point.x - agent.x, point.y - agent.y);
  }
}

export default PathFollower;
