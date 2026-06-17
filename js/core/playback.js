/* ==========================================================================
   Cadence - Centralized Playback Engine Controller
   ========================================================================== */

import { state } from './state.js';
import { dom } from '../ui/dom.js';
import { ICONS } from '../ui/icons.js';
import { startSequencer, stopSequencer, seekSequencer } from '../audio.js';
import { requestWakeLock, releaseWakeLock } from '../ui/practice.js';

let callbacks = {};

function getSlotByAbsoluteIndex(absIdx) {
  if (!state.song || !state.song.sections) return null;
  const totalSlots = state.song.sections.length * 8;
  const idx = absIdx % totalSlots;
  
  const sectionIdx = Math.floor(idx / 8);
  const remainder = idx % 8;
  const barIdx = Math.floor(remainder / 2);
  const slotIdx = remainder % 2;
  
  return state.song.sections[sectionIdx]?.bars[barIdx]?.slots[slotIdx] ?? null;
}

/**
 * Initialize Playback Controller.
 * 
 * @param {Object} cb - Callbacks
 * @param {Function} cb.updatePlayheadDOM
 * @param {Function} cb.updatePositionDisplay
 */
export function initPlayback(cb) {
  callbacks = cb;
}

export function togglePlayback() {
  if (state.playback.isPlaying) {
    pausePlayback();
  } else {
    startPlayback();
  }
}

export function startPlayback() {
  if (state.playback.isPlaying) return;
  
  state.playback.isPlaying = true;
  if (dom.playPause) {
    dom.playPause.innerHTML = ICONS.pause;
    dom.playPause.classList.remove("paused");
    dom.playPause.classList.add("playing");
  }
  
  const totalSlots = state.song.sections.length * 8;
  
  // A-B loop slots
  let loopStartSlot = 0;
  let loopEndSlot = totalSlots - 1;
  if (state.playback.loopABActive) {
    loopStartSlot = state.playback.loopStartBar * 2;
    loopEndSlot = state.playback.loopEndBar * 2 + 1;
  }
  
  startSequencer({
    bpm: state.song.bpm,
    stroke: state.song.stroke,
    loop: state.song.loop,
    totalSlots: totalSlots,
    loopStartSlot: loopStartSlot,
    loopEndSlot: loopEndSlot,
    getSlot: (idx) => getSlotByAbsoluteIndex(idx),
    onBeat: (idx) => {
      if (callbacks.updatePlayheadDOM) callbacks.updatePlayheadDOM(idx);
    },
    onEnd: () => {
      // Loop finished, reset playhead
      state.playback.isPlaying = false;
      state.playback.currentSlot = state.playback.loopABActive ? (state.playback.loopStartBar * 2) : 0;
      if (dom.playPause) {
        dom.playPause.innerHTML = ICONS.play;
        dom.playPause.classList.remove("playing");
        dom.playPause.classList.add("paused");
      }
      if (callbacks.updatePlayheadDOM) callbacks.updatePlayheadDOM(state.playback.currentSlot);
      releaseWakeLock();
    }
  });
  
  // Seek sequencer to current selection
  let startSlot = state.playback.currentSlot;
  if (state.playback.loopABActive && (startSlot < loopStartSlot || startSlot > loopEndSlot)) {
    startSlot = loopStartSlot;
    state.playback.currentSlot = loopStartSlot;
    if (callbacks.updatePlayheadDOM) callbacks.updatePlayheadDOM(loopStartSlot);
  }
  seekSequencer(startSlot, loopStartSlot, loopEndSlot);
  
  requestWakeLock();
}

export function pausePlayback() {
  if (!state.playback.isPlaying) return;
  
  state.playback.isPlaying = false;
  if (dom.playPause) {
    dom.playPause.innerHTML = ICONS.play;
    dom.playPause.classList.remove("playing");
    dom.playPause.classList.add("paused");
  }
  stopSequencer();
  releaseWakeLock();
}

export function stopPlayback() {
  state.playback.isPlaying = false;
  state.playback.currentSlot = state.playback.loopABActive ? (state.playback.loopStartBar * 2) : 0;
  if (dom.playPause) {
    dom.playPause.innerHTML = ICONS.play;
    dom.playPause.classList.remove("playing");
    dom.playPause.classList.add("paused");
  }
  stopSequencer();
  if (callbacks.updatePlayheadDOM) callbacks.updatePlayheadDOM(state.playback.currentSlot);
  releaseWakeLock();
}

export function seekFirst() {
  seekTo(0);
}

export function seekLast() {
  const totalBars = state.song.sections.length * 4;
  seekTo(totalBars - 1);
}

export function seekPrev() {
  const currentBar = Math.floor(state.playback.currentSlot / 2);
  const nextBar = Math.max(0, currentBar - 1);
  seekTo(nextBar);
}

export function seekNext() {
  const currentBar = Math.floor(state.playback.currentSlot / 2);
  const totalBars = state.song.sections.length * 4;
  const nextBar = Math.min(totalBars - 1, currentBar + 1);
  seekTo(nextBar);
}

export function seekTo(barIndex) {
  const slotIdx = barIndex * 2;
  state.playback.currentSlot = slotIdx;
  if (callbacks.updatePositionDisplay) callbacks.updatePositionDisplay();
  
  if (state.playback.isPlaying) {
    seekSequencer(slotIdx);
  } else {
    // Visual update only
    if (callbacks.updatePlayheadDOM) callbacks.updatePlayheadDOM(slotIdx);
  }
}
