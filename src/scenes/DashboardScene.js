import Phaser from 'phaser';

import { CONFIG } from '../config.js';
import { Grid } from '../world/Grid.js';
import { LEVELS, LEVEL_COUNT, DEFAULT_LEVEL, levelAt, configFor } from '../world/Levels.js';
import { buildBriefing } from '../world/Briefing.js';
import { RunStats, browserStorage } from '../world/RunStats.js';
import { formatDuration } from '../utils/Clock.js';
import { SOUND } from '../utils/Audio.js';

/** Where a panel puts its values, measured from the panel's left edge. */
const LABEL_WIDTH = 112;
const ROW_HEIGHT = 15;

/** Below the ladder and its caption line. */
const PANEL_TOP = 130;
const PANEL_GAP = 8;

/** The ladder tiles: ten rungs, one box each, sized to fit the page exactly. */
const TILE_WIDTH = 72;
const TILE_HEIGHT = 40;
const TILE_GAP = 4;
const LADDER_X = 20;
const LADDER_Y = 68;

function tileShortName(name) {
  const upper = name.toUpperCase();
  if (upper === 'EXECUTIVE WING') return 'EXECUTIVE';
  if (upper === 'SECURITY WING') return 'SECURITY';
  if (upper === 'THE EXCHANGE') return 'EXCHANGE';
  return upper;
}

/**
 * Phaser's names for the number keys, so a level can be picked with 1-0. Ten
 * rungs, one key each: the tenth is ZERO, the way a keyboard actually ends.
 */
const DIGIT_KEYS = ['ONE', 'TWO', 'THREE', 'FOUR', 'FIVE', 'SIX', 'SEVEN', 'EIGHT', 'NINE', 'ZERO'];

/**
 * The start page.
 *
 * Three things make this a dashboard rather than a title card. The numbers on
 * it are the real ones: the roster comes from the same rule the level spawns
 * its guards from, the guard figures are quoted from the config they run on,
 * and the record is what you have actually done. The ladder reads like a
 * ladder: every rung carries what that level turns up and, where you have
 * cleared it, your own best escape. And the level behind it is running - the
 * same `Game` scene, in shadow mode, walking its guards around their loop
 * because there is nobody on the floor to notice yet.
 *
 * It draws, and nothing else. Every word on the page is assembled by
 * `world/Briefing.js`, so there is no arithmetic and no wording in here to get
 * wrong, and a missing guard or a wrong count is a failing test rather than a
 * panel that quietly lies.
 */
export default class DashboardScene extends Phaser.Scene {
  constructor() {
    super('Dashboard');
  }

  /**
   * @param {{levelIndex?: number}} [data] which level is on the board. The scene
   *   restarts itself when the selection changes, so this is how a selection
   *   survives the rebuild.
   */
  init(data) {
    this.levelIndex = data?.levelIndex ?? DEFAULT_LEVEL;
  }

  create() {
    this.started = false;
    this.level = levelAt(this.levelIndex);

    // The level goes up first so the board has something to sit over, and it
    // goes up in shadow mode: guards walk the loop and never notice anything,
    // because there is no player on the level yet to notice. Relaunching it is
    // what makes the backdrop follow the selection.
    this.scene.stop('Game');
    this.scene.launch('Game', { shadow: true, levelIndex: this.levelIndex });
    this.scene.bringToTop();

    // One record for the whole page: the ladder's cleared marks, the rungs'
    // best times and the record panel all read the same object, so they cannot
    // disagree with each other.
    this.stats = new RunStats({ storage: browserStorage() });

    this.briefing = buildBriefing({
      grid: new Grid(this.level.rows),
      stats: this.stats,
      config: configFor(this.level),
      level: this.level,
    });

    this._drawDim();
    this._drawHeader();
    this._drawLadder();
    this._drawPanels();
    this._drawHint();

    this.input.keyboard.on('keydown', () => SOUND.init());
    this.input.on('pointerdown', () => SOUND.init());
    this.input.keyboard.on('keydown-M', () => {
      SOUND.toggleMute();
      this._updateSoundIndicator();
    });

    this.input.keyboard.on('keydown-SPACE', () => this.startRun());
    this.input.keyboard.on('keydown-ENTER', () => this.startRun());
    this.input.on('pointerdown', (pointer, hit) => {
      // A click on a ladder tile picks that level rather than starting a run:
      // the tiles say what they do, so the page has to behave accordingly.
      if (hit === undefined || hit.length === 0) this.startRun();
    });

    // Pick a level: the number keys pick it outright, the arrows walk the
    // ladder. Both rebuild the page, which is what makes the panels describe the
    // level you are looking at rather than the one you started on.
    LEVELS.forEach((_level, index) => {
      this.input.keyboard.on(`keydown-${DIGIT_KEYS[index]}`, () => this.selectLevel(index));
    });
    this.input.keyboard.on('keydown-LEFT', () => this.selectLevel(this.levelIndex - 1));
    this.input.keyboard.on('keydown-RIGHT', () => this.selectLevel(this.levelIndex + 1));
  }

  /**
   * Hands over to a real run of the level on the board.
   *
   * The level is started with an explicit payload rather than with none, and
   * that is not belt-and-braces: Phaser only overwrites a scene's stored data
   * when the payload it is given is truthy, so `start('Game')` on its own would
   * restart the level holding the `{ shadow: true }` it was launched with, and
   * hand the player a run with no player in it.
   *
   * The backdrop is stopped rather than left underneath: the run that follows is
   * a fresh scene with a player in it, and two copies of the level fighting over
   * the same input is not a state worth being able to reach.
   */
  startRun() {
    if (this.started) return;
    this.started = true;

    this.scene.stop('Game');
    this.scene.start('Game', { shadow: false, levelIndex: this.levelIndex });
  }

  /**
   * Moves the board to another level.
   *
   * Out-of-range indices are not an error: `levelAt` clamps them and the arrows
   * wrap, so holding a direction just walks the ladder round.
   */
  selectLevel(index) {
    const wrapped = ((index % LEVEL_COUNT) + LEVEL_COUNT) % LEVEL_COUNT;
    if (levelAt(wrapped).id === this.level.id) return;

    this.scene.restart({ levelIndex: wrapped });
  }

  _text(x, y, text, style = {}) {
    return this.add.text(x, y, text, {
      fontFamily: CONFIG.ui.font,
      resolution: 2,
      ...style,
    });
  }

  /** Drops the level back to a backdrop, so the panels read over it. */
  _drawDim() {
    this.add
      .rectangle(0, 0, CONFIG.map.widthPx, CONFIG.map.heightPx, 0x05070c, 0.55)
      .setOrigin(0, 0);
  }

  _drawHeader() {
    const { title, subtitle, note } = this.briefing;

    this._text(22, 12, title, {
      fontSize: '26px',
      color: '#eef2ff',
    });

    this._text(22, 44, subtitle, {
      fontSize: '12px',
      color: CONFIG.ui.label,
    });

    this._text(CONFIG.map.widthPx - 22, 44, note, {
      fontSize: '11px',
      color: '#5c6a90',
    }).setOrigin(1, 0);

    const tags = this.briefing.features;
    if (tags.length > 0) {
      this._text(22, 108, tags.join('  |  '), {
        fontSize: '11px',
        color: '#ffcf6b',
      });
    }
  }

  /**
   * The ten levels as a ladder: centered horizontally with 22px margins on both sides.
   */
  _drawLadder() {
    LEVELS.forEach((level, index) => {
      const selected = index === this.levelIndex;
      const x = LADDER_X + index * (TILE_WIDTH + TILE_GAP);
      const best = this.stats.bestTimeFor(index);
      const isGhost = this.stats.isGhostFor(index);

      const frame = this.add
        .rectangle(x, LADDER_Y, TILE_WIDTH, TILE_HEIGHT, CONFIG.ui.panel, selected ? 0.95 : 0.6)
        .setOrigin(0, 0)
        .setStrokeStyle(2, selected ? 0xffd166 : CONFIG.ui.panelLine, selected ? 1 : 0.55)
        .setInteractive({ useHandCursor: true });

      // Clicking a rung picks it; a click that lands on nothing else still
      // starts the run (the page-level pointer handler checks for hits).
      frame.on('pointerup', () => this.selectLevel(index));

      // Row 1: Index with selection arrow on the left, star badge on the right
      this._text(x + 6, LADDER_Y + 4, `${selected ? '>' : ''}${index + 1}`, {
        fontSize: '12px',
        fontStyle: selected ? 'bold' : 'normal',
        color: selected ? CONFIG.ui.hint : '#8b98bd',
      });

      if (isGhost) {
        this._text(x + TILE_WIDTH - 6, LADDER_Y + 4, '★', {
          fontSize: '11px',
          color: '#ffd166',
        }).setOrigin(1, 0);
      }

      // Row 2: Short level name, single line, cleanly spaced
      this._text(x + 6, LADDER_Y + 17, tileShortName(level.name), {
        fontSize: '8px',
        color: selected ? '#ffffff' : '#8b98bd',
      });

      // Row 3: Best escape time or dash
      this._text(x + 6, LADDER_Y + 28, best === null ? '—' : formatDuration(best), {
        fontSize: '9px',
        color: best === null ? '#3d4a6b' : isGhost ? '#ffd166' : '#9fe8a9',
      });
    });

    this._text(
      CONFIG.map.widthPx - 22,
      LADDER_Y + TILE_HEIGHT + 6,
      'number keys or left/right - click a rung to pick it',
      {
        fontSize: '11px',
        color: '#5c6a90',
      },
    ).setOrigin(1, 0);
  }

  /**
   * Balanced dashboard layout:
   * Left Column: The Job & Controls
   * Right Column: The Guards & How They Think
   * Lower Deck: Your Record (spanning full width, centered)
   */
  _drawPanels() {
    const sections = this.briefing.sections;
    const byHeading = Object.fromEntries(sections.map((s) => [s.heading, s]));

    const leftSections = [byHeading['THE JOB'], byHeading['CONTROLS']].filter(Boolean);
    const rightSections = [byHeading['THE GUARDS'], byHeading['HOW THEY THINK']].filter(Boolean);

    const columns = [
      { x: 22, width: 372, sections: leftSections },
      { x: 406, width: 372, sections: rightSections },
    ];

    let maxBottomY = PANEL_TOP;

    for (const column of columns) {
      let y = PANEL_TOP;

      for (const section of column.sections) {
        y += this._drawPanel(column.x, y, column.width, section) + PANEL_GAP;
      }
      if (y > maxBottomY) maxBottomY = y;
    }

    const record = byHeading['YOUR RECORD'];
    if (record) {
      this._drawRecordPanel(22, Math.max(386, maxBottomY), 756, record);
    }
  }

  /**
   * @returns {number} the panel's height, so the caller can stack the next one
   */
  _drawPanel(x, y, width, section) {
    const height = 24 + section.rows.length * ROW_HEIGHT;

    this.add
      .rectangle(x, y, width, height, CONFIG.ui.panel, CONFIG.ui.panelAlpha)
      .setOrigin(0, 0)
      .setStrokeStyle(1, CONFIG.ui.panelLine, 0.9);

    // The heading sits on a filled strip of its own.
    this.add.rectangle(x, y, width, 19, 0x101a2e, 0.9).setOrigin(0, 0);

    this._text(x + 10, y + 3, section.heading, {
      fontSize: '11px',
      color: CONFIG.ui.heading,
    });

    section.rows.forEach((row, index) => {
      const rowY = y + 23 + index * ROW_HEIGHT;

      this._text(x + 10, rowY, row.label, {
        fontSize: '11px',
        color: CONFIG.ui.label,
      });

      this._text(x + 10 + LABEL_WIDTH, rowY, row.value, {
        fontSize: '11px',
        color: CONFIG.ui.value,
      });
    });

    return height;
  }

  /**
   * Full-width centered scoreboard panel for persistent record statistics.
   */
  _drawRecordPanel(x, y, width, section) {
    const isNew = section.rows.length === 1 && section.rows[0].label === 'Nothing yet';
    const mid = Math.ceil(section.rows.length / 2);
    const rowCount = isNew ? 1 : mid;
    const height = 24 + rowCount * ROW_HEIGHT + 4;

    this.add
      .rectangle(x, y, width, height, CONFIG.ui.panel, CONFIG.ui.panelAlpha)
      .setOrigin(0, 0)
      .setStrokeStyle(1, CONFIG.ui.panelLine, 0.9);

    this.add.rectangle(x, y, width, 19, 0x101a2e, 0.9).setOrigin(0, 0);

    this._text(x + 10, y + 3, section.heading, {
      fontSize: '11px',
      color: CONFIG.ui.heading,
    });

    if (isNew) {
      this._text(x + 12, y + 23, section.rows[0].value, {
        fontSize: '11px',
        color: CONFIG.ui.label,
      });
      return height;
    }

    const col1 = section.rows.slice(0, mid);
    const col2 = section.rows.slice(mid);

    col1.forEach((row, i) => {
      const rowY = y + 23 + i * ROW_HEIGHT;
      this._text(x + 10, rowY, row.label, { fontSize: '11px', color: CONFIG.ui.label });
      this._text(x + 115, rowY, row.value, { fontSize: '11px', color: CONFIG.ui.value });
    });

    col2.forEach((row, i) => {
      const rowY = y + 23 + i * ROW_HEIGHT;
      this._text(x + 390, rowY, row.label, { fontSize: '11px', color: CONFIG.ui.label });
      this._text(x + 505, rowY, row.value, { fontSize: '11px', color: CONFIG.ui.value });
    });

    return height;
  }

  _drawHint() {
    const hint = this._text(CONFIG.map.widthPx / 2, CONFIG.map.heightPx - 22, this.briefing.hint, {
      fontSize: '15px',
      color: CONFIG.ui.hint,
    }).setOrigin(0.5);

    // A slow blink, so a page that is otherwise still says it is waiting for
    // you rather than finishing loading.
    this.tweens.add({
      targets: hint,
      alpha: 0.35,
      duration: 750,
      yoyo: true,
      repeat: -1,
    });

    this.soundIndicator = this._text(CONFIG.map.widthPx - 22, CONFIG.map.heightPx - 22, '', {
      fontSize: '11px',
      color: '#5c6a90',
    }).setOrigin(1, 0.5);

    this._updateSoundIndicator();
  }

  _updateSoundIndicator() {
    if (!this.soundIndicator) return;
    this.soundIndicator.setText(`M: ${SOUND.isMuted ? 'UNMUTE' : 'MUTE'}`);
    this.soundIndicator.setColor(SOUND.isMuted ? '#ff8888' : '#5c6a90');
  }
}
