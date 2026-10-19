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
 *
 * The thresholds are read off the tuning sheet handed in - the same sheet the
 * brain runs on - rather than out of the global config, so a level can turn
 * attack ranges or chase commitment up without a second copy of the rules.
 *
 * @param {object} tuning the enemy config this guard's brain runs on
 */
export function createGuardStates(tuning = CONFIG.enemy) {
  return {
    [STATE.PATROL]: {
      enter(brain) {
        brain.onEnterPatrol();
      },

      update(brain, dt, fsm) {
        brain.patrolStep(dt);

        // Seeing is not the same as knowing what to do about them: the meter
        // has to fill first, and because it drains slower than it fills, a
        // guard that keeps catching glimpses escalates instead of flickering
        // between calm and furious. A noise fills it just as well, which is
        // how a guard ends up investigating something it never saw - and so
        // does intel handed over the alarm relay, which arrives as a hunch
        // with some warmth behind it rather than as a sound this guard heard.
        const stirred = brain.heardSomething || (brain.hasHunch && brain.alertness.value > 0);
        if (!brain.canSeeTarget() && !stirred) return;

        // ...but only a sighting is enough to commit to a chase.
        if (brain.canSeeTarget() && brain.alertness.isAlarmed) {
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

        // Nothing came of it. The doubt drains away: a guard with a noise it has
        // not been to look at yet goes and looks, and only a guard with nothing
        // left to check resumes the route it was on. This is the one way into a
        // search that does not start with a chase.
        if (!brain.alertness.isSuspicious) {
          fsm.change(brain.hasHunch ? STATE.SEARCH : STATE.PATROL);
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
        if (brain.canSeeTarget() && brain.sight.distance <= tuning.attackEnter) {
          fsm.change(STATE.ATTACK, { force: true });
          return;
        }

        // Losing sight no longer ends the hunt immediately. A second without a
        // sighting commits the guard to searching the spot, and only a fruitless
        // search sends it home - which is what stops the old CHASE/RETURN pulse.
        if (brain.lostSightFor(tuning.losLostTime)) {
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
        if (brain.lostSightFor(tuning.losLostTime)) {
          fsm.change(STATE.SEARCH);
          return;
        }

        // The exit radius is deliberately wider than the entry radius, so a
        // player hovering on the boundary cannot make the guard swing and stop
        // on alternate frames.
        if (brain.canSeeTarget() && brain.sight.distance > tuning.attackExit) {
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

        // A noise close enough to make it doubt stops the trip home and turns
        // it into a look. Walking on past a sprint two tiles away would read as
        // the guard being deaf. Relay intel works the same way: a hunch still
        // pending with any warmth left is a radio call the guard honours
        // before it finishes walking home.
        if (
          (brain.heardSomething || (brain.hasHunch && brain.alertness.value > 0)) &&
          brain.alertness.isSuspicious
        ) {
          fsm.change(STATE.SUSPICIOUS);
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
