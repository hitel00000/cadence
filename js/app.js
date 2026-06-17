/* ==========================================================================
   Cadence - Main Application Controller
   ========================================================================== */

import { 
  createEmptySlot, 
  createContinueSlot, 
  getDisplayString
} from './chordDb.js';
import { drawChordDiagram } from './ui/diagram.js';
import { 
  previewChord, 
  startSequencer, 
  stopSequencer, 
  seekSequencer, 
  isSequencerPlaying 
} from './audio.js';
import { 
  loadSong as storageLoadSong, 
  saveSong as storageSaveSong,
  loadSettings,
  saveSettings
} from './core/storage.js';
import { patternToSong } from './core/patternToSong.js';
import { ICONS } from './ui/icons.js';
import { dom, cacheDOMElements } from './ui/dom.js';
import { store, state } from './core/state.js';
import { initLibraryDrawer, loadPatterns } from './ui/library.js';
import { initChordPicker, openPicker, closePicker, renderPicker, isPickerOpen } from './ui/picker.js';
import { initToolbar, renderToolbar, updatePositionDisplay, renderInstrumentSelector } from './ui/toolbar.js';
import { 
  initPracticeFocusView, 
  renderFocusView, 
  updateFocusViewActiveSlot, 
  rebuildFocusTimeline, 
  initLoopABOptions, 
  requestWakeLock, 
  releaseWakeLock 
} from './ui/practice.js';
import { initEditor, renderEditor, addSection, removeSection } from './ui/editor.js';



// Initialize Application
document.addEventListener("DOMContentLoaded", () => {
  cacheDOMElements();
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



// ─── State Persistence (localStorage) ───

function createDefaultSong() {
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

function loadSong() {
  const loaded = storageLoadSong();
  if (loaded) {
    state.song = loaded;
  } else {
    state.song = createDefaultSong();
  }
}

function saveSong() {
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

// ─── Rendering Helpers ───

function renderHeader() {
  const count = state.song.sections.length;
  dom.sectionCount.textContent = `${count} section${count !== 1 ? 's' : ''}`;
}





// ─── Playhead Sequential Highlighter ───
// Updates playhead DOM classes directly to bypass heavy re-renders
function updatePlayheadDOM(activeSlotIdx) {
  state.playback.currentSlot = activeSlotIdx;
  updatePositionDisplay();

  if (state.uiMode === "practice") {
    renderFocusView();
  }

  // Remove playheads and active beat dots from all buttons
  document.querySelectorAll(".chord-slot").forEach(slotBtn => {
    const playhead = slotBtn.querySelector(".playhead-highlight");
    if (playhead) playhead.remove();
    const dot = slotBtn.querySelector(".beat-dot");
    if (dot) dot.remove();
  });
  
  // Update state position
  state.playback.currentSlot = activeSlotIdx;
  updatePositionDisplay();
  
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





// ─── Actions & Callbacks ───

function selectSlot(sIdx, bIdx, slIdx) {
  if (state.currentPattern) {
    state.currentPattern = null;
    if (dom.currentPatternTitle) {
      dom.currentPatternTitle.textContent = "자유 연주곡";
    }
    renderKeyChips();
    saveSong(); // Saves transposed pattern as local custom song
  }

  state.editing = { sectionIndex: sIdx, barIndex: bIdx, slotIndex: slIdx };
  
  // Force a rendering to show which slot is editing
  renderEditor();
  openPicker();
}

function updateEditingSlot(updatedFields) {
  if (!state.editing) return;
  const { sectionIndex, barIndex, slotIndex } = state.editing;
  const slot = state.song.sections[sectionIndex].bars[barIndex].slots[slotIndex];
  
  // Apply changes
  Object.assign(slot, updatedFields);
  
  // Trigger sound preview if root note was changed
  if (updatedFields.root || updatedFields.quality || updatedFields.tension || updatedFields.extension || updatedFields.bassNote) {
    if (slot.root && !slot.isContinue) {
      previewChord(slot, state.song.stroke, state.song.bpm);
    }
  }
  
  saveSong();
  renderPicker();
}

function toggleContinueSlot() {
  if (!state.editing) return;
  const slot = getEditingSlot();
  
  if (slot.isContinue) {
    // Turn off continue: reset to empty slot
    updateEditingSlot(createEmptySlot());
  } else {
    // Turn on continue: reset root variables and make continue
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
      previewChord(slot, state.song.stroke, state.song.bpm);
    } else if (slot.isContinue && state.editing) {
      const lastChord = findLastPlayedChordFromEditor(state.editing.sectionIndex, state.editing.barIndex, state.editing.slotIndex);
      if (lastChord) {
        previewChord(lastChord, state.song.stroke, state.song.bpm);
      }
    }
  }
}

function clearEditingChord() {
  updateEditingSlot(createEmptySlot());
  closePicker();
}



// ─── Playback Engine Controllers ───

function togglePlayback() {
  if (state.playback.isPlaying) {
    pausePlayback();
  } else {
    startPlayback();
  }
}

function startPlayback() {
  if (state.playback.isPlaying) return;
  
  state.playback.isPlaying = true;
  dom.playPause.innerHTML = ICONS.pause;
  dom.playPause.classList.remove("paused");
  dom.playPause.classList.add("playing");
  
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
      updatePlayheadDOM(idx);
    },
    onEnd: () => {
      // Loop finished, reset playhead
      state.playback.isPlaying = false;
      state.playback.currentSlot = state.playback.loopABActive ? (state.playback.loopStartBar * 2) : 0;
      dom.playPause.innerHTML = ICONS.play;
      dom.playPause.classList.remove("playing");
      dom.playPause.classList.add("paused");
      updatePlayheadDOM(state.playback.currentSlot);
      releaseWakeLock();
    }
  });
  
  // Seek sequencer to current selection
  let startSlot = state.playback.currentSlot;
  if (state.playback.loopABActive && (startSlot < loopStartSlot || startSlot > loopEndSlot)) {
    startSlot = loopStartSlot;
    state.playback.currentSlot = loopStartSlot;
    updatePlayheadDOM(loopStartSlot);
  }
  seekSequencer(startSlot, loopStartSlot, loopEndSlot);
  
  requestWakeLock();
}

function pausePlayback() {
  if (!state.playback.isPlaying) return;
  
  state.playback.isPlaying = false;
  dom.playPause.innerHTML = ICONS.play;
  dom.playPause.classList.remove("playing");
  dom.playPause.classList.add("paused");
  stopSequencer();
  releaseWakeLock();
}

function stopPlayback() {
  state.playback.isPlaying = false;
  state.playback.currentSlot = state.playback.loopABActive ? (state.playback.loopStartBar * 2) : 0;
  dom.playPause.innerHTML = ICONS.play;
  dom.playPause.classList.remove("playing");
  dom.playPause.classList.add("paused");
  stopSequencer();
  updatePlayheadDOM(state.playback.currentSlot);
  releaseWakeLock();
}

function seekFirst() {
  seekTo(0);
}

function seekLast() {
  const totalBars = state.song.sections.length * 4;
  seekTo(totalBars - 1);
}

function seekPrev() {
  const currentBar = Math.floor(state.playback.currentSlot / 2);
  const nextBar = Math.max(0, currentBar - 1);
  seekTo(nextBar);
}

function seekNext() {
  const currentBar = Math.floor(state.playback.currentSlot / 2);
  const totalBars = state.song.sections.length * 4;
  const nextBar = Math.min(totalBars - 1, currentBar + 1);
  seekTo(nextBar);
}

function seekTo(barIndex) {
  const slotIdx = barIndex * 2;
  state.playback.currentSlot = slotIdx;
  updatePositionDisplay();
  
  if (state.playback.isPlaying) {
    seekSequencer(slotIdx);
  } else {
    // Visual update only
    updatePlayheadDOM(slotIdx);
  }
}

// ─── Helpers ───

function getEditingSlot() {
  if (!state.editing) return null;
  const { sectionIndex, barIndex, slotIndex } = state.editing;
  return state.song.sections[sectionIndex].bars[barIndex].slots[slotIndex];
}

function getSlotByAbsoluteIndex(absIdx) {
  const totalSlots = state.song.sections.length * 8;
  const idx = absIdx % totalSlots;
  
  const sectionIdx = Math.floor(idx / 8);
  const remainder = idx % 8;
  const barIdx = Math.floor(remainder / 2);
  const slotIdx = remainder % 2;
  
  return state.song.sections[sectionIdx]?.bars[barIdx]?.slots[slotIdx] ?? null;
}

// ─── Event Binding ───

function bindEvents() {
  // Initialize Playback Toolbar Component
  initToolbar({
    stopSequencer,
    startPlayback
  });
  
  // Sequencer control actions
  dom.playPause.addEventListener("click", togglePlayback);
  dom.stop.addEventListener("click", stopPlayback);
  dom.seekFirst.addEventListener("click", seekFirst);
  dom.seekPrev.addEventListener("click", seekPrev);
  dom.seekNext.addEventListener("click", seekNext);
  dom.seekLast.addEventListener("click", seekLast);
  
  // Initialize Progression Editor Component
  initEditor({
    renderKeyChips,
    selectSlot,
    renderHeader
  });
  
  // Initialize Chord Picker Modal Component
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
    // Avoid triggering shortcuts when editing input values
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



  // Initialize Practice Focus View Component
  initPracticeFocusView({
    seekSequencer,
    updatePlayheadDOM,
    stopSequencer,
    startPlayback
  });

  // Initialize Library Drawer Component
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

// ─── Pattern Library & Focus View Helpers ───



function getNextChordName(activeIdx) {
  const totalSlots = state.song.sections.length * 8;
  for (let i = 1; i < totalSlots; i++) {
    const nextIdx = (activeIdx + i) % totalSlots;
    const s = getSlotByAbsoluteIndex(nextIdx);
    if (s && !s.isContinue && s.root) {
      return getDisplayString(s);
    }
  }
  return "—";
}



function renderKeyChips() {
  if (!dom.keyChips) return;
  
  const keys = ["C", "Db", "D", "Eb", "E", "F", "F#", "G", "Ab", "A", "Bb", "B"];
  dom.keyChips.innerHTML = "";
  
  keys.forEach(key => {
    const chip = document.createElement("button");
    chip.className = `key-chip${state.currentKey === key ? " active" : ""}`;
    chip.textContent = key;
    
    if (!state.currentPattern) {
      chip.disabled = true;
      chip.style.opacity = "0.5";
      chip.style.cursor = "not-allowed";
    }
    
    chip.addEventListener("click", () => {
      if (!state.currentPattern) return;
      state.currentKey = key;
      renderKeyChips();
      applyPatternChange();
    });
    
    dom.keyChips.appendChild(chip);
  });
}

function applyPatternChange() {
  if (!state.currentPattern) return;
  
  const newSong = patternToSong(state.currentPattern, state.currentKey);
  if (newSong) {
    state.song = newSong;
    
    if (dom.bpmInput) {
      dom.bpmInput.value = state.song.bpm;
    }
    
    if (state.playback.isPlaying) {
      stopSequencer();
      startPlayback();
    }
    
    initLoopABOptions();
    rebuildFocusTimeline();
    
    renderToolbar();
    renderEditor();
  }
}
