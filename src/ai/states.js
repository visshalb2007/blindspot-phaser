import { CONFIG } from '../config.js';

/**
 * Every state a guard can be in.
 *
 * String constants rather than an enum because they are also the keys used in
 * the states map, in the console and in the debug overlay - one value, one
 * name, readable in a stack trace.
 */
export const STATE = Object.freeze({
  PATROL: 'PATROL',
  SUSPICIOUS: 'SUSPICIOUS',
  CHASE: 'CHASE',
  ATTACK: 'ATTACK',
  SEARCH: 'SEARCH',
  RETURN: 'RETURN',
  CELEBRATE: 'CELEBRATE',
});

/** Which `CONFIG.colors` entry a state is drawn with. */
export const STATE_COLOR_KEY = Object.freeze({
  [STATE.PATROL]: 'patrol',
  [STATE.SUSPICIOUS]: 'suspicious',
  [STATE.CHASE]: 'chase',
  [STATE.ATTACK]: 'attack',
  [STATE.SEARCH]: 'search',
  // Returning to post is not a threat, so it goes back to the calm green.
  [STATE.RETURN]: 'patrol',
  [STATE.CELEBRATE]: 'search',
});

/**
 * The icon drawn over a guard's head. A question mark means "I think something
 * is there", an exclamation mark means "I can see you".
 */
export const STATE_ICON = Object.freeze({
  [STATE.PATROL]: '',
  [STATE.SUSPICIOUS]: '?',
  [STATE.CHASE]: '!',
  [STATE.ATTACK]: '!!',
  [STATE.SEARCH]: '?',
  [STATE.RETURN]: '',
  [STATE.CELEBRATE]: '*',
});

/** States in which a guard is actively a threat to the player. */
export const HUNTING_STATES = Object.freeze([STATE.CHASE, STATE.ATTACK]);

export function colorFor(state) {
  return CONFIG.colors[STATE_COLOR_KEY[state]] ?? CONFIG.colors.patrol;
}

export function iconFor(state) {
  return STATE_ICON[state] ?? '';
}

/**
 * Builds the guard's state handlers.
 *
 * Each handler owns the rules for leaving its own state, which keeps the
 * transition table next to the behaviour it describes instead of in one large
 * switch. `brain` is the StateMachine's owner, so the same handlers drive the
 * on-screen guard and the headless simulation.
 */
export function createGuardStates() {
  return {
    [STATE.PATROL]: {
      enter(brain) {
        brain.onEnterPatrol();
      },

      update(brain, dt, fsm) {
        brain.patrolStep(dt);

        if (!brain.canSeeTarget()) return;

        // Seeing the player is not the same as knowing what to do about them.
        // The meter has to fill first - and because it drains slower than it
        // fills, a guard that keeps catching glimpses escalates instead of
        // flickering between calm and furious.
        if (brain.alertness.isAlarmed) {
          fsm.change(STATE.CHASE);
        } else if (brain.alertness.isSuspicious) {
          fsm.change(STATE.SUSPICIOUS);
        }
      },
    },

    [STATE.SUSPICIOUS]: {
      enter(brain) {
        brain.onEnterSuspicious();
      },

      update(brain, dt, fsm) {
        brain.suspiciousStep(dt);

        if (brain.canSeeTarget() && brain.alertness.isAlarmed) {
          fsm.change(STATE.CHASE);
          return;
        }

        // Nothing came of it. The doubt drains away and the guard resumes the
        // route it was on, from the post it had not yet reached.
        if (!brain.alertness.isSuspicious) {
          fsm.change(STATE.PATROL);
        }
      },
    },

    [STATE.CHASE]: {
      enter(brain) {
        brain.onEnterChase();
      },

      update(brain, dt, fsm) {
        brain.chaseStep(dt);

        // Close enough to swing. Forcing the change skips the minimum state
        // time: a guard that has just run you down should not stand waiting for
        // its 0.4s to expire while you walk away.
        if (brain.canSeeTarget() && brain.sight.distance <= CONFIG.enemy.attackEnter) {
          fsm.change(STATE.ATTACK, { force: true });
          return;
        }

        // Losing sight no longer ends the hunt immediately. A second without a
        // sighting commits the guard to searching the spot, and only a fruitless
        // search sends it home - which is what stops the old CHASE/RETURN pulse.
        if (brain.lostSightFor(CONFIG.enemy.losLostTime)) {
          fsm.change(STATE.SEARCH);
        }
      },
    },

    [STATE.SEARCH]: {
      enter(brain) {
        brain.onEnterSearch();
      },

      update(brain, dt, fsm) {
        brain.searchStep(dt);

        // Picking the trail back up while the guard is still warm on it goes
        // straight back to the chase; there is no second meter to fill.
        if (brain.canSeeTarget() && brain.alertness.isSuspicious) {
          fsm.change(STATE.CHASE);
          return;
        }

        if (brain.searchOver()) {
          fsm.change(STATE.RETURN);
        }
      },
    },

    [STATE.ATTACK]: {
      enter(brain) {
        brain.onEnterAttack();
      },

      update(brain, dt, fsm) {
        brain.attackStep(dt);

        // A swing is committed to. The guard comes out of it when the player is
        // genuinely gone for a whole second, or backs off while staying in
        // sight - never because they ducked out of view for a frame. Leaving on
        // a single missing frame made the guard drop out of the attack and
        // swing again on a 0.4s cycle whenever the player hovered on the edge
        // of cover.
        if (brain.lostSightFor(CONFIG.enemy.losLostTime)) {
          fsm.change(STATE.SEARCH);
          return;
        }

        // The exit radius is deliberately wider than the entry radius, so a
        // player hovering on the boundary cannot make the guard swing and stop
        // on alternate frames.
        if (brain.canSeeTarget() && brain.sight.distance > CONFIG.enemy.attackExit) {
          fsm.change(STATE.CHASE);
        }
      },

      exit(brain) {
        brain.onExitAttack();
      },
    },

    [STATE.RETURN]: {
      enter(brain) {
        brain.onEnterReturn();
      },

      update(brain, dt, fsm) {
        // Spotting the player on the way back restarts the chase immediately:
        // a guard walking home is already alert, and with line of sight in
        // place a sighting is a real one rather than a glance through a wall.
        if (brain.canSeeTarget()) {
          fsm.change(STATE.CHASE);
          return;
        }

        brain.returnStep(dt);

        if (brain.hasReachedPatrolPost()) {
          fsm.change(STATE.PATROL);
        }
      },

      exit(brain) {
        brain.onExitReturn();
      },
    },
  };
}

export default STATE;
