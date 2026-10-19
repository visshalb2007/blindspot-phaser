import { CONFIG } from '../config.js';
import { formatDuration } from '../utils/Clock.js';
import { LEVELS, levelAt, gadgetsFor, relayFor, featuresFor } from './Levels.js';
import { OUTCOME } from './RunStats.js';
import { guardPosts } from './Roster.js';

/**
 * The keys, in the order somebody learns them.
 *
 * Kept next to the briefing rather than in `CONFIG` because they are words on a
 * panel, not a tunable: nothing reads a key binding out of here, and the README
 * documents the same list.
 */
export const CONTROLS = Object.freeze([
  { label: 'W A S D', value: 'move, arrow keys work too' },
  { label: 'Shift', value: 'sprint: fast, loud, tiring' },
  { label: 'Ctrl', value: 'sneak: silent and slow' },
  { label: 'F1', value: 'what the guards believe' },
  { label: 'R', value: 'restart the level' },
  { label: 'Esc', value: 'back to this page' },
]);

/**
 * Everything the start page says, worked out from things that are true.
 *
 * The scene that draws the dashboard does not know a guard from a chip: it
 * renders sections of label/value rows and nothing else. Keeping the wording
 * here means the numbers on the start page cannot drift from the level or the
 * config they describe - the sight range on the start page *is*
 * `CONFIG.enemy.sightRange`, and the roster is the level's own guard rule - and
 * it makes all of it assertable in a test, which a wall of `add.text` calls
 * never is.
 *
 * @param {{grid?: object, stats?: object, config?: object, level?: object}} [sources]
 *   `level` is an entry from `world/Levels.js`; it names the map, warns about
 *   it, and carries any gadget grant or radio wiring it has. `config` should be
 *   `configFor(level)` when a level tunes its own guards, which is how the
 *   roster and the quoted figures stay honest about who is on shift.
 * @returns {{title: string, subtitle: string, hint: string, note: string,
 *   features: Array<string>, sections: Array<{heading: string,
 *   rows: Array<{label: string, value: string}>}>}}
 */
export function buildBriefing({
  grid = null,
  stats = null,
  config = CONFIG,
  level = levelAt(),
} = {}) {
  const cols = grid?.cols ?? config.map.cols;
  const rows = grid?.rows ?? config.map.rows;

  return {
    title: config.title.toUpperCase(),
    subtitle: `${level.name} - level ${level.difficulty} of ${LEVELS.length} - ${cols} x ${rows} tiles`,
    hint: `SPACE or click to start - level ${level.difficulty}`,
    note: 'the level behind this page is live',
    // What turns this run up beyond geometry, derived from the level itself so
    // a start page card cannot claim a gadget or a relay it does not have.
    features: featuresFor(level),
    sections: [
      { heading: 'THE JOB', rows: jobRows(grid, level) },
      { heading: 'CONTROLS', rows: CONTROLS.map((row) => ({ ...row })) },
      { heading: 'THE GUARDS', rows: guardRows(grid, config) },
      { heading: 'HOW THEY THINK', rows: senseRows(config, level) },
      { heading: 'YOUR RECORD', rows: recordRows(stats) },
    ],
  };
}

function jobRows(grid, level) {
  const chips = grid?.chips?.length ?? 0;
  const decoys = gadgetsFor(level).decoys;

  return [
    { label: 'Data chips', value: `${chips}` },
    { label: 'The door', value: 'shut until every chip is in' },
    { label: 'Watch out', value: level.blurb },
    { label: 'Getting out', value: 'walk into it, that is the job' },
    // The gadget row only exists when the level actually issues anything, so a
    // panel never advertises a key that would do nothing on the floor.
    ...(decoys > 0
      ? [{ label: 'Q', value: `drop a noise decoy (${decoys} issued, one-time)` }]
      : []),
  ];
}

function guardRows(grid, config) {
  // Through the same rule the level spawns from, so the roster cannot list a
  // guard the level never posts, or miss one that it does.
  const posts = grid ? guardPosts(grid, { count: config.enemy.count }) : [];
  const waypoints = grid?.waypoints ?? [];
  const order = waypoints.map((wp) => wp.order).join(' - ');

  return [
    { label: 'On shift', value: `${posts.length} guard${posts.length === 1 ? '' : 's'}` },
    // One row per guard rather than one line listing them all: the roster reads
    // as a roster, and it stays inside the panel whatever the guard count is.
    ...posts.map((post) => ({ label: post.name, value: `starts at post ${post.order}` })),
    {
      label: 'The loop',
      value: order ? `${waypoints.length} posts: ${order}` : 'none, it stands and scans',
    },
  ];
}

/**
 * The guards' own numbers, quoted from the config they actually run on.
 *
 * This panel is the honest answer to "why did it see me": every figure here is
 * the one in `CONFIG.enemy`, so retuning a guard retunes what the start page
 * claims about it.
 */
function senseRows(config, level = null) {
  const enemy = config.enemy;
  const noise = config.player.noise;

  return [
    { label: 'Sight', value: `${enemy.sightRange}px, ${enemy.fov}° cone, clear line` },
    { label: 'Hearing', value: `${noise.walk}px walking, ${noise.sprint}px sprinting` },
    {
      label: 'Through walls',
      value: `${Math.round(enemy.hearingMuffled * 100)}% gets through a wall`,
    },
    {
      label: 'Certainty',
      value: `fills ${enemy.suspicionGain}/s, drains ${enemy.suspicionDecay}/s`,
    },
    { label: 'Chases at', value: `${enemy.chaseAt}/100` },
    // The one rule above that is not a number, and the one that decides most
    // runs: noise can bring a guard over, and it can never bring one running.
    { label: 'Noise alone', value: 'never enough to chase' },
    { label: 'Searching', value: `${enemy.searchDuration}s at the last place` },
    // The radio row only appears where the level actually wired one up.
    ...(level && relayFor(level)
      ? [{ label: 'Alarm relay', value: 'a chase is shouted to every guard' }]
      : []),
  ];
}

function recordRows(stats) {
  if (!stats || !stats.hasHistory) {
    return [{ label: 'Nothing yet', value: 'the clock starts when you do' }];
  }

  return [
    { label: 'Runs', value: String(stats.attempts) },
    { label: 'Escapes', value: `${stats.wins} (${Math.round(stats.winRate * 100)}%)` },
    { label: 'Caught', value: String(stats.catches) },
    ...(stats.ghosts > 0 ? [{ label: 'Ghost escapes', value: `${stats.ghosts} (undetected)` }] : []),
    ...(stats.cleans > 0 ? [{ label: 'Clean escapes', value: `${stats.cleans} (no hits)` }] : []),
    {
      label: 'Best time',
      value: stats.bestTime === null ? 'not yet' : formatDuration(stats.bestTime),
    },
    { label: 'Chips lifted', value: String(stats.chips) },
    {
      label: 'Levels cleared',
      value: `${stats.levelsCleared} of ${LEVELS.length}`,
    },
    { label: 'Last run', value: lastRunText(stats) },
  ];
}

function lastRunText(stats) {
  if (!stats.lastOutcome) return 'none finished';

  const how = stats.lastOutcome === OUTCOME.ESCAPED ? 'escaped' : 'caught';
  const when = stats.lastTime === null ? '' : ` in ${formatDuration(stats.lastTime)}`;
  const loot = `${stats.lastChips} chip${stats.lastChips === 1 ? '' : 's'}`;

  return `${how}${when}, ${loot}`;
}

export default buildBriefing;
