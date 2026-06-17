/* ==========================================================================
   Cadence - Web Audio API Synthesizer & Sequencer Scheduler
   ========================================================================== */

import { resolveChordNotes } from './chordDb.js';
import { loadSettings } from './core/storage.js';

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
function playPianoChord(ctx, notes, stroke, start, beatSec) {
  const isArpeggio = stroke === "arpeggio";
  
  notes.forEach((note, si) => {
    if (note < 0) return;
    const freq = midiToFreq(note);
    const delay = isArpeggio ? si * 0.045 : 0;
    const t = start + delay;
    
    // 1. Warm Triangle fundamental
    const osc = ctx.createOscillator();
    const gainNode = ctx.createGain();
    osc.type = "triangle";
    osc.frequency.setValueAtTime(freq, t);
    
    gainNode.gain.setValueAtTime(0, t);
    gainNode.gain.linearRampToValueAtTime(0.12, t + 0.005);
    gainNode.gain.setValueAtTime(0.12, t + 0.01);
    gainNode.gain.exponentialRampToValueAtTime(0.0001, t + 2.0);
    
    osc.connect(gainNode);
    gainNode.connect(ctx.destination);
    osc.start(t);
    osc.stop(t + 2.2);
    
    // 2. Bell-like metallic attack (Rhodes-tines sine harmonic)
    const tine = ctx.createOscillator();
    const tineGain = ctx.createGain();
    tine.type = "sine";
    tine.frequency.setValueAtTime(freq * 2, t);
    
    tineGain.gain.setValueAtTime(0, t);
    tineGain.gain.linearRampToValueAtTime(0.03, t + 0.005);
    tineGain.gain.exponentialRampToValueAtTime(0.0001, t + 0.4);
    
    tine.connect(tineGain);
    tineGain.connect(ctx.destination);
    tine.start(t);
    tine.stop(t + 0.5);
  });
}

export function playChord(chord, stroke, startTime, bpm = 120) {
  const ctx = getAudioContext();
  resumeAudioContext();

  const notes = resolveChordNotes(chord);
  if (!notes || notes.length === 0) return;

  const start = startTime ?? ctx.currentTime;
  const beatSec = 60 / bpm;

  // Branch by instrument setting
  const settings = loadSettings();
  const instrument = settings ? settings.instrument : "guitar";
  if (instrument === "piano") {
    playPianoChord(ctx, notes, stroke, start, beatSec);
    return;
  }

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
    // 1. Down Strum (t = 0 beats)
    notes.forEach((note, si) => {
      if (note < 0) return;
      const freq = midiToFreq(note);
      const t = start + si * 0.012;
      pluckString(ctx, freq, t, volume, 1.4);
    });
    // 2. Up Strum (t = 0.5 beats)
    [...notes].reverse().forEach((note, si) => {
      if (note < 0) return;
      const freq = midiToFreq(note);
      const t = start + beatSec * 0.5 + si * 0.010;
      pluckString(ctx, freq, t, volume * 0.5, 1.0);
    });
    // 3. Down Strum (t = 1.0 beats)
    notes.forEach((note, si) => {
      if (note < 0) return;
      const freq = midiToFreq(note);
      const t = start + beatSec * 1.0 + si * 0.012;
      pluckString(ctx, freq, t, volume * 0.75, 1.3);
    });
    // 4. Up Strum (t = 1.5 beats)
    [...notes].reverse().forEach((note, si) => {
      if (note < 0) return;
      const freq = midiToFreq(note);
      const t = start + beatSec * 1.5 + si * 0.010;
      pluckString(ctx, freq, t, volume * 0.55, 1.0);
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

// Helper to find the last played chord before the start index (for Repeat/Continue feature)
function findLastPlayedChord(startIndex, config) {
  const total = config.totalSlots;
  for (let i = 1; i <= total; i++) {
    const checkIdx = (startIndex - i + total) % total;
    const s = config.getSlot(checkIdx);
    if (s && !s.isContinue && s.root) {
      return s;
    }
  }
  return null;
}

/**
 * Start the sequencer playback loop
 * @param {Object} config - { bpm, stroke, loop, totalSlots, loopStartSlot, loopEndSlot, getSlot, onBeat, onEnd }
 */
export function startSequencer(config) {
  stopSequencer();
  
  const ctx = getAudioContext();
  resumeAudioContext();

  // Each slot represents 2 beats in 4/4 time (since each bar is 4 beats and has 2 slots)
  const slotDuration = (60 / config.bpm) * 2;
  
  const startSlot = config.loopStartSlot !== undefined ? config.loopStartSlot : 0;
  
  schedulerState = {
    nextSlotIndex: startSlot,
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

      if (slot) {
        if (!slot.isContinue && slot.root) {
          playChord(slot, config.stroke, schedulerState.nextSlotTime, config.bpm);
        } else if (slot.isContinue) {
          const chordToPlay = findLastPlayedChord(actualSlotIndex, config);
          if (chordToPlay) {
            playChord(chordToPlay, config.stroke, schedulerState.nextSlotTime, config.bpm);
          }
        }
      }

      // Trigger visual/position update callback
      config.onBeat(actualSlotIndex);

      schedulerState.nextSlotIndex++;
      schedulerState.nextSlotTime += slotDuration;

      const loopStart = config.loopStartSlot !== undefined ? config.loopStartSlot : 0;
      const loopEnd = config.loopEndSlot !== undefined ? config.loopEndSlot : (config.totalSlots - 1);

      if (config.loop) {
        if (schedulerState.nextSlotIndex > loopEnd) {
          schedulerState.nextSlotIndex = loopStart;
        }
      } else {
        if (schedulerState.nextSlotIndex > loopEnd) {
          const stopDelayMs = (schedulerState.nextSlotTime - now) * 1000 + 100;
          stopSequencer();
          setTimeout(() => {
            config.onEnd();
          }, stopDelayMs);
          return;
        }
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
export function seekSequencer(slotIndex, loopStartSlot, loopEndSlot) {
  if (!schedulerState) return;
  const ctx = getAudioContext();
  let targetIndex = slotIndex;
  if (loopStartSlot !== undefined && loopEndSlot !== undefined) {
    if (targetIndex < loopStartSlot || targetIndex > loopEndSlot) {
      targetIndex = loopStartSlot;
    }
  }
  schedulerState.nextSlotIndex = targetIndex;
  schedulerState.nextSlotTime = ctx.currentTime + 0.05;
}

// Check if sequencer is currently playing
export function isSequencerPlaying() {
  return scheduleIntervalId !== null;
}
