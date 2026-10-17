import Phaser from 'phaser';

import { CONFIG } from '../config.js';
import { Grid } from '../world/Grid.js';
import { LEVEL_ROWS } from '../world/LevelData.js';
import { buildBriefing } from '../world/Briefing.js';
import { RunStats, browserStorage } from '../world/RunStats.js';

/** Where a panel puts its values, measured from the panel's left edge. */
const LABEL_WIDTH = 112;
const ROW_HEIGHT = 17;

/**
 * The start page.
 *
 * Two things make this a dashboard rather than a title card. The numbers on it
 * are the real ones: the roster comes from the same rule the level spawns its
 * guards from, the guard figures are quoted from the config they run on, and
 * the record is what you have actually done. And the level behind it is
 * running - the same `Game` scene, in shadow mode, walking its guards around
 * their loop because there is nobody on the floor to notice yet.
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

  create() {
    // The level goes up first so the board has something to sit over, and it
    // goes up in shadow mode: guards walk the loop and never notice anything,
    // because there is no player on the level yet to notice.
    this.scene.launch('Game', { shadow: true });
    this.scene.bringToTop();

    this.started = false;

    this.briefing = buildBriefing({
      grid: new Grid(LEVEL_ROWS),
      stats: new RunStats({ storage: browserStorage() }),
    });

    this._drawDim();
    this._drawHeader();
    this._drawPanels();
    this._drawHint();

    this.input.keyboard.on('keydown-SPACE', () => this.startRun());
    this.input.keyboard.on('keydown-ENTER', () => this.startRun());
    this.input.on('pointerdown', () => this.startRun());
  }

  /**
   * Hands over to a real run.
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
    this.scene.start('Game', { shadow: false });
  }

  /** Drops the level back to a backdrop, so the panels read over it. */
  _drawDim() {
    this.add
      .rectangle(0, 0, CONFIG.map.widthPx, CONFIG.map.heightPx, 0x05070c, 0.55)
      .setOrigin(0, 0);
  }

  _drawHeader() {
    const { title, subtitle, note } = this.briefing;

    this.add.text(20, 12, title, {
      fontFamily: CONFIG.ui.font,
      fontSize: '26px',
      color: '#eef2ff',
    });

    this.add.text(20, 46, subtitle, {
      fontFamily: CONFIG.ui.font,
      fontSize: '13px',
      color: CONFIG.ui.label,
    });

    this.add
      .text(CONFIG.map.widthPx - 20, 50, note, {
        fontFamily: CONFIG.ui.font,
        fontSize: '12px',
        color: '#5c6a90',
      })
      .setOrigin(1, 0);
  }

  /**
   * Two columns of panels: the briefing on the left, the guards and the record
   * on the right, which is roughly level and leaves the bottom of the screen
   * showing the patrol the page is describing.
   */
  _drawPanels() {
    const sections = this.briefing.sections;
    const columns = [
      { x: 20, width: 372, sections: sections.slice(0, 2) },
      { x: 404, width: 376, sections: sections.slice(2) },
    ];

    for (const column of columns) {
      let y = 76;

      for (const section of column.sections) {
        y += this._drawPanel(column.x, y, column.width, section) + 12;
      }
    }
  }

  /**
   * @returns {number} the panel's height, so the caller can stack the next one
   */
  _drawPanel(x, y, width, section) {
    const height = 34 + section.rows.length * ROW_HEIGHT;

    this.add
      .rectangle(x, y, width, height, CONFIG.ui.panel, CONFIG.ui.panelAlpha)
      .setOrigin(0, 0)
      .setStrokeStyle(1, CONFIG.ui.panelLine, 0.9);

    this.add.text(x + 12, y + 8, section.heading, {
      fontFamily: CONFIG.ui.font,
      fontSize: '12px',
      color: CONFIG.ui.heading,
    });

    section.rows.forEach((row, index) => {
      const rowY = y + 28 + index * ROW_HEIGHT;

      this.add.text(x + 12, rowY, row.label, {
        fontFamily: CONFIG.ui.font,
        fontSize: '12px',
        color: CONFIG.ui.label,
      });

      this.add.text(x + 12 + LABEL_WIDTH, rowY, row.value, {
        fontFamily: CONFIG.ui.font,
        fontSize: '12px',
        color: CONFIG.ui.value,
      });
    });

    return height;
  }

  _drawHint() {
    const hint = this.add
      .text(CONFIG.map.widthPx / 2, CONFIG.map.heightPx - 30, this.briefing.hint, {
        fontFamily: CONFIG.ui.font,
        fontSize: '17px',
        color: CONFIG.ui.hint,
      })
      .setOrigin(0.5);

    // A slow blink, so a page that is otherwise still says it is waiting for
    // you rather than finishing loading.
    this.tweens.add({
      targets: hint,
      alpha: 0.35,
      duration: 750,
      yoyo: true,
      repeat: -1,
    });
  }
}
