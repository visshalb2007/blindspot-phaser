import { CONFIG } from '../config.js';

/**
 * Where the guards stand when a level starts, and which way they are looking.
 *
 * Pure, and deliberately the single rule for this: the game spawns from it and
 * the start page lists its roster from it, so the start page cannot promise a
 * guard the level never posts, or miss one it does. It was pulled out of
 * `GameScene` when the dashboard needed to say how many guards were on shift,
 * which is the usual way duplication announces itself.
 *
 * Guards start *on* their posts rather than beside them: the first frame then
 * counts as an arrival, so a guard pauses and scans before setting off, exactly
 * as it does after every other waypoint.
 *
 * @param {import('./Grid.js').Grid} grid
 * @param {{count?: number}} [options] how many guards the level would like
 * @returns {Array<{name: string, startIndex: number, order: number, x: number, y: number, heading: number}>}
 */
export function guardPosts(grid, { count = CONFIG.enemy.count } = {}) {
  const waypoints = grid?.waypoints ?? [];
  const wanted = Math.max(1, count);

  // A level cannot post more guards than it has waypoints to send them to: the
  // second guard on a one-waypoint loop would have nothing to walk to.
  const total = Math.max(1, Math.min(wanted, waypoints.length));

  // Fewer than two waypoints is no loop at all. Fall back to the player's spawn
  // tile, which is guaranteed walkable, and let the brain's look-around scan
  // stand in for the missing route.
  if (waypoints.length < 2) {
    const post = grid?.spawn ?? { x: 0, y: 0 };

    return Array.from({ length: total }, (_, index) => ({
      name: `guard-${index + 1}`,
      startIndex: 0,
      order: 0,
      x: post.x,
      y: post.y,
      heading: 0,
    }));
  }

  return Array.from({ length: total }, (_, index) => {
    // Evenly spaced posts, computed by ratio rather than by a stride so that
    // three guards around four waypoints do not land two of them together.
    const startIndex = Math.floor((index * waypoints.length) / total);
    const post = waypoints[startIndex];
    const next = waypoints[(startIndex + 1) % waypoints.length];

    return {
      name: `guard-${index + 1}`,
      startIndex,
      order: post.order,
      x: post.x,
      y: post.y,
      heading: Math.atan2(next.y - post.y, next.x - post.x),
    };
  });
}

export default guardPosts;
