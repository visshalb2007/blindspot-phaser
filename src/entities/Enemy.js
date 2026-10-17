import { CONFIG } from '../config.js';
import { EnemyBrain } from '../ai/EnemyBrain.js';
import { colorFor, iconFor } from '../ai/states.js';
import { degToRad } from '../world/geometry.js';

/**
 * Thin Phaser wrapper around one guard.
 *
 * It draws nothing that the brain has not already decided: position, heading
 * and state all come out of `EnemyBrain`. Everything visible about a guard -
 * colour, icon, state text - is derived from `brain.state`, so what you see on
 * screen cannot disagree with what the AI is doing.
 */
export class Enemy {
  constructor(scene, options) {
    this.scene = scene;
    this.brain = new EnemyBrain(options);
    this.debugVisible = false;

    const { x, y } = this.brain;

    this.sprite = scene.add.image(x, y, 'enemy').setDepth(10);

    this.label = scene.add
      .text(x, y - 24, '', {
        fontFamily: 'ui-monospace, monospace',
        fontSize: '10px',
        color: '#ffffff',
      })
      .setOrigin(0.5)
      .setDepth(21);

    this.icon = scene.add
      .text(x, y - 40, '', {
        fontFamily: 'ui-monospace, monospace',
        fontSize: '16px',
        fontStyle: 'bold',
        color: '#ffffff',
      })
      .setOrigin(0.5)
      .setDepth(21);

    this.debug = scene.add.graphics().setDepth(6);

    // Reusing the state machine's own hook keeps the visuals in step with the
    // logic without the brain having to know that a sprite exists.
    this.brain.fsm.onChange = () => this.refreshStateVisuals();
    this.refreshStateVisuals();
  }

  get state() {
    return this.brain.state;
  }

  get position() {
    return this.brain.position;
  }

  /** Repaints the tint, label and icon from the brain's current state. */
  refreshStateVisuals() {
    const state = this.brain.state;
    const color = colorFor(state);

    this.sprite.setTint(color);
    this.label.setText(state);
    this.label.setColor(`#${color.toString(16).padStart(6, '0')}`);
    this.icon.setText(iconFor(state));
  }

  update(dt, target) {
    this.brain.update(dt, target);

    this.sprite.setPosition(this.brain.x, this.brain.y);
    this.sprite.setRotation(this.brain.heading);
    this.label.setPosition(this.brain.x, this.brain.y - 24);
    this.icon.setPosition(this.brain.x, this.brain.y - 40);

    if (this.debugVisible) this._drawDebug();
  }

  setDebugVisible(visible) {
    this.debugVisible = visible;
    if (!visible) this.debug.clear();
  }

  /**
   * Draw-only: the sight radius, the field-of-view wedge, the little arrival
   * radius and the A\* route the guard is following. Reachable only from the F1
   * overlay, so it cannot change behaviour.
   */
  _drawDebug() {
    const g = this.debug;
    const b = this.brain;
    const color = colorFor(b.state);
    const half = degToRad(CONFIG.enemy.fov) / 2;

    g.clear();

    g.fillStyle(color, 0.1);
    g.slice(b.x, b.y, CONFIG.enemy.sightRange, b.heading - half, b.heading + half, false);
    g.fillPath();

    g.lineStyle(1, color, 0.45);
    g.strokeCircle(b.x, b.y, CONFIG.enemy.sightRange);

    g.lineStyle(1, color, 0.9);
    g.strokeCircle(b.x, b.y, CONFIG.enemy.arriveRadius);

    this._drawSightRay(g, b);
    this._drawPath(g, b);
  }

  /**
   * The ray the guard's sight test actually cast this frame: green when the
   * player is in view, red when a wall cut it, with a cross where it stopped.
   *
   * Drawn from `brain.sightLine` rather than re-cast, so it cannot disagree
   * with the verdict it is meant to explain.
   */
  _drawSightRay(g, b) {
    const ray = b.sightLine;
    if (!ray || !b.target) return;

    const clear = ray.clear;

    g.lineStyle(1, clear ? 0x66ff99 : 0xff5566, clear ? 0.7 : 0.9);
    g.lineBetween(b.x, b.y, b.target.x, b.target.y);

    if (ray.blockedAt) {
      const { cx, cy } = ray.blockedAt;
      const size = CONFIG.tile / 3;
      const x = cx * CONFIG.tile + CONFIG.tile / 2;
      const y = cy * CONFIG.tile + CONFIG.tile / 2;

      g.lineBetween(x - size, y - size, x + size, y + size);
      g.lineBetween(x - size, y + size, x + size, y - size);
    }
  }

  /**
   * The planned route as a line from the guard through every remaining node.
   * Drawn from the follower's own cursor rather than re-planning, so what is on
   * screen is the path A\* produced and the part of it not yet walked.
   */
  _drawPath(g, brain) {
    const follower = brain.follower;
    if (!follower.hasPath) return;

    g.lineStyle(1, 0xffffff, 0.5);
    g.beginPath();
    g.moveTo(brain.x, brain.y);
    for (let i = follower.index; i < follower.path.length; i += 1) {
      const node = follower.path[i];
      g.lineTo(node.x, node.y);
    }
    g.strokePath();

    const next = follower.currentNode;
    if (next) {
      g.fillStyle(0xffffff, 0.9);
      g.fillCircle(next.x, next.y, 2.5);
    }
  }

  reset() {
    this.brain.reset();
    this.sprite.setPosition(this.brain.x, this.brain.y);
    this.sprite.setRotation(this.brain.heading);
    this.refreshStateVisuals();
    this.debug.clear();
  }
}

export default Enemy;
