/* ==========================================================================
   Cadence - Song Data Controller (Loading, Autosaving, Transposition Apply)
   ========================================================================= */

import { state } from './state.js';
import { dom } from '../ui/dom.js';
import { createEmptySlot } from '../chordDb.js';
import { loadSong as storageLoadSong, saveSong as storageSaveSong } from './storage.js';
import { patternToSong } from './patternToSong.js';
import { initLoopABOptions, rebuildFocusTimeline } from '../ui/practice.js';
import { renderToolbar } from '../ui/toolbar.js';
import { renderEditor } from '../ui/editor.js';

let callbacks = {};

/**
 * Initialize Song Controller.
 * 
 * @param {Object} cb - Callbacks
 * @param {Function} cb.renderKeyChips
 * @param {Function} cb.stopSequencer
 * @param {Function} cb.startPlayback
 */
export function initSongController(cb) {
  callbacks = cb;
}

export function createDefaultSong() {
  return {
    bpm: 120,
    stroke: "arpeggio",
    loop: true,
    sections: [
      {
        bars: Array.from({ length: 4 }, () => ({
          slots: [createEmptySlot(), createEmptySlot()]
        }))
      }
    ]
  };
}

export function loadSong() {
  const loaded = storageLoadSong();
  if (loaded) {
    state.song = loaded;
  } else {
    state.song = createDefaultSong();
  }
}

export function saveSong() {
  if (state.currentPattern) return; // Don't save book patterns
  
  try {
    storageSaveSong(state.song);
    
    // Flash auto-saved status indicator
    if (dom.autoSavedText) {
      dom.autoSavedText.textContent = "Auto-saved";
      dom.autoSavedText.style.opacity = "1";
      setTimeout(() => {
        dom.autoSavedText.style.opacity = "0.7";
      }, 1000);
    }
  } catch (e) {
    console.error("Failed to save song to localStorage:", e);
  }
}

export function applyPatternChange() {
  if (!state.currentPattern) return;
  
  const newSong = patternToSong(state.currentPattern, state.currentKey);
  if (newSong) {
    state.song = newSong;
    
    if (dom.bpmInput) {
      dom.bpmInput.value = state.song.bpm;
    }
    
    if (state.playback.isPlaying) {
      if (callbacks.stopSequencer) callbacks.stopSequencer();
      if (callbacks.startPlayback) callbacks.startPlayback();
    }
    
    initLoopABOptions();
    rebuildFocusTimeline();
    
    renderToolbar();
    renderEditor();
  }
}
