import { Sound, Vector2 } from 'littlejsengine';

/**
 * Procedural ZzFX Sound parameter sets (offline, zero audio file downloads).
 * Parameters: [volume, randomness, frequency, attack, sustain, release, shape, shapeCurve, slide, deltaSlide, pitchJump, pitchJumpTime, repeatTime, noise, modulation, bitCrush, delay, sustainVolume, decay, tremolo]
 */
const ZZFX_BOUNCE = [0.6, 0.05, 320, 0.01, 0.04, 0.08, 0, 1.4, -6, 0, 0, 0, 0, 0, 0, 0, 0, 0.8, 0.04];
const ZZFX_BUMPER = [0.9, 0.05, 587, 0.01, 0.08, 0.16, 0, 2.0, 4, 0, 120, 0.03, 0, 0, 0, 0, 0, 0.8, 0.06];
const ZZFX_SHOCKWAVE = [1.1, 0.05, 110, 0.02, 0.14, 0.28, 3, 1.8, -5, -8, 0, 0, 0, 0.2, 0, 0, 0, 0.7, 0.1];
const ZZFX_SCORE = [0.9, 0.05, 440, 0.02, 0.16, 0.32, 0, 1.2, 8, 14, 220, 0.05, 0.07, 0, 0, 0, 0, 0.9, 0.08];
const ZZFX_SPAWN = [0.6, 0.05, 660, 0.01, 0.04, 0.1, 0, 1.1, 10, 0, 0, 0, 0, 0, 0, 0, 0, 0.8, 0.03];

let soundBounce: Sound | null = null;
let soundBumper: Sound | null = null;
let soundShockwave: Sound | null = null;
let soundScore: Sound | null = null;
let soundSpawn: Sound | null = null;

let isAudioInitialized = false;

export function initAudio(): void {
  if (isAudioInitialized) return;
  try {
    soundBounce = new Sound(ZZFX_BOUNCE);
    soundBumper = new Sound(ZZFX_BUMPER);
    soundShockwave = new Sound(ZZFX_SHOCKWAVE);
    soundScore = new Sound(ZZFX_SCORE);
    soundSpawn = new Sound(ZZFX_SPAWN);
    isAudioInitialized = true;
  } catch (err) {
    console.warn('[Audio] Failed to initialize procedural audio:', err);
  }
}

export function playBounceSound(pos?: Vector2, pitch = 1): void {
  try {
    soundBounce?.play(pos, 0.7, pitch);
  } catch {
    // Audio context may be suspended before first gesture
  }
}

export function playBumperSound(pos?: Vector2, pitch = 1): void {
  try {
    soundBumper?.play(pos, 0.85, pitch);
  } catch {
    // Graceful fallback
  }
}

export function playShockwaveSound(pos?: Vector2): void {
  try {
    soundShockwave?.play(pos, 1.0);
  } catch {
    // Graceful fallback
  }
}

export function playScoreSound(pos?: Vector2): void {
  try {
    soundScore?.play(pos, 0.9);
  } catch {
    // Graceful fallback
  }
}

export function playSpawnSound(pos?: Vector2): void {
  try {
    soundSpawn?.play(pos, 0.6);
  } catch {
    // Graceful fallback
  }
}

export function resetAudio(): void {
  soundBounce = null;
  soundBumper = null;
  soundShockwave = null;
  soundScore = null;
  soundSpawn = null;
  isAudioInitialized = false;
}
