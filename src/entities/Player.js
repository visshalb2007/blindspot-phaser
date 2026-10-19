import { CONFIG } from '../config.js';
import { normalize } from '../world/geometry.js';
import { Health } from '../utils/Health.js';
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
    this.health = new Health();
    this.stamina = new Stamina();

    this.sneaking = false;
    this.sprinting = false;
    this.noiseRadius = 0;

    this.sprite = scene.physics.add.sprite(x, y, 'player');
    this.sprite.setDepth(10);
    this.sprite.setTint(CONFIG.colors.player);
    this.sprite.setCollideWorldBounds(true);

    this.staminaBar = scene.add.graphics().setDepth(12);
    this.noiseRing = scene.add.graphics().setDepth(4);

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
    this._tickHurt(dt);

    const input = this.readInput();
    const moving = input.x !== 0 || input.y !== 0;

    // Sneaking always wins over sprinting, and sprinting while sneaking would
    // be a contradiction, so the flag is cleared rather than combined.
    this.sneaking = input.wantsSneak;
    const wantsSprint = input.wantsSprint && !this.sneaking;
    this.sprinting = this.stamina.update(dt, wantsSprint, moving) && !this.sneaking;

    const speed = this.sneaking
      ? CONFIG.player.sneak
      : this.sprinting
        ? CONFIG.player.sprint
        : CONFIG.player.speed;

    // Normalise before scaling: holding two directions must not make the
    // player faster than holding one.
    const dir = normalize(input.x, input.y);
    this.sprite.setVelocity(dir.x * speed, dir.y * speed);

    if (moving) {
      this.sprite.setRotation(Math.atan2(dir.y, dir.x));
    }

    this.noiseRadius = moving ? this._currentNoiseRadius() : 0;
    this._drawFeedback(moving);
  }

  _drawFeedback(moving) {
    const { x, y } = this.sprite;

    // 1. Stamina bar underneath player
    this.staminaBar.clear();
    if (this.stamina.ratio < 0.99) {
      const barW = 20;
      const barH = 3;
      const barX = x - barW / 2;
      const barY = y + 14;

      this.staminaBar.fillStyle(0x0b1220, 0.85);
      this.staminaBar.fillRect(barX - 1, barY - 1, barW + 2, barH + 2);
      this.staminaBar.lineStyle(1, 0x2b3a63, 0.9);
      this.staminaBar.strokeRect(barX - 1, barY - 1, barW + 2, barH + 2);

      const color = this.stamina.isExhausted
        ? 0xff4444
        : this.stamina.ratio < 0.3
          ? 0xffaa33
          : 0x4da3ff;
      this.staminaBar.fillStyle(color, 1);
      this.staminaBar.fillRect(barX, barY, Math.max(1, Math.round(barW * this.stamina.ratio)), barH);
    }

    // 2. Acoustic noise footprint ring on the floor
    this.noiseRing.clear();
    if (moving && this.noiseRadius > 0) {
      const ringColor = this.sprinting ? 0xffbb44 : 0x55aaff;
      const ringAlpha = this.sprinting ? 0.22 : 0.12;

      this.noiseRing.lineStyle(1, ringColor, ringAlpha);
      this.noiseRing.strokeCircle(x, y, this.noiseRadius);
      this.noiseRing.fillStyle(ringColor, ringAlpha * 0.25);
      this.noiseRing.fillCircle(x, y, this.noiseRadius);
    }
  }

  /**
   * A guard's blow landed.
   *
   * @returns {boolean} whether it counted - false while the invulnerability
   *   window is open, so two guards swinging on the same frame cannot cost two
   *   points between them.
   */
  takeHit() {
    return this.health.takeHit();
  }

  get isDead() {
    return this.health.isDead;
  }

  /**
   * Runs the invulnerability window down, blinking while it lasts.
   *
   * The blink is the entire feedback for "that one did not count"; without it a
   * player cannot tell a shrug from nothing happening at all.
   */
  _tickHurt(dt) {
    if (!this.health.isHurt) return;

    this.health.update(dt);

    if (!this.health.isHurt) {
      this.sprite.setAlpha(1);
      return;
    }

    this.sprite.setAlpha(Math.floor(this.health.invulnerable * 12) % 2 === 0 ? 0.35 : 1);
  }

  /**
   * How far the player can currently be heard, in pixels.
   *
   * Sneaking is silent (0), so a guard has to be looking at you; sprinting
   * carries nearly across a room. This is recomputed every frame rather than
   * on key change so it can never go stale after a pause or a restart.
   */
  _currentNoiseRadius() {
    if (this.sneaking) return CONFIG.player.noise.sneak;
    if (this.sprinting) return CONFIG.player.noise.sprint;
    return CONFIG.player.noise.walk;
  }

  /** Puts the player back on the spawn tile with a full stamina bar. */
  reset() {
    this.sprite.setPosition(this.spawnPoint.x, this.spawnPoint.y);
    this.sprite.setVelocity(0, 0);
    this.sprite.setRotation(0);
    this.sprite.setAlpha(1);
    this.sneaking = false;
    this.sprinting = false;
    this.noiseRadius = 0;
    this.health.reset();
    this.stamina.reset();
    this.staminaBar.clear();
    this.noiseRing.clear();
  }
}

export default Player;
