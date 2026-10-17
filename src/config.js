/**
 * Single source of truth for every tunable in the game.
 *
 * Nothing in `src/ai` or `src/world` may hard-code a magic number: if a value
 * influences behaviour it belongs here so it can be read, tuned and reasoned
 * about without hunting through modules.
 */

const TILE = 32;
const MAP_COLS = 25;
const MAP_ROWS = 18;

export const CONFIG = {
  tile: TILE,

  map: {
    cols: MAP_COLS,
    rows: MAP_ROWS,
    widthPx: MAP_COLS * TILE,
    heightPx: MAP_ROWS * TILE,
  },

  mission: {
    // How close the player has to walk to a chip to take it, and how close to
    // the exit to be through it, in px. Both are a little more than the
    // player's 10px radius, so nothing has to be taken pixel-perfect on a tile
    // centre.
    pickupRadius: 18,
    exitRadius: 20,
  },

  player: {
    speed: 170,
    sprint: 230,
    sneak: 80,
    radius: 10,
    // Stamina is expressed in "stamina seconds": 100 stamina at 35/s drain is
    // roughly 2.9s of sprinting, and it refills in 5s at rest.
    stamina: 100,
    drain: 35,
    regen: 20,
    // Sprint does not re-engage until stamina has recovered past this value.
    // Without it, a depleted bar flickers between walk and sprint each frame.
    sprintRecoverAt: 20,
    health: 3,
    iFrames: 1.0,
    noise: {
      sneak: 0,
      walk: 60,
      sprint: 140,
    },
  },

  enemy: {
    // How many guards to spawn, and how far apart on the patrol loop they start.
    count: 2,
    radius: 10,
    patrolSpeed: 80,
    searchSpeed: 110,
    chaseSpeed: 150,
    sightRange: 180,
    loseRange: 240,
    fov: 90,
    // Hearing. `player.noise` is the radius sound carries to; a guard inside
    // that circle grows suspicious at `hearingGain` per second at the source,
    // falling off to nothing at the rim, and at a fraction of that through a
    // wall. Loudness only ever buys doubt - a chase still needs a sighting.
    hearingGain: 40,
    hearingMuffled: 0.35,
    attackEnter: 40,
    attackExit: 60,
    attackCooldown: 1.0,
    attackWindup: 0.3,
    waitAtWaypoint: 0.5,
    searchDuration: 4,
    losLostTime: 1.0,
    suspicionGain: 60,
    suspicionDecay: 25,
    suspiciousAt: 30,
    chaseAt: 100,
    minStateTime: 0.4,
    alertPause: 0.3,
    spawnGrace: 1.5,
    arriveRadius: 4,
    repathInterval: 0.3,
    stuckTime: 1.0,
    stuckDist: 2,
    // Scanning head movement while a guard is standing still: sweep in degrees
    // either side of its base heading, at this many degrees per second.
    lookAroundRate: 70,
    lookAroundSweep: 80,
  },

  colors: {
    patrol: 0x44cc66,
    suspicious: 0xffdd33,
    search: 0xff9933,
    chase: 0xff3333,
    attack: 0xaa0000,
    player: 0x4da3ff,
    wall: 0x2b3550,
    floor: 0x121826,
    chip: 0xffd166,
    exit: 0x8a7cff,
  },

  /**
   * Phaser hands us the real elapsed time between frames. After a tab switch,
   * an alt-tab or a GC pause that number can be seconds long, which would
   * teleport entities through walls and fire every timer at once. Every
   * consumer of delta is expected to clamp through this value.
   */
  maxDelta: 50,
};

export default CONFIG;
