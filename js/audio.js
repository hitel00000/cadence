/* ==========================================================================
   Cadence - Web Audio API Synthesizer & Sequencer Scheduler
   ========================================================================== */

import { resolveChordNotes } from './chordDb.js';

let audioCtx = null;
let scheduleIntervalId = null;
let schedulerState = null; // { nextSlotIndex, nextSlotTime }

const LOOKAHEAD_TIME = 0.2; // How far ahead to schedule audio (seconds)
const SCHEDULER_INTERVAL = 50; // How often to run scheduler loop (ms)

// Get or initialize AudioContext
export function getAudioContext() {
  if (!audioCtx || audioCtx.state === "closed") {
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    audioCtx = new AudioContextClass();
  }
  return audioCtx;
}

// Resume AudioContext if suspended (browser security autoplay policies)
export function resumeAudioContext() {
  const ctx = getAudioContext();
  if (ctx.state === "suspended") {
    ctx.resume();
  }
}

// Convert MIDI note number to frequency (Hz)
export function midiToFreq(note) {
  return 440 * Math.pow(2, (note - 69) / 12);
}

/**
 * Pluck a single guitar string using physical-modeling synthesis (Original Sound Engine)
 * Combines a triangle fundamental osc, a sine octave osc, and a bandpass-filtered noise Pick Attack.
 * Shaped by a lowpass sweep filter and ADSR gain envelope.
 */
export function pluckString(ctx, freq, startTime, volume, duration = 1.4) {
  const fundamental = ctx.createOscillator();
  const octave = ctx.createOscillator();
  const pickNoise = ctx.createBufferSource();

  // Create noise buffer (white noise decaying over 80ms for Pick click sound)
  const noiseBuffer = ctx.createBuffer(1, ctx.sampleRate * 0.08, ctx.sampleRate);
  const data = noiseBuffer.getChannelData(0);
  for (let i = 0; i < data.length; i++) {
    data[i] = (Math.random() * 2 - 1) * (1 - i / data.length);
  }
  pickNoise.buffer = noiseBuffer;

  // Bandpass filter for pick noise (centered at 2.5kHz, focusing click sound)
  const noiseFilter = ctx.createBiquadFilter();
  noiseFilter.type = 'bandpass';
  noiseFilter.frequency.value = 2500;
  noiseFilter.Q.value = 0.8;

  // Lowpass sweep filter (shaves off harsh highs over duration)
  const toneFilter = ctx.createBiquadFilter();
  toneFilter.type = 'lowpass';
  toneFilter.frequency.setValueAtTime(4200, startTime);
  toneFilter.frequency.exponentialRampToValueAtTime(1800, startTime + duration);

  const env = ctx.createGain();

  fundamental.type = 'triangle';
  octave.type = 'sine';

  fundamental.frequency.setValueAtTime(freq, startTime);
  octave.frequency.setValueAtTime(freq * 2, startTime);

  // ADSR gain envelope
  env.gain.setValueAtTime(0.0001, startTime);
  env.gain.linearRampToValueAtTime(volume, startTime + 0.008);
  env.gain.exponentialRampToValueAtTime(volume * 0.5, startTime + 0.12);
  env.gain.exponentialRampToValueAtTime(0.001, startTime + duration);

  // Connections
  fundamental.connect(toneFilter);
  octave.connect(toneFilter);

  pickNoise.connect(noiseFilter);
  noiseFilter.connect(env);

  toneFilter.connect(env);
  env.connect(ctx.destination);

  // Start & Stop
  fundamental.start(startTime);
  octave.start(startTime);
  pickNoise.start(startTime);

  pickNoise.stop(startTime + 0.08);
  fundamental.stop(startTime + duration);
  octave.stop(startTime + duration);
}

/**
 * Play a full guitar chord strum using the original timing patterns
 * @param {Object} chord - Chord definition
 * @param {string} stroke - "strong", "soft", or "arpeggio"
 * @param {number} startTime - start AudioContext time
 * @param {number} bpm - Beats Per Minute (used for timing arpeggiations and multi-strum)
 */
export function playChord(chord, stroke, startTime, bpm = 120) {
  const ctx = getAudioContext();
  resumeAudioContext();

  const notes = resolveChordNotes(chord);
  if (!notes || notes.length === 0) return;

  const start = startTime ?? ctx.currentTime;
  const beatSec = 60 / bpm;

  if (stroke === "arpeggio") {
    // Arpeggio: pluck each string slowly
    notes.forEach((note, si) => {
      if (note < 0) return; // Muted string
      const freq = midiToFreq(note);
      const t = start + si * beatSec * 0.12;
      pluckString(ctx, freq, t, 0.18, 2.0);
    });
  } else if (stroke === "strong") {
    const volume = 0.22;
    // Down strum (low strings to high strings, index 0 to 5)
    notes.forEach((note, si) => {
      if (note < 0) return;
      const freq = midiToFreq(note);
      const t = start + si * 0.015;
      pluckString(ctx, freq, t, volume, 1.4);
    });
    // Up strum (high strings to low strings, reverse index)
    [...notes].reverse().forEach((note, si) => {
      const origSi = 5 - si;
      if (note < 0) return;
      const freq = midiToFreq(note);
      const t = start + beatSec * 0.5 + si * 0.012;
      pluckString(ctx, freq, t, volume * 0.6, 1.0);
    });
  } else {
    // "soft" down strum
    const volume = 0.12;
    notes.forEach((note, si) => {
      if (note < 0) return;
      const freq = midiToFreq(note);
      const t = start + si * 0.015;
      pluckString(ctx, freq, t, volume, 1.4);
    });
  }
}

// Preview a chord instantly (e.g. when clicking play button in editor picker)
export function previewChord(chord, stroke = "arpeggio", bpm = 120) {
  playChord(chord, stroke, null, bpm);
}

/**
 * Start the sequencer playback loop
 * @param {Object} config - { bpm, stroke, loop, totalSlots, getSlot, onBeat, onEnd }
 */
export function startSequencer(config) {
  stopSequencer();
  
  const ctx = getAudioContext();
  resumeAudioContext();

  // Each slot represents 2 beats in 4/4 time (since each bar is 4 beats and has 2 slots)
  const slotDuration = (60 / config.bpm) * 2;
  
  schedulerState = {
    nextSlotIndex: 0,
    nextSlotTime: ctx.currentTime + 0.05
  };

  scheduleIntervalId = setInterval(() => {
    if (!schedulerState) return;

    const now = ctx.currentTime;

    // Schedule beats within the lookahead window
    while (schedulerState.nextSlotTime < now + LOOKAHEAD_TIME) {
      const currentIdx = schedulerState.nextSlotIndex;
      const actualSlotIndex = currentIdx % config.totalSlots;
      const slot = config.getSlot(actualSlotIndex);

      // Play chord only if it is NOT a continue slot (↳)
      if (slot && !slot.isContinue && slot.root) {
        playChord(slot, config.stroke, schedulerState.nextSlotTime, config.bpm);
      }

      // Trigger visual/position update callback
      config.onBeat(actualSlotIndex);

      schedulerState.nextSlotIndex++;
      schedulerState.nextSlotTime += slotDuration;

      // Handle non-looping end boundary
      if (!config.loop && schedulerState.nextSlotIndex >= config.totalSlots) {
        const stopDelayMs = (schedulerState.nextSlotTime - now) * 1000 + 100;
        stopSequencer();
        setTimeout(() => {
          config.onEnd();
        }, stopDelayMs);
        return;
      }
    }
  }, SCHEDULER_INTERVAL);
}

// Stop the sequencer playback loop
export function stopSequencer() {
  if (scheduleIntervalId !== null) {
    clearInterval(scheduleIntervalId);
    scheduleIntervalId = null;
  }
  schedulerState = null;
}

// Seek sequencer playhead to a specific slot index
export function seekSequencer(slotIndex) {
  if (!schedulerState) return;
  const ctx = getAudioContext();
  schedulerState.nextSlotIndex = slotIndex;
  schedulerState.nextSlotTime = ctx.currentTime + 0.05;
}

// Check if sequencer is currently playing
export function isSequencerPlaying() {
  return scheduleIntervalId !== null;
}
