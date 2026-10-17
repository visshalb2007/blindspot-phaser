import { describe, it, expect, beforeEach } from 'vitest';

import { StateMachine } from '../src/ai/StateMachine.js';

/** Builds a machine whose handlers append to `log`, so order is observable. */
function build({ minStateTime = 0, states = {} } = {}) {
  const log = [];
  const owner = { log };

  const handlers = {
    A: {
      enter: (o) => o.log.push('enter A'),
      update: (o, dt) => o.log.push(`update A ${dt}`),
      exit: (o) => o.log.push('exit A'),
    },
    B: {
      enter: (o) => o.log.push('enter B'),
      update: (o) => o.log.push('update B'),
      exit: (o) => o.log.push('exit B'),
    },
    C: { enter: (o) => o.log.push('enter C') },
    ...states,
  };

  const machine = new StateMachine({ states: handlers, initial: 'A', owner, minStateTime });
  return { machine, log, owner };
}

describe('StateMachine construction', () => {
  it('runs the initial state enter before anything else', () => {
    const { log } = build();
    expect(log).toEqual(['enter A']);
  });

  it('starts with no previous state and zero time in state', () => {
    const { machine } = build();
    expect(machine.current).toBe('A');
    expect(machine.prev).toBe(null);
    expect(machine.timeInState).toBe(0);
  });

  it('rejects an unknown initial state', () => {
    expect(() => new StateMachine({ states: { A: {} }, initial: 'Z' })).toThrow(/unknown initial/);
  });

  it('rejects a missing states map', () => {
    expect(() => new StateMachine({ initial: 'A' })).toThrow(/states map/);
  });
});

describe('StateMachine transitions', () => {
  let machine;
  let log;

  beforeEach(() => {
    ({ machine, log } = build());
  });

  it('runs exit before enter, and sets prev', () => {
    machine.change('B');
    expect(log).toEqual(['enter A', 'exit A', 'enter B']);
    expect(machine.current).toBe('B');
    expect(machine.prev).toBe('A');
  });

  it('ignores a change into the state it is already in', () => {
    expect(machine.change('A')).toBe(false);
    expect(log).toEqual(['enter A']);
  });

  it('ignores a change into a state that does not exist', () => {
    expect(machine.change('NOPE')).toBe(false);
    expect(machine.current).toBe('A');
  });

  it('resets timeInState on every successful change', () => {
    machine.update(1.5);
    expect(machine.timeInState).toBeCloseTo(1.5, 10);

    machine.change('B');
    expect(machine.timeInState).toBe(0);
  });

  it('reports whether the change happened', () => {
    expect(machine.change('B')).toBe(true);
    expect(machine.change('B')).toBe(false);
  });

  it('notifies onChange with the previous and next state', () => {
    const seen = [];
    const { machine: m } = build();
    m.onChange = (from, to) => seen.push([from, to]);

    m.change('B');
    m.change('A');
    expect(seen).toEqual([
      ['A', 'B'],
      ['B', 'A'],
    ]);
  });
});

describe('StateMachine update', () => {
  it('dispatches only to the current state handler', () => {
    const { machine, log } = build();
    machine.update(0.5);
    expect(log).toEqual(['enter A', 'update A 0.5']);
  });

  it('accumulates timeInState across frames', () => {
    const { machine } = build();
    machine.update(0.1);
    machine.update(0.2);
    expect(machine.timeInState).toBeCloseTo(0.3, 10);
  });

  it('tolerates a state that declares only an enter handler', () => {
    const { machine } = build();
    machine.change('C');
    expect(() => machine.update(0.1)).not.toThrow();
  });

  it('passes the owner and the machine to the handler', () => {
    const seen = [];
    const owner = {};
    const states = {
      A: {
        update: (o, dt, m) => seen.push([o, dt, m.current]),
      },
    };

    const machine = new StateMachine({ states, initial: 'A', owner });
    machine.update(0.25);

    expect(seen).toEqual([[owner, 0.25, 'A']]);
  });
});

describe('StateMachine minimum state time', () => {
  it('blocks a transition before the minimum has elapsed', () => {
    const { machine } = build({ minStateTime: 0.4 });
    expect(machine.canChange).toBe(false);
    expect(machine.change('B')).toBe(false);
    expect(machine.current).toBe('A');
  });

  it('allows the transition once the minimum has elapsed', () => {
    const { machine } = build({ minStateTime: 0.4 });
    machine.update(0.2);
    expect(machine.change('B')).toBe(false);
    machine.update(0.25);
    expect(machine.canChange).toBe(true);
    expect(machine.change('B')).toBe(true);
  });

  it('lets force bypass the minimum, which is how ATTACK interrupts CHASE', () => {
    const { machine, log } = build({ minStateTime: 0.4 });
    expect(machine.change('B', { force: true })).toBe(true);
    expect(log).toEqual(['enter A', 'exit A', 'enter B']);
  });

  it('does not return the minimum check on the frame the state is entered', () => {
    const { machine } = build({ minStateTime: 0.4 });
    machine.change('B', { force: true });
    machine.update(0.1);
    expect(machine.canChange).toBe(false);
  });
});

describe('StateMachine reset', () => {
  it('returns to the initial state and runs its enter again', () => {
    const { machine, log } = build();
    machine.change('B');
    machine.reset();

    expect(machine.current).toBe('A');
    expect(machine.prev).toBe(null);
    expect(machine.timeInState).toBe(0);
    expect(log).toEqual(['enter A', 'exit A', 'enter B', 'exit B', 'enter A']);
  });

  it('exits and re-enters even when it is already in the initial state', () => {
    const { machine, log } = build();
    machine.reset();
    expect(log).toEqual(['enter A', 'exit A', 'enter A']);
  });
});
