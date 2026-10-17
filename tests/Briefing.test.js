import { describe, it, expect } from 'vitest';

import { CONFIG } from '../src/config.js';
import { Grid } from '../src/world/Grid.js';
import { LEVEL_ROWS } from '../src/world/LevelData.js';
import { LEVELS, configFor } from '../src/world/Levels.js';
import { RunStats, OUTCOME } from '../src/world/RunStats.js';
import { buildBriefing, CONTROLS } from '../src/world/Briefing.js';
import { guardPosts } from '../src/world/Roster.js';

const grid = new Grid(LEVEL_ROWS);
const HEADINGS = ['THE JOB', 'CONTROLS', 'THE GUARDS', 'HOW THEY THINK', 'YOUR RECORD'];

/** One panel, as a plain label -> value object. */
function panel(briefing, heading) {
  const section = briefing.sections.find((candidate) => candidate.heading === heading);
  if (!section) throw new Error(`no ${heading} panel`);

  return Object.fromEntries(section.rows.map((row) => [row.label, row.value]));
}

/** Stats as they would be after a win and two captures. */
function played() {
  const stats = new RunStats({ storage: null });

  stats.startRun().recordWin(83.44, 2);
  stats.startRun().recordCatch(12.5, 1);
  stats.startRun().recordCatch(9, 0);

  return stats;
}

describe('buildBriefing', () => {
  it('names the game and the level it is about to start', () => {
    const briefing = buildBriefing({ grid });

    expect(briefing.title).toBe(CONFIG.title.toUpperCase());
    expect(briefing.subtitle).toContain('Night Shift');
    expect(briefing.subtitle).toContain(`${grid.cols} x ${grid.rows}`);
  });

  it('names the level on the board and where it sits on the ladder', () => {
    const briefing = buildBriefing({ grid });

    expect(briefing.subtitle).toContain('level 1 of 5');
  });

  it('describes whichever level it is handed, not the first one', () => {
    const last = LEVELS[LEVELS.length - 1];
    const lastGrid = new Grid(last.rows);

    const briefing = buildBriefing({
      grid: lastGrid,
      config: configFor(last),
      level: last,
    });
    const job = panel(briefing, 'THE JOB');
    const guards = panel(briefing, 'THE GUARDS');

    expect(briefing.subtitle).toContain(last.name);
    expect(briefing.subtitle).toContain(`level ${last.difficulty} of 5`);
    expect(job['Data chips']).toBe(String(lastGrid.chips.length));
    expect(job['Watch out']).toBe(last.blurb);
    expect(guards['On shift']).toBe(`${last.guards} guards`);
  });

  it('lays out the panels a start page needs, in order', () => {
    const briefing = buildBriefing({ grid });

    expect(briefing.sections.map((section) => section.heading)).toEqual(HEADINGS);
    for (const section of briefing.sections) {
      expect(section.rows.length).toBeGreaterThan(0);
      for (const row of section.rows) {
        expect(typeof row.label).toBe('string');
        expect(typeof row.value).toBe('string');
      }
    }
  });

  it('states the objective the level actually has', () => {
    const job = panel(buildBriefing({ grid }), 'THE JOB');

    expect(job['Data chips']).toContain(String(grid.chips.length));
    expect(job['The door']).toMatch(/shut/i);
  });

  it('lists the guards the level actually posts', () => {
    const guards = panel(buildBriefing({ grid }), 'THE GUARDS');
    const posts = guardPosts(grid);

    expect(guards['On shift']).toBe(`${posts.length} guards`);
    expect(guards[posts[0].name]).toContain(`post ${posts[0].order}`);
    expect(guards[posts[1].name]).toContain(`post ${posts[1].order}`);
    expect(guards['The loop']).toContain('4 posts');
  });

  it('quotes the config rather than a remembered number', () => {
    // The whole point of building the page from the config: retune a guard and
    // the start page tells the truth about the new one.
    const config = {
      ...CONFIG,
      enemy: { ...CONFIG.enemy, count: 3, sightRange: 999, fov: 45, searchDuration: 7 },
    };

    const briefing = buildBriefing({ grid, config });

    expect(panel(briefing, 'THE GUARDS')['On shift']).toBe('3 guards');
    expect(panel(briefing, 'HOW THEY THINK').Sight).toContain('999px');
    expect(panel(briefing, 'HOW THEY THINK').Sight).toContain('45°');
    expect(panel(briefing, 'HOW THEY THINK').Searching).toContain('7s');
  });

  it('quotes the hearing the player actually makes', () => {
    const thoughts = panel(buildBriefing({ grid }), 'HOW THEY THINK');

    expect(thoughts.Hearing).toContain(`${CONFIG.player.noise.walk}px`);
    expect(thoughts.Hearing).toContain(`${CONFIG.player.noise.sprint}px`);
    expect(thoughts['Through walls']).toContain(
      `${Math.round(CONFIG.enemy.hearingMuffled * 100)}%`,
    );
  });

  it('documents every key the README documents', () => {
    const labels = CONTROLS.map((row) => row.label);

    expect(labels).toContain('W A S D');
    expect(labels).toContain('Shift');
    expect(labels).toContain('Ctrl');
    expect(labels).toContain('F1');
    expect(labels).toContain('R');
    expect(labels).toContain('Esc');
  });

  it('says nothing has been played when there is no record', () => {
    const record = panel(
      buildBriefing({ grid, stats: new RunStats({ storage: null }) }),
      'YOUR RECORD',
    );

    expect(Object.keys(record)).toEqual(['Nothing yet']);
  });

  it('reads the record off the stats it was handed', () => {
    const stats = played();
    expect(stats.lastOutcome).toBe(OUTCOME.CAUGHT);

    const record = panel(buildBriefing({ grid, stats }), 'YOUR RECORD');

    expect(record.Runs).toBe('3');
    expect(record.Escapes).toBe('1 (33%)');
    expect(record.Caught).toBe('2');
    expect(record['Best time']).toBe('1:23.4');
    expect(record['Chips lifted']).toBe('3');
    expect(record['Last run']).toBe('caught in 0:09.0, 0 chips');
  });

  it('says the best time is not set until somebody escapes', () => {
    const stats = new RunStats({ storage: null });
    stats.startRun().recordCatch(30, 1);

    const record = panel(buildBriefing({ grid, stats }), 'YOUR RECORD');

    expect(record['Best time']).toBe('not yet');
    expect(record['Last run']).toBe('caught in 0:30.0, 1 chip');
  });

  it('survives being handed nothing at all', () => {
    const briefing = buildBriefing();

    expect(briefing.sections.map((section) => section.heading)).toEqual(HEADINGS);
    expect(briefing.subtitle).toContain(`${CONFIG.map.cols} x ${CONFIG.map.rows}`);
    expect(panel(briefing, 'THE GUARDS')['The loop']).toBe('none, it stands and scans');
    expect(panel(briefing, 'YOUR RECORD')['Nothing yet']).toBeTruthy();
  });

  it('does not mind an unfinished last run', () => {
    const stats = new RunStats({ storage: null });
    stats.startRun();

    const record = panel(buildBriefing({ grid, stats }), 'YOUR RECORD');

    expect(record['Last run']).toBe('none finished');
    expect(record.Runs).toBe('1');
  });

  it('counts a single chip as one chip', () => {
    const stats = new RunStats({ storage: null });
    stats.startRun().recordCatch(5, 1);

    expect(panel(buildBriefing({ grid, stats }), 'YOUR RECORD')['Last run']).toContain('1 chip');
  });
});
