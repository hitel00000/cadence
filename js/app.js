/* ==========================================================================
   Cadence - Main Application Entry & Mediator Controller
   ========================================================================== */

import { 
  createEmptySlot, 
  createContinueSlot, 
  getDisplayString
} from './chordDb.js';
import { drawChordDiagram } from './ui/diagram.js';
import { 
  stopSequencer, 
  seekSequencer 
} from './audio.js';
import { dom, cacheDOMElements } from './ui/dom.js';
import { state } from './core/state.js';
import { checkWakeLockSupport } from './ui/practice.js';

// Module Imports
import { initLibraryDrawer, loadPatterns } from './ui/library.js';
import { initChordPicker, openPicker, closePicker, renderPicker, isPickerOpen } from './ui/picker.js';
import { initToolbar, renderToolbar, updatePositionDisplay, renderInstrumentSelector } from './ui/toolbar.js';
import { 
  initPracticeFocusView, 
  renderFocusView, 
  updateFocusViewActiveSlot, 
  rebuildFocusTimeline, 
  initLoopABOptions 
} from './ui/practice.js';
import { initEditor, renderEditor } from './ui/editor.js';
import { renderKeyChips } from './ui/keyChips.js';
import { 
  initSongController, 
  loadSong, 
  saveSong, 
  applyPatternChange 
} from './core/song.js';
import { 
  initPlayback, 
  togglePlayback, 
  startPlayback, 
  stopPlayback, 
  seekFirst, 
  seekLast, 
  seekPrev, 
  seekNext, 
  seekTo 
} from './core/playback.js';

// Initialize Application
document.addEventListener("DOMContentLoaded", () => {
  cacheDOMElements();
  
  // Initialize Controllers & Bindings
  initSongController({
    renderKeyChips,
    stopSequencer,
    startPlayback
  });
  
  initPlayback({
    updatePlayheadDOM,
    updatePositionDisplay
  });
  
  loadSong();
  loadPatterns();
  renderHeader();
  renderToolbar();
  renderInstrumentSelector();
  initLoopABOptions();
  rebuildFocusTimeline();
  checkWakeLockSupport();
  renderEditor();
  renderKeyChips();
  bindEvents();
});

function renderHeader() {
  const count = state.song.sections.length;
  if (dom.sectionCount) {
    dom.sectionCount.textContent = `${count} section${count !== 1 ? 's' : ''}`;
  }
}

// Updates playhead DOM classes directly to bypass heavy re-renders
export function updatePlayheadDOM(activeSlotIdx) {
  state.playback.currentSlot = activeSlotIdx;
  updatePositionDisplay();

  if (state.uiMode === "practice") {
    renderFocusView();
    return; // Skip edit grid DOM updates in practice mode
  }

  // Remove playheads and active beat dots from all buttons
  document.querySelectorAll(".chord-slot").forEach(slotBtn => {
    const playhead = slotBtn.querySelector(".playhead-highlight");
    if (playhead) playhead.remove();
    const dot = slotBtn.querySelector(".beat-dot");
    if (dot) dot.remove();
  });
  
  // Add playhead to the active button
  const activeBtn = document.querySelector(`.chord-slot[data-slot-idx="${activeSlotIdx}"]`);
  if (activeBtn) {
    const playhead = document.createElement("div");
    playhead.className = "playhead-highlight";
    activeBtn.insertBefore(playhead, activeBtn.firstChild);
    
    const slot = getSlotByAbsoluteIndex(activeSlotIdx);
    if (slot && (slot.root || slot.isContinue)) {
      const dot = document.createElement("div");
      dot.className = "beat-dot";
      activeBtn.appendChild(dot);
    }
  }
}

function selectSlot(sIdx, bIdx, slIdx) {
  if (state.currentPattern) {
    state.currentPattern = null;
    if (dom.currentPatternTitle) {
      dom.currentPatternTitle.textContent = "자유 연주곡";
    }
    renderKeyChips();
    saveSong();
  }

  state.editing = { sectionIndex: sIdx, barIndex: bIdx, slotIndex: slIdx };
  
  renderEditor();
  openPicker();
}

function updateEditingSlot(updatedFields) {
  if (!state.editing) return;
  const { sectionIndex, barIndex, slotIndex } = state.editing;
  const slot = state.song.sections[sectionIndex].bars[barIndex].slots[slotIndex];
  
  Object.assign(slot, updatedFields);
  
  // Preview audio on note change
  if (updatedFields.root || updatedFields.quality || updatedFields.tension || updatedFields.extension || updatedFields.bassNote) {
    if (slot.root && !slot.isContinue) {
      import('./audio.js').then(({ previewChord }) => {
        previewChord(slot, state.song.stroke, state.song.bpm);
      });
    }
  }
  
  saveSong();
  renderPicker();
}

function toggleContinueSlot() {
  if (!state.editing) return;
  const slot = getEditingSlot();
  
  if (slot.isContinue) {
    updateEditingSlot(createEmptySlot());
  } else {
    updateEditingSlot(createContinueSlot());
  }
}

function findLastPlayedChordFromEditor(sectionIndex, barIndex, slotIndex) {
  const totalSlots = state.song.sections.length * 8;
  const absoluteBarIdx = sectionIndex * 4 + barIndex;
  const absoluteSlotIdx = absoluteBarIdx * 2 + slotIndex;
  
  for (let i = 1; i <= totalSlots; i++) {
    const idx = (absoluteSlotIdx - i + totalSlots) % totalSlots;
    const s = getSlotByAbsoluteIndex(idx);
    if (s && !s.isContinue && s.root) {
      return s;
    }
  }
  return null;
}

function previewEditingChord() {
  const slot = getEditingSlot();
  if (slot) {
    if (!slot.isContinue && slot.root) {
      import('./audio.js').then(({ previewChord }) => {
        previewChord(slot, state.song.stroke, state.song.bpm);
      });
    } else if (slot.isContinue && state.editing) {
      const lastChord = findLastPlayedChordFromEditor(state.editing.sectionIndex, state.editing.barIndex, state.editing.slotIndex);
      if (lastChord) {
        import('./audio.js').then(({ previewChord }) => {
          previewChord(lastChord, state.song.stroke, state.song.bpm);
        });
      }
    }
  }
}

function clearEditingChord() {
  updateEditingSlot(createEmptySlot());
  closePicker();
}

function getEditingSlot() {
  if (!state.editing) return null;
  const { sectionIndex, barIndex, slotIndex } = state.editing;
  return state.song.sections[sectionIndex].bars[barIndex].slots[slotIndex];
}

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

function bindEvents() {
  initToolbar({
    stopSequencer,
    startPlayback
  });
  
  if (dom.playPause) dom.playPause.addEventListener("click", togglePlayback);
  if (dom.stop) dom.stop.addEventListener("click", stopPlayback);
  if (dom.seekFirst) dom.seekFirst.addEventListener("click", seekFirst);
  if (dom.seekPrev) dom.seekPrev.addEventListener("click", seekPrev);
  if (dom.seekNext) dom.seekNext.addEventListener("click", seekNext);
  if (dom.seekLast) dom.seekLast.addEventListener("click", seekLast);
  
  initEditor({
    renderKeyChips,
    selectSlot,
    renderHeader
  });
  
  initChordPicker({
    getEditingSlot,
    updateEditingSlot,
    previewEditingChord,
    toggleContinueSlot,
    clearEditingChord,
    renderEditor
  });
  
  // Keyboard Shortcuts (Spacebar = Play/Pause, Esc = Stop, Arrows = Seek, Enter = Apply/Done)
  window.addEventListener("keydown", (e) => {
    if (e.target.tagName === "INPUT" || e.target.tagName === "TEXTAREA" || e.target.isContentEditable) {
      return;
    }
    
    if (e.code === "Space") {
      e.preventDefault();
      togglePlayback();
    } else if (e.code === "Escape") {
      e.preventDefault();
      if (isPickerOpen()) {
        closePicker();
      } else {
        stopPlayback();
      }
    } else if (e.code === "Enter") {
      if (isPickerOpen()) {
        e.preventDefault();
        closePicker();
      }
    } else if (e.code === "ArrowLeft") {
      e.preventDefault();
      seekPrev();
    } else if (e.code === "ArrowRight") {
      e.preventDefault();
      seekNext();
    }
  });

  // Mode Toggle
  if (dom.modeToggle && dom.modePractice && dom.modeEdit) {
    dom.modePractice.addEventListener("click", () => {
      if (state.uiMode === "practice") return;
      state.uiMode = "practice";
      dom.modePractice.classList.add("active");
      dom.modeEdit.classList.remove("active");
      initLoopABOptions();
      rebuildFocusTimeline();
      renderEditor();
    });
    
    dom.modeEdit.addEventListener("click", () => {
      if (state.uiMode === "edit") return;
      state.uiMode = "edit";
      dom.modeEdit.classList.add("active");
      dom.modePractice.classList.remove("active");
      renderEditor();
    });
  }

  initPracticeFocusView({
    seekSequencer,
    updatePlayheadDOM,
    stopSequencer,
    startPlayback
  });

  initLibraryDrawer({
    loadSong,
    stopSequencer,
    startPlayback,
    renderToolbar,
    renderEditor,
    renderKeyChips,
    applyPatternChange
  });
}
