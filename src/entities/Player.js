import { CONFIG } from '../config.js';
import { normalize } from '../world/geometry.js';
import { Stamina } from '../utils/Stamina.js';

/**
 * Thin Phaser wrapper around the player sprite.
 *
 * The player is the only entity that uses Arcade Physics: its body is a circle
 * that is deliberately smaller than the drawn sprite, so grazing a corner does
 * not stop you dead. Guards do not use physics at all - they follow A\* paths
 * (see `src/ai/PathFollower.js`).
 */
export class Player {
  constructor(scene, x, y) {
    this.scene = scene;
    this.spawnPoint = { x, y };
    this.stamina = new Stamina();

    this.sneaking = false;
    this.sprinting = false;
    this.noiseRadius = 0;

    this.sprite = scene.physics.add.sprite(x, y, 'player');
    this.sprite.setDepth(10);
    this.sprite.setTint(CONFIG.colors.player);
    this.sprite.setCollideWorldBounds(true);

    const radius = CONFIG.player.radius;
    this.sprite.body.setCircle(
      radius,
      this.sprite.width / 2 - radius,
      this.sprite.height / 2 - radius,
    );

    this.keys = scene.input.keyboard.addKeys({
      up: 'W',
      down: 'S',
      left: 'A',
      right: 'D',
      north: 'UP',
      south: 'DOWN',
      west: 'LEFT',
      east: 'RIGHT',
      sprint: 'SHIFT',
      sneak: 'CTRL',
    });

    this.reset();
  }

  get position() {
    return { x: this.sprite.x, y: this.sprite.y };
  }

  get isMoving() {
    return this.sprite.body.velocity.x !== 0 || this.sprite.body.velocity.y !== 0;
  }

  /**
   * Both WASD and the arrow keys drive the same axis, so either scheme works
   * and the two can be mixed without surprising results.
   */
  readInput() {
    const k = this.keys;
    const right = k.right.isDown || k.east.isDown;
    const left = k.left.isDown || k.west.isDown;
    const down = k.down.isDown || k.south.isDown;
    const up = k.up.isDown || k.north.isDown;

    return {
      x: (right ? 1 : 0) - (left ? 1 : 0),
      y: (down ? 1 : 0) - (up ? 1 : 0),
      wantsSprint: k.sprint.isDown,
      wantsSneak: k.sneak.isDown,
    };
  }

  update(dt) {
    const input = this.readInput();
    const moving = input.x !== 0 || input.y !== 0;

    this.sprinting = this.stamina.update(dt, input.wantsSprint, moving);

    const speed = this.sprinting ? CONFIG.player.sprint : CONFIG.player.speed;

    // Normalise before scaling: holding two directions must not make the
    // player faster than holding one.
    const dir = normalize(input.x, input.y);
    this.sprite.setVelocity(dir.x * speed, dir.y * speed);

    if (moving) {
      this.sprite.setRotation(Math.atan2(dir.y, dir.x));
    }
  }

  /** Puts the player back on the spawn tile with a full stamina bar. */
  reset() {
    this.sprite.setPosition(this.spawnPoint.x, this.spawnPoint.y);
    this.sprite.setVelocity(0, 0);
    this.sprite.setRotation(0);
    this.sneaking = false;
    this.sprinting = false;
    this.noiseRadius = 0;
    this.stamina.reset();
  }
}

export default Player;
