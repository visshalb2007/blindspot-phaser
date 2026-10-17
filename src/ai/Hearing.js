import { CONFIG } from '../config.js';
import { distance } from '../world/geometry.js';

/** What a guard reports when there is nothing to hear at all. */
export const NOTHING_HEARD = Object.freeze({
  heard: false,
  distance: Infinity,
  loudness: 0,
  rate: 0,
  muffled: false,
});

/**
 * What a guard can hear.
 *
 * The player's noise is a moving circle: silent while sneaking, small while
 * walking, most of a room while sprinting (see `Player.noiseRadius`). A guard
 * inside that circle notices something, and the closer it stands to the source
 * the more of it lands.
 *
 * Two limits are deliberate, and they are what keep hearing from being a second
 * pair of eyes:
 *
 *   - A noise carries a *place*, never a person. It can make a guard doubt and
 *     send it looking, but it can never make it certain - certainty, and with
 *     it a chase, still needs a sighting. Standing behind a guard and walking
 *     loudly will get you investigated, not run down.
 *   - Walls muffle rather than block. Sound going around a corner is exactly
 *     how a guard notices a player it cannot see, which is the whole point of
 *     having hearing; a wall just takes most of the volume out of it.
 *
 * Pure JavaScript, no Phaser import.
 */
export class Hearing {
  constructor({
    gain = CONFIG.enemy.hearingGain,
    muffled = CONFIG.enemy.hearingMuffled,
    blocked = () => false,
  } = {}) {
    this.gain = gain;
    this.muffled = muffled;
    this.blocked = blocked;
  }

  /**
   * @param {{x: number, y: number}} listener the guard
   * @param {{x: number, y: number, radius: number}|null} noise where the sound
   *   came from and how far it carries
   * @returns {{heard: boolean, distance: number, loudness: number, rate: number, muffled: boolean}}
   *   `rate` is in certainty per second - the same units the meter fills at
   *   with the player in plain view - so a caller can hand it straight to
   *   `Alertness.update` and the two senses add up sensibly.
   */
  listen(listener, noise) {
    // Sneaking is a radius of zero, so a silent player is never heard at all
    // rather than heard for nothing.
    if (!noise || !(noise.radius > 0)) return { ...NOTHING_HEARD };

    const reach = distance(listener.x, listener.y, noise.x, noise.y);
    if (reach >= noise.radius) return { ...NOTHING_HEARD, distance: reach };

    const throughWall = this.blocked(listener, noise);
    const loudness = (1 - reach / noise.radius) * (throughWall ? this.muffled : 1);

    return {
      heard: true,
      distance: reach,
      loudness,
      rate: this.gain * loudness,
      muffled: throughWall,
    };
  }
}

export default Hearing;
