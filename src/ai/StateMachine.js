/**
 * A finite state machine with an explicit enter/update/exit lifecycle.
 *
 * Why a state machine rather than nested `if` statements: the guard's behaviour
 * is a small set of named modes with rules about which transitions are legal.
 * Here those rules are data - a states map plus one guard call - so "can a
 * chasing guard start attacking?" is answered in one place instead of being
 * spread across a growing pile of conditionals. Adding a state means adding a
 * key; no existing branch has to be rewritten.
 *
 * The machine is Phaser-free. It is handed an `owner` and passes it to the
 * handlers, which is how the same machine drives a real enemy sprite in the
 * browser and a plain object in the headless simulation test.
 */
export class StateMachine {
  /**
   * @param {object} options
   * @param {Record<string, {enter?: Function, update?: Function, exit?: Function}>} options.states
   * @param {string} options.initial
   * @param {object} [options.owner] passed as the first argument to every handler
   * @param {number} [options.minStateTime] seconds a state must last before it may be left
   * @param {(from: string, to: string, owner: object) => void} [options.onChange]
   */
  constructor({ states, initial, owner = null, minStateTime = 0, onChange = null }) {
    if (!states || typeof states !== 'object') {
      throw new Error('StateMachine requires a states map');
    }
    if (!states[initial]) {
      throw new Error(`StateMachine: unknown initial state "${initial}"`);
    }

    this.states = states;
    this.owner = owner;
    this.minStateTime = minStateTime;
    this.onChange = onChange;
    this.initial = initial;

    this.current = initial;
    this.prev = null;
    this.timeInState = 0;

    this._invoke(initial, 'enter');
  }

  get name() {
    return this.current;
  }

  /** False while the current state is still inside its minimum lifetime. */
  get canChange() {
    return this.timeInState >= this.minStateTime;
  }

  has(name) {
    return Boolean(this.states[name]);
  }

  is(...names) {
    return names.includes(this.current);
  }

  /**
   * Attempts a transition.
   *
   * Ignored when the target is the current state, when the target does not
   * exist, or when the current state has not yet served its minimum time.
   * `force` skips only the last of those - which is how ATTACK is allowed to
   * interrupt CHASE immediately, while every other transition has to wait.
   *
   * @returns {boolean} whether the transition happened
   */
  change(name, { force = false } = {}) {
    if (name === this.current) return false;
    if (!this.has(name)) return false;
    if (!force && !this.canChange) return false;

    const from = this.current;
    this._invoke(from, 'exit');

    this.prev = from;
    this.current = name;
    this.timeInState = 0;

    this._invoke(name, 'enter');

    if (this.onChange) this.onChange(from, name, this.owner);
    return true;
  }

  update(dt) {
    this.timeInState += dt;

    const handler = this.states[this.current];
    if (handler && typeof handler.update === 'function') {
      handler.update(this.owner, dt, this);
    }
  }

  /** Returns the machine to its initial state and re-runs that state's enter. */
  reset() {
    const from = this.current;

    this._invoke(from, 'exit');

    this.current = this.initial;
    this.prev = null;
    this.timeInState = 0;

    this._invoke(this.initial, 'enter');

    if (this.onChange) this.onChange(from, this.initial, this.owner);
  }

  _invoke(name, phase) {
    const handler = this.states[name];
    if (handler && typeof handler[phase] === 'function') {
      handler[phase](this.owner, this);
    }
  }
}

export default StateMachine;
