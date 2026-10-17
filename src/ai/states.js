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

        if (brain.canSeeTarget()) {
          fsm.change(STATE.CHASE);
        }
      },
    },

    [STATE.CHASE]: {
      enter(brain) {
        brain.onEnterChase();
      },

      update(brain, _dt, fsm) {
        brain.chaseStep();

        // Losing sight ends the chase for now. Phase 7 puts SUSPICIOUS and
        // SEARCH in between, but the rule "no sight, no chase" is the same.
        if (!brain.canSeeTarget()) {
          fsm.change(STATE.RETURN);
        }
      },
    },

    [STATE.RETURN]: {
      enter(brain) {
        brain.onEnterReturn();
      },

      update(brain, dt, fsm) {
        // Spotting the player on the way back restarts the chase immediately.
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
