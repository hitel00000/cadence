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
    // Standard cross-browser support
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
 * Pluck a single guitar string using Web Audio API synthesis
 * Combines a sawtooth oscillator (for string brightness) and a triangle oscillator (for body warmth)
 * connected to a lowpass filter and shaped by an exponential gain envelope.
 */
export function pluckString(ctx, freq, startTime, volume, duration) {
  // Create gain node for envelope
  const gainNode = ctx.createGain();
  gainNode.connect(ctx.destination);

  const attack = 0.004;
  const decay = 0.4;
  const sustainRatio = 0.08;
  const release = 0.5;
  const totalDuration = startTime + attack + decay + duration + release;

  // Configure ADSR gain envelope
  gainNode.gain.setValueAtTime(0, startTime);
  gainNode.gain.linearRampToValueAtTime(volume, startTime + attack);
  gainNode.gain.exponentialRampToValueAtTime(Math.max(volume * sustainRatio, 0.001), startTime + attack + decay);
  gainNode.gain.setValueAtTime(volume * sustainRatio, startTime + attack + decay + duration);
  gainNode.gain.exponentialRampToValueAtTime(0.0001, totalDuration);

  // Configure lowpass filter to shave off high harsh frequencies
  const filterNode = ctx.createBiquadFilter();
  filterNode.type = "lowpass";
  filterNode.frequency.value = 3000;
  filterNode.Q.value = 0.8;
  filterNode.connect(gainNode);

  // Sawtooth oscillator (Chorus/Detuned brightness)
  const oscSaw = ctx.createOscillator();
  oscSaw.type = "sawtooth";
  oscSaw.frequency.value = freq;
  oscSaw.detune.value = (Math.random() - 0.5) * 6; // Slight detune for chorus richness

  const gainSaw = ctx.createGain();
  gainSaw.gain.value = 0.6; // Sawtooth contributes 60%
  oscSaw.connect(gainSaw);
  gainSaw.connect(filterNode);

  // Triangle oscillator (Warm body fundamental)
  const oscTri = ctx.createOscillator();
  oscTri.type = "triangle";
  oscTri.frequency.value = freq;
  oscTri.detune.value = (Math.random() - 0.5) * 6;

  const gainTri = ctx.createGain();
  gainTri.gain.value = 0.4; // Triangle contributes 40%
  oscTri.connect(gainTri);
  gainTri.connect(filterNode);

  // Schedule start/stop
  oscSaw.start(startTime);
  oscSaw.stop(totalDuration);
  oscTri.start(startTime);
  oscTri.stop(totalDuration);
}

/**
 * Play a full guitar chord strum
 * Configures stroke styles: strong (arpeggio roll = 0ms), soft (18ms), arpeggio (60ms)
 */
export function playChord(chord, stroke, startTime) {
  const ctx = getAudioContext();
  resumeAudioContext();

  const notes = resolveChordNotes(chord);
  if (notes.length === 0) return;

  const start = startTime ?? ctx.currentTime;
  let volume, stringDelay, pluckDuration;

  switch (stroke) {
    case "strong":
      volume = 0.55;
      stringDelay = 0.0;
      pluckDuration = 0.8;
      break;
    case "soft":
      volume = 0.28;
      stringDelay = 0.018; // Fast roll
      pluckDuration = 0.6;
      break;
    case "arpeggio":
    default:
      volume = 0.38;
      stringDelay = 0.06; // Slow pluck
      pluckDuration = 1.2;
      break;
  }

  // Pluck notes sequentially from low strings to high strings (index 0 to length-1)
  notes.forEach((note, idx) => {
    const pluckTime = start + idx * stringDelay;
    pluckString(ctx, midiToFreq(note), pluckTime, volume, pluckDuration);
  });
}

// Preview a chord instantly (e.g. when clicking play button in editor picker)
export function previewChord(chord, stroke = "arpeggio") {
  playChord(chord, stroke);
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
        playChord(slot, config.stroke, schedulerState.nextSlotTime);
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
