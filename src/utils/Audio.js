/**
 * Zero-asset WebAudio synthesizer for sound effects.
 *
 * All audio is synthesised in real time using oscillators and noise bursts.
 * No audio files are loaded over the network.
 *
 * In environments without an AudioContext (e.g. Node tests), every method
 * cleanly degrades to a no-op.
 */

class SoundSystem {
  constructor() {
    this.ctx = null;
    this.masterGain = null;
    this.muted = false;
    this._footstepTimer = 0;
    this._lastSuspiciousTime = 0;
    this._lastChaseTime = 0;
  }

  /**
   * Lazily initializes the AudioContext upon first user interaction.
   * Browsers block autoplay until a user gesture occurs.
   */
  init() {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') {
        this.ctx.resume().catch(() => {});
      }
      return;
    }

    const AudioContextClass =
      typeof window !== 'undefined'
        ? window.AudioContext || window.webkitAudioContext
        : null;

    if (!AudioContextClass) return;

    try {
      this.ctx = new AudioContextClass();
      this.masterGain = this.ctx.createGain();
      this.masterGain.gain.setValueAtTime(this.muted ? 0 : 0.25, this.ctx.currentTime);
      this.masterGain.connect(this.ctx.destination);
    } catch {
      this.ctx = null;
    }
  }

  get isMuted() {
    return this.muted;
  }

  toggleMute() {
    this.setMuted(!this.muted);
    return this.muted;
  }

  setMuted(muted) {
    this.muted = Boolean(muted);
    if (!this.ctx || !this.masterGain) return;
    const now = this.ctx.currentTime;
    this.masterGain.gain.cancelScheduledValues(now);
    this.masterGain.gain.setValueAtTime(this.muted ? 0 : 0.25, now);
  }

  /**
   * Footstep sound: low filtered pop. Sneak is completely silent.
   * Rate-limited based on movement speed.
   */
  step(dt, { moving = false, sneaking = false, sprinting = false } = {}) {
    if (!moving || sneaking || !this.ctx || this.muted) return;

    const interval = sprinting ? 0.22 : 0.35;
    this._footstepTimer += dt;
    if (this._footstepTimer < interval) return;
    this._footstepTimer = 0;

    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    const filter = this.ctx.createBiquadFilter();

    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(sprinting ? 280 : 180, now);

    osc.type = 'triangle';
    osc.frequency.setValueAtTime(sprinting ? 120 : 80, now);
    osc.frequency.exponentialRampToValueAtTime(30, now + 0.05);

    const volume = sprinting ? 0.3 : 0.15;
    gain.gain.setValueAtTime(volume, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.05);

    osc.connect(filter);
    filter.connect(gain);
    gain.connect(this.masterGain);

    osc.start(now);
    osc.stop(now + 0.05);
  }

  /**
   * Guard enters SUSPICIOUS: a subtle rising caution blip.
   */
  playSuspicious() {
    if (!this.ctx || this.muted) return;
    const now = this.ctx.currentTime;
    if (now - this._lastSuspiciousTime < 0.25) return;
    this._lastSuspiciousTime = now;

    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(380, now);
    osc.frequency.linearRampToValueAtTime(520, now + 0.12);

    gain.gain.setValueAtTime(0.18, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.15);

    osc.connect(gain);
    gain.connect(this.masterGain);

    osc.start(now);
    osc.stop(now + 0.15);
  }

  /**
   * Guard enters CHASE: an alert siren sting.
   */
  playChase() {
    if (!this.ctx || this.muted) return;
    const now = this.ctx.currentTime;
    if (now - this._lastChaseTime < 0.3) return;
    this._lastChaseTime = now;

    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(650, now);
    osc.frequency.linearRampToValueAtTime(880, now + 0.08);
    osc.frequency.linearRampToValueAtTime(600, now + 0.2);

    gain.gain.setValueAtTime(0.25, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.25);

    osc.connect(gain);
    gain.connect(this.masterGain);

    osc.start(now);
    osc.stop(now + 0.25);
  }

  /**
   * Chip taken: bright reward chime.
   */
  playChip() {
    if (!this.ctx || this.muted) return;
    const now = this.ctx.currentTime;

    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(880, now);
    osc.frequency.setValueAtTime(1320, now + 0.07);

    gain.gain.setValueAtTime(0.22, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.24);

    osc.connect(gain);
    gain.connect(this.masterGain);

    osc.start(now);
    osc.stop(now + 0.24);
  }

  /**
   * Final chip collected: exit unlocks with deep power-up chord.
   */
  playExitUnlocked() {
    if (!this.ctx || this.muted) return;
    const now = this.ctx.currentTime;

    [110, 220, 330, 440].forEach((freq, idx) => {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc.type = 'triangle';
      osc.frequency.setValueAtTime(freq, now + idx * 0.05);
      osc.frequency.linearRampToValueAtTime(freq * 1.5, now + 0.4);

      gain.gain.setValueAtTime(0.15, now + idx * 0.05);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.6);

      osc.connect(gain);
      gain.connect(this.masterGain);

      osc.start(now + idx * 0.05);
      osc.stop(now + 0.6);
    });
  }

  /**
   * Decoy radio dropped: mechanical click followed by radio chatter burst.
   */
  playDecoyDrop() {
    if (!this.ctx || this.muted) return;
    const now = this.ctx.currentTime;

    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'square';
    osc.frequency.setValueAtTime(950, now);
    osc.frequency.setValueAtTime(450, now + 0.04);
    osc.frequency.setValueAtTime(800, now + 0.08);

    gain.gain.setValueAtTime(0.2, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.16);

    osc.connect(gain);
    gain.connect(this.masterGain);

    osc.start(now);
    osc.stop(now + 0.16);
  }

  /**
   * Player hurt: low impact crunch.
   */
  playHit() {
    if (!this.ctx || this.muted) return;
    const now = this.ctx.currentTime;

    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'triangle';
    osc.frequency.setValueAtTime(140, now);
    osc.frequency.exponentialRampToValueAtTime(35, now + 0.15);

    gain.gain.setValueAtTime(0.35, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.18);

    osc.connect(gain);
    gain.connect(this.masterGain);

    osc.start(now);
    osc.stop(now + 0.18);
  }

  /**
   * Mission won: victory arpeggio.
   */
  playWin() {
    if (!this.ctx || this.muted) return;
    const now = this.ctx.currentTime;
    const notes = [523.25, 659.25, 783.99, 1046.5]; // C5, E5, G5, C6

    notes.forEach((freq, i) => {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, now + i * 0.1);

      gain.gain.setValueAtTime(0.2, now + i * 0.1);
      gain.gain.exponentialRampToValueAtTime(0.001, now + i * 0.1 + 0.35);

      osc.connect(gain);
      gain.connect(this.masterGain);

      osc.start(now + i * 0.1);
      osc.stop(now + i * 0.1 + 0.35);
    });
  }

  /**
   * Caught: low minor fail chime.
   */
  playCaught() {
    if (!this.ctx || this.muted) return;
    const now = this.ctx.currentTime;
    const notes = [311.13, 293.66, 261.63, 207.65]; // Eb4, D4, C4, Ab3

    notes.forEach((freq, i) => {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(freq, now + i * 0.14);

      gain.gain.setValueAtTime(0.2, now + i * 0.14);
      gain.gain.exponentialRampToValueAtTime(0.001, now + i * 0.14 + 0.3);

      osc.connect(gain);
      gain.connect(this.masterGain);

      osc.start(now + i * 0.14);
      osc.stop(now + i * 0.14 + 0.3);
    });
  }
}

export const SOUND = new SoundSystem();
export default SOUND;
