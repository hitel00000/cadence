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



function renderEditor() {
  if (state.uiMode === "practice") {
    if (dom.practiceFocusView) dom.practiceFocusView.style.display = "flex";
    if (dom.progressionEditor) dom.progressionEditor.style.display = "none";
    renderFocusView();
    return;
  }
  
  if (dom.practiceFocusView) dom.practiceFocusView.style.display = "none";
  if (dom.progressionEditor) dom.progressionEditor.style.display = "block";

  dom.progressionEditor.innerHTML = "";
  
  state.song.sections.forEach((section, sIdx) => {
    const sectionCard = document.createElement("div");
    sectionCard.className = "section-card";
    sectionCard.setAttribute("data-testid", `section-${sIdx}`);
    
    // Section Header
    const headerDiv = document.createElement("div");
    headerDiv.className = "section-header";
    
    const titleSpan = document.createElement("span");
    titleSpan.className = "section-title";
    titleSpan.textContent = `Section ${sIdx + 1}`;
    headerDiv.appendChild(titleSpan);
    
    if (state.song.sections.length > 1) {
      const removeBtn = document.createElement("button");
      removeBtn.className = "remove-section-btn";
      removeBtn.setAttribute("data-testid", `remove-section-${sIdx}`);
      removeBtn.innerHTML = ICONS.trash;
      removeBtn.addEventListener("click", () => removeSection(sIdx));
      headerDiv.appendChild(removeBtn);
    }
    
    sectionCard.appendChild(headerDiv);
    
    // Section Bars
    section.bars.forEach((bar, bIdx) => {
      const barRow = document.createElement("div");
      barRow.className = "bar-row";
      barRow.setAttribute("data-testid", `bar-${sIdx}-${bIdx}`);
      
      const barNumSpan = document.createElement("span");
      barNumSpan.className = "bar-num";
      barNumSpan.textContent = bIdx + 1;
      barRow.appendChild(barNumSpan);
      
      const barSlots = document.createElement("div");
      barSlots.className = "bar-slots";
      
      bar.slots.forEach((slot, slIdx) => {
        const absoluteBarIdx = sIdx * 4 + bIdx;
        const absoluteSlotIdx = absoluteBarIdx * 2 + slIdx;
        
        const slotBtn = document.createElement("button");
        slotBtn.className = "chord-slot";
        slotBtn.setAttribute("data-testid", `slot-${sIdx}-${bIdx}-${slIdx}`);
        slotBtn.setAttribute("data-slot-idx", absoluteSlotIdx);
        
        // Active visual classes
        const isEditing = state.editing && 
                          state.editing.sectionIndex === sIdx && 
                          state.editing.barIndex === bIdx && 
                          state.editing.slotIndex === slIdx;
                          
        const isActive = state.playback.currentSlot === absoluteSlotIdx;
        const hasRoot = !!slot.root;
        const isContinue = !!slot.isContinue;
        
        if (isEditing) {
          slotBtn.classList.add("active-slot");
        }
        if (isContinue) {
          slotBtn.classList.add("continue-slot");
        }
        if (!hasRoot && !isContinue) {
          slotBtn.classList.add("empty-chord");
        } else if (isContinue) {
          slotBtn.classList.add("continue-chord");
        }
        
        // Playhead Highlighter overlay (if active)
        if (isActive && state.playback.isPlaying) {
          const playhead = document.createElement("div");
          playhead.className = "playhead-highlight";
          slotBtn.appendChild(playhead);
        }
        
        // Continue Line SVG
        if (isContinue) {
          const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
          svg.setAttribute("class", "continue-svg");
          svg.setAttribute("viewBox", "0 0 100 100");
          svg.setAttribute("preserveAspectRatio", "none");
          
          const line = document.createElementNS("http://www.w3.org/2000/svg", "line");
          line.setAttribute("x1", "0");
          line.setAttribute("y1", "50");
          line.setAttribute("x2", "100");
          line.setAttribute("y2", "50");
          line.setAttribute("class", "continue-line");
          
          svg.appendChild(line);
          slotBtn.appendChild(svg);
        }
        
        // Chord name text
        const chordText = document.createElement("span");
        chordText.className = "chord-text";
        chordText.textContent = getDisplayString(slot);
        slotBtn.appendChild(chordText);
        
        // Active beat indicator dot
        if (isActive && state.playback.isPlaying && (hasRoot || isContinue)) {
          const dot = document.createElement("div");
          dot.className = "beat-dot";
          slotBtn.appendChild(dot);
        }
        
        // Event click to edit
        slotBtn.addEventListener("click", () => {
          selectSlot(sIdx, bIdx, slIdx);
        });
        
        barSlots.appendChild(slotBtn);
      });
      
      barRow.appendChild(barSlots);
      sectionCard.appendChild(barRow);
    });
    
    dom.progressionEditor.appendChild(sectionCard);
  });
  
  // Add Section Button
  const addBtn = document.createElement("button");
  addBtn.className = "add-section-btn";
  addBtn.setAttribute("data-testid", "add-section");
  addBtn.innerHTML = `${ICONS.plus} Add Section`;
  addBtn.addEventListener("click", addSection);
  dom.progressionEditor.appendChild(addBtn);
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

function addSection() {
  if (state.currentPattern) {
    state.currentPattern = null;
    if (dom.currentPatternTitle) dom.currentPatternTitle.textContent = "자유 연주곡";
    renderKeyChips();
  }

  const newSection = {
    bars: Array.from({ length: 4 }, () => ({
      slots: [createEmptySlot(), createEmptySlot()]
    }))
  };
  
  state.song.sections.push(newSection);
  saveSong();
  initLoopABOptions();
  rebuildFocusTimeline();
  renderHeader();
  renderEditor();
  
  // Scroll to bottom
  setTimeout(() => {
    dom.progressionEditor.scrollTop = dom.progressionEditor.scrollHeight;
  }, 100);
}

function removeSection(sIdx) {
  if (state.song.sections.length <= 1) return;
  
  if (state.currentPattern) {
    state.currentPattern = null;
    if (dom.currentPatternTitle) dom.currentPatternTitle.textContent = "자유 연주곡";
    renderKeyChips();
  }

  state.song.sections.splice(sIdx, 1);
  
  // Handle editor focus safety
  if (state.editing && state.editing.sectionIndex === sIdx) {
    state.editing = null;
    closePicker();
  } else if (state.editing && state.editing.sectionIndex > sIdx) {
    state.editing.sectionIndex--;
  }
  
  saveSong();
  initLoopABOptions();
  rebuildFocusTimeline();
  renderHeader();
  renderEditor();
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



  // Focus Loop A-B and settings selectors
  const loopAbBtn = document.getElementById("loop-ab-btn");
  const selectorsContainer = document.getElementById("loop-ab-selectors");
  if (loopAbBtn && selectorsContainer) {
    loopAbBtn.addEventListener("click", () => {
      state.playback.loopABActive = !state.playback.loopABActive;
      if (state.playback.loopABActive) {
        loopAbBtn.classList.add("active");
        loopAbBtn.textContent = "🔄 구간 반복 (A-B Loop) ON";
        selectorsContainer.style.display = "flex";
      } else {
        loopAbBtn.classList.remove("active");
        loopAbBtn.textContent = "🔄 구간 반복 (A-B Loop) OFF";
        selectorsContainer.style.display = "none";
      }
      
      // Update visual range in timeline
      updateFocusViewActiveSlot(state.playback.currentSlot);
      
      // Restart playback if playing to apply new loop boundaries immediately
      if (state.playback.isPlaying) {
        stopSequencer();
        state.playback.isPlaying = false;
        startPlayback();
      }
    });
  }

  const startSelect = document.getElementById("loop-start-bar-select");
  const endSelect = document.getElementById("loop-end-bar-select");
  if (startSelect && endSelect) {
    startSelect.addEventListener("change", () => {
      let startVal = parseInt(startSelect.value);
      let endVal = parseInt(endSelect.value);
      if (startVal > endVal) {
        endVal = startVal;
        endSelect.value = endVal;
      }
      state.playback.loopStartBar = startVal;
      state.playback.loopEndBar = endVal;
      
      updateFocusViewActiveSlot(state.playback.currentSlot);
      
      if (state.playback.isPlaying) {
        stopSequencer();
        state.playback.isPlaying = false;
        startPlayback();
      }
    });
    
    endSelect.addEventListener("change", () => {
      let startVal = parseInt(startSelect.value);
      let endVal = parseInt(endSelect.value);
      if (endVal < startVal) {
        startVal = endVal;
        startSelect.value = startVal;
      }
      state.playback.loopStartBar = startVal;
      state.playback.loopEndBar = endVal;
      
      updateFocusViewActiveSlot(state.playback.currentSlot);
      
      if (state.playback.isPlaying) {
        stopSequencer();
        state.playback.isPlaying = false;
        startPlayback();
      }
    });
  }

  const wlBtn = document.getElementById("wake-lock-btn");
  if (wlBtn) {
    wlBtn.addEventListener("click", () => {
      if (!('wakeLock' in navigator)) {
        state.playback.wakeLockEnabled = false;
        return;
      }
      state.playback.wakeLockEnabled = !state.playback.wakeLockEnabled;
      if (state.playback.wakeLockEnabled) {
        wlBtn.classList.add("active");
        wlBtn.textContent = "💡 화면 켜짐 유지 ON";
        if (state.playback.isPlaying) {
          requestWakeLock();
        }
      } else {
        wlBtn.classList.remove("active");
        wlBtn.textContent = "💡 화면 켜짐 유지 OFF";
        releaseWakeLock();
      }
    });
  }

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

function renderFocusView() {
  if (!state.song || !state.song.sections || state.song.sections.length === 0) {
    return;
  }
  
  const activeSlotIdx = state.playback.currentSlot;
  let activeSlot = getSlotByAbsoluteIndex(activeSlotIdx);
  let resolvedSlot = activeSlot;
  if (activeSlot && activeSlot.isContinue) {
    resolvedSlot = findLastPlayedChordFromEditor(
      Math.floor(activeSlotIdx / 8),
      Math.floor((activeSlotIdx % 8) / 2),
      activeSlotIdx % 2
    );
  }
  
  const activeChordName = resolvedSlot ? getDisplayString(resolvedSlot) : "—";
  const nextChord = getNextChordName(activeSlotIdx);
  
  const nameEl = document.getElementById("focus-chord-name");
  const badgeEl = document.getElementById("focus-next-badge");
  const diagramBox = document.getElementById("focus-diagram-container");
  
  if (nameEl) nameEl.textContent = activeChordName;
  
  if (badgeEl) {
    badgeEl.textContent = `Next: ${nextChord}`;
    if (nextChord !== "—") {
      badgeEl.classList.add("has-next");
    } else {
      badgeEl.classList.remove("has-next");
    }
  }
  
  if (diagramBox) {
    diagramBox.innerHTML = "";
    if (resolvedSlot && resolvedSlot.root) {
      drawChordDiagram(resolvedSlot, diagramBox);
    }
  }
  
  // Highlight active slot & loop range in the timeline
  updateFocusViewActiveSlot(activeSlotIdx);
}

function updateFocusViewActiveSlot(activeSlotIdx) {
  const slots = document.querySelectorAll(".focus-preview-slot");
  slots.forEach((slotChip, idx) => {
    if (idx === activeSlotIdx) {
      slotChip.classList.add("active");
    } else {
      slotChip.classList.remove("active");
    }
  });
  
  // Highlight loop range visually if loop is active
  if (state.playback.loopABActive) {
    const startSlot = state.playback.loopStartBar * 2;
    const endSlot = state.playback.loopEndBar * 2 + 1;
    slots.forEach((slotChip, idx) => {
      if (idx >= startSlot && idx <= endSlot) {
        slotChip.classList.add("in-loop-range");
      } else {
        slotChip.classList.remove("in-loop-range");
      }
    });
  } else {
    slots.forEach(slotChip => {
      slotChip.classList.remove("in-loop-range");
    });
  }
}

function rebuildFocusTimeline() {
  const previewContainer = document.getElementById("focus-progression-preview");
  if (!previewContainer) return;
  
  previewContainer.innerHTML = "";
  if (!state.song || !state.song.sections) return;
  
  const totalSlots = state.song.sections.length * 8;
  for (let idx = 0; idx < totalSlots; idx++) {
    const slot = getSlotByAbsoluteIndex(idx);
    if (!slot) continue;
    
    const slotChip = document.createElement("button");
    slotChip.className = "focus-preview-slot";
    slotChip.textContent = getDisplayString(slot);
    
    slotChip.addEventListener("click", () => {
      state.playback.currentSlot = idx;
      
      let loopStartSlot = 0;
      let loopEndSlot = totalSlots - 1;
      if (state.playback.loopABActive) {
        loopStartSlot = state.playback.loopStartBar * 2;
        loopEndSlot = state.playback.loopEndBar * 2 + 1;
      }
      
      seekSequencer(idx, loopStartSlot, loopEndSlot);
      updatePlayheadDOM(idx);
    });
    
    previewContainer.appendChild(slotChip);
  }
}

function initLoopABOptions() {
  const startSelect = document.getElementById("loop-start-bar-select");
  const endSelect = document.getElementById("loop-end-bar-select");
  if (!startSelect || !endSelect) return;
  
  const totalBars = state.song ? state.song.sections.length * 4 : 0;
  
  // Save current values to restore them if possible
  const prevStart = startSelect.value ? parseInt(startSelect.value) : 0;
  const prevEnd = endSelect.value ? parseInt(endSelect.value) : (totalBars > 0 ? totalBars - 1 : 0);
  
  startSelect.innerHTML = "";
  endSelect.innerHTML = "";
  
  for (let i = 0; i < totalBars; i++) {
    const optStart = document.createElement("option");
    optStart.value = i;
    optStart.textContent = `마디 ${i + 1}`;
    startSelect.appendChild(optStart);
    
    const optEnd = document.createElement("option");
    optEnd.value = i;
    optEnd.textContent = `마디 ${i + 1}`;
    endSelect.appendChild(optEnd);
  }
  
  // Set values (clamped to range)
  state.playback.loopStartBar = Math.max(0, Math.min(totalBars - 1, prevStart));
  state.playback.loopEndBar = Math.max(state.playback.loopStartBar, Math.min(totalBars - 1, prevEnd));
  
  startSelect.value = state.playback.loopStartBar;
  endSelect.value = state.playback.loopEndBar;
}



// ─── Wake Lock API Integration ───
let wakeLock = null;

async function requestWakeLock() {
  if (!state.playback.wakeLockEnabled) return;
  try {
    if ('wakeLock' in navigator) {
      wakeLock = await navigator.wakeLock.request('screen');
      console.log('Screen Wake Lock acquired');
      const wlBtn = document.getElementById("wake-lock-btn");
      if (wlBtn) {
        wlBtn.classList.add("active");
        wlBtn.textContent = "💡 화면 켜짐 유지 ON";
      }
    }
  } catch (err) {
    console.error(`Wake Lock request failed: ${err.name}, ${err.message}`);
  }
}

function releaseWakeLock() {
  if (wakeLock !== null) {
    wakeLock.release().then(() => {
      wakeLock = null;
      console.log('Screen Wake Lock released');
    });
  }
}

function checkWakeLockSupport() {
  const wlBtn = document.getElementById("wake-lock-btn");
  if (wlBtn) {
    if (!('wakeLock' in navigator)) {
      wlBtn.disabled = true;
      wlBtn.classList.remove("active");
      wlBtn.style.opacity = "0.5";
      wlBtn.style.cursor = "not-allowed";
      wlBtn.textContent = "💡 화면 켜짐 유지 (미지원)";
      wlBtn.title = "이 브라우저에서는 화면 꺼짐 방지(Wake Lock API) 기능을 지원하지 않습니다.";
      state.playback.wakeLockEnabled = false;
    }
  }
}

document.addEventListener('visibilitychange', async () => {
  if (document.visibilityState === 'visible') {
    if (state.playback.isPlaying && state.playback.wakeLockEnabled) {
      await requestWakeLock();
    }
  } else {
    wakeLock = null;
  }
});

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
