import { describe, it, expect, beforeEach } from 'vitest';
import { SOUND } from '../src/utils/Audio.js';

describe('SoundSystem', () => {
  beforeEach(() => {
    SOUND.setMuted(false);
  });

  it('safely handles missing AudioContext in Node environments', () => {
    expect(() => SOUND.init()).not.toThrow();
    expect(() => SOUND.playSuspicious()).not.toThrow();
    expect(() => SOUND.playChase()).not.toThrow();
    expect(() => SOUND.playChip()).not.toThrow();
    expect(() => SOUND.playExitUnlocked()).not.toThrow();
    expect(() => SOUND.playDecoyDrop()).not.toThrow();
    expect(() => SOUND.playHit()).not.toThrow();
    expect(() => SOUND.playWin()).not.toThrow();
    expect(() => SOUND.playCaught()).not.toThrow();
    expect(() =>
      SOUND.step(0.5, { moving: true, sneaking: false, sprinting: false }),
    ).not.toThrow();
  });

  it('toggles and manages mute state cleanly', () => {
    expect(SOUND.isMuted).toBe(false);
    SOUND.toggleMute();
    expect(SOUND.isMuted).toBe(true);
    SOUND.toggleMute();
    expect(SOUND.isMuted).toBe(false);
  });
});
