/* ==========================================================================
   Cadence - Playback Control Toolbar UI Component
   ========================================================================== */

import { dom } from './dom.js';
import { state } from '../core/state.js';
import { loadSettings, saveSettings } from '../core/storage.js';
import { saveSong } from '../core/song.js';

const STROKE_TEXT = { strong: "Strong", soft: "Soft", arpeggio: "Arpeggio" };
const STROKE_SYMBOL = { strong: "↓↓", soft: "↕↕", arpeggio: "~" };

let callbacks = {};

/**
 * Initialize Playback Toolbar.
 * 
 * @param {Object} cb - Callbacks
 * @param {Function} cb.stopSequencer
 * @param {Function} cb.startPlayback
 */
export function initToolbar(cb) {
  callbacks = cb;
  
  // BPM Inputs
  if (dom.bpmInput) {
    dom.bpmInput.addEventListener("change", (e) => {
      let bpm = parseInt(e.target.value) || 120;
      bpm = Math.max(40, Math.min(240, bpm));
      state.song.bpm = bpm;
      dom.bpmInput.value = bpm;
      saveSong();
      
      // If playing, restart sequencer to apply BPM change immediately
      if (state.playback.isPlaying) {
        if (callbacks.stopSequencer) callbacks.stopSequencer();
        if (callbacks.startPlayback) callbacks.startPlayback();
      }
    });
  }
  
  if (dom.bpmDown) {
    dom.bpmDown.addEventListener("click", () => {
      state.song.bpm = Math.max(40, state.song.bpm - 1);
      if (dom.bpmInput) dom.bpmInput.value = state.song.bpm;
      saveSong();
      if (state.playback.isPlaying) {
        if (callbacks.stopSequencer) callbacks.stopSequencer();
        if (callbacks.startPlayback) callbacks.startPlayback();
      }
    });
    // Prevent button focus grabbing on click
    dom.bpmDown.addEventListener("pointerdown", e => e.preventDefault());
  }
  
  if (dom.bpmUp) {
    dom.bpmUp.addEventListener("click", () => {
      state.song.bpm = Math.min(240, state.song.bpm + 1);
      if (dom.bpmInput) dom.bpmInput.value = state.song.bpm;
      saveSong();
      if (state.playback.isPlaying) {
        if (callbacks.stopSequencer) callbacks.stopSequencer();
        if (callbacks.startPlayback) callbacks.startPlayback();
      }
    });
    // Prevent button focus grabbing on click
    dom.bpmUp.addEventListener("pointerdown", e => e.preventDefault());
  }
  
  // Stroke Selector
  if (dom.strokeSelector) {
    dom.strokeSelector.addEventListener("click", () => {
      const list = ["strong", "soft", "arpeggio"];
      const idx = list.indexOf(state.song.stroke);
      state.song.stroke = list[(idx + 1) % 3];
      saveSong();
      renderToolbar();
      
      // Restart if playing
      if (state.playback.isPlaying) {
        if (callbacks.stopSequencer) callbacks.stopSequencer();
        if (callbacks.startPlayback) callbacks.startPlayback();
      }
    });
  }
  
  // Loop Toggle
  if (dom.loopToggle) {
    dom.loopToggle.addEventListener("click", () => {
      state.song.loop = !state.song.loop;
      saveSong();
      renderToolbar();
      
      // Restart if playing
      if (state.playback.isPlaying) {
        if (callbacks.stopSequencer) callbacks.stopSequencer();
        if (callbacks.startPlayback) callbacks.startPlayback();
      }
    });
  }
  
  // Instrument Selector
  if (dom.instrumentSelector) {
    dom.instrumentSelector.addEventListener("click", () => {
      const settings = loadSettings() || { instrument: "guitar" };
      const currentInst = settings.instrument || "guitar";
      const newInst = currentInst === "piano" ? "guitar" : "piano";
      
      saveSettings({ ...settings, instrument: newInst });
      renderInstrumentSelector();
      
      // Refresh the diagram visualization instantly
      if (callbacks.renderFocusView) {
        callbacks.renderFocusView();
      }
    });
  }
}

export function renderToolbar() {
  if (dom.bpmInput && state.song) {
    dom.bpmInput.value = state.song.bpm;
  }
  
  if (dom.strokeSelector && state.song) {
    const strokeSymbol = STROKE_SYMBOL[state.song.stroke] || "~";
    const strokeText = STROKE_TEXT[state.song.stroke] || "Arpeggio";
    const symbolEl = dom.strokeSelector.querySelector(".stroke-symbol");
    const textEl = dom.strokeSelector.querySelector(".stroke-text");
    if (symbolEl) symbolEl.textContent = strokeSymbol;
    if (textEl) textEl.textContent = strokeText;
    dom.strokeSelector.title = `Stroke: ${strokeText}`;
  }
  
  if (dom.loopToggle && state.song) {
    if (state.song.loop) {
      dom.loopToggle.classList.add("active");
    } else {
      dom.loopToggle.classList.remove("active");
    }
  }
  
  updatePositionDisplay();
}

export function updatePositionDisplay() {
  if (!dom.positionDisplay || !state.song) return;
  const currentSlot = state.playback.currentSlot;
  const currentBar = Math.floor(currentSlot / 2);
  const totalBars = state.song.sections.length * 4;
  dom.positionDisplay.textContent = `${currentBar + 1}/${totalBars}`;
}

export function renderInstrumentSelector() {
  const settings = loadSettings() || { instrument: "guitar" };
  const inst = settings.instrument || "guitar";
  const symbol = inst === "piano" ? "🎹" : "🎸";
  const text = inst === "piano" ? "Piano" : "Guitar";
  
  if (dom.instrumentSelector) {
    const symbolEl = dom.instrumentSelector.querySelector(".instrument-symbol");
    const textEl = dom.instrumentSelector.querySelector(".instrument-text");
    if (symbolEl) symbolEl.textContent = symbol;
    if (textEl) textEl.textContent = text;
    dom.instrumentSelector.title = `Instrument: ${text}`;
  }
}
