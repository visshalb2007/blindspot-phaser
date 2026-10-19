/**
 * The decoy radio: the one gadget the player carries.
 *
 * A decoy is a box of noise. Dropped with `Q` on a level that issues any, it
 * blares for a few seconds from where it landed - a wide circle that outranks
 * the player's own racket - so the guards hearing it go and look *there* while
 * the player walks the other way. What it buys is exactly what noise has always
 * bought: an investigation, a hunch, guards standing where the player was not.
 * It can never start a chase, because nothing has eyes on anyone.
 *
 * Loud for three seconds and used up once, so a level issues them in ones and
 * twos and each drop has to be worth it: the gadget is the first sub-system a
 * stealth player learns to read a whole floor around.
 *
 * Pure JavaScript, no Phaser import: a test steps one fully headlessly.
 */
export class Decoy {
  constructor({ x, y, radius, duration }) {
    this.x = x;
    this.y = y;
    this.radius = radius;
    this.duration = duration;
    this.elapsed = 0;
    this.expended = false;
  }

  /** The decoy's spot in the world, once only, taken at the moment of the drop. */
  get position() {
    return { x: this.x, y: this.y };
  }

  /** Time left, in seconds. */
  get remaining() {
    if (this.expended) return 0;
    return Math.max(0, this.duration - this.elapsed);
  }

  /** Blaring until either the battery or the casing gives out. */
  get active() {
    return !this.expended && this.remaining > 0;
  }

  /**
   * Advances the battery.
   *
   * @param {number} dt seconds
   * @returns {boolean} whether the decoy is still blaring after the step
   */
  update(dt) {
    if (this.active && dt > 0) {
      this.elapsed += dt;
      if (this.elapsed >= this.duration) {
        // Marked rather than deleted, so a scene can fade the sprite out on
        // its own time and the object stays behind to say what it did.
        this.expended = true;
      }
    }

    return this.active;
  }

  /** The noise the guards are handed, in the shape `Hearing.listen` takes. */
  get noise() {
    return { x: this.x, y: this.y, radius: this.radius };
  }
}

/**
 * What the guards hear this frame, when there is a choice of sounds.
 *
 * The loudest circle wins. The decoy is built louder than anything the player
 * can make on foot, so while it blares the players' sprint noise is drowned
 * out entirely - sneaking behind a blaring decoy is the quietest way across a
 * floor - and when every decoy has gone quiet, the game is exactly the game it
 * was before the gadget shipped.
 *
 * @param {{x: number, y: number, radius: number}|null} playerNoise what the
 *   player is making this frame (null while the player is silent or absent)
 * @param {Array<Decoy>} decoys whatever is still blaring
 * @returns {{x: number, y: number, radius: number}|null} the noise handed to
 *   every guard, or null when there is a whole lot of nothing to hear
 */
export function loudestNoise(playerNoise, decoys = []) {
  let best = playerNoise;

  for (const decoy of decoys) {
    if (!decoy.active) continue;
    if (!best || decoy.radius > best.radius) best = decoy.noise;
  }

  return best;
}

export default Decoy;
