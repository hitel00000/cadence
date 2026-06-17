/* ==========================================================================
   Cadence - Grid Chord Progression Editor UI Component
   ========================================================================== */

import { dom } from './dom.js';
import { state } from '../core/state.js';
import { getDisplayString, createEmptySlot } from '../chordDb.js';
import { saveSong } from '../core/song.js';
import { ICONS } from './icons.js';
import { closePicker } from './picker.js';
import { renderFocusView, initLoopABOptions, rebuildFocusTimeline } from './practice.js';

let callbacks = {};

/**
 * Initialize progression editor.
 * 
 * @param {Object} cb - Callbacks
 * @param {Function} cb.renderKeyChips
 * @param {Function} cb.selectSlot
 * @param {Function} cb.renderHeader
 */
export function initEditor(cb) {
  callbacks = cb;
}

// Local helper to find last played chord for continue slot visual resolution
function findLastPlayedChordFromEditor(sectionIndex, barIndex, slotIndex) {
  if (!state.song || !state.song.sections) return null;
  const totalSlots = state.song.sections.length * 8;
  const absoluteBarIdx = sectionIndex * 4 + barIndex;
  const absoluteSlotIdx = absoluteBarIdx * 2 + slotIndex;
  
  for (let i = 1; i <= totalSlots; i++) {
    const idx = (absoluteSlotIdx - i + totalSlots) % totalSlots;
    const slot = getSlotByAbsoluteIndex(idx);
    if (slot && !slot.isContinue && slot.root) {
      return slot;
    }
  }
  return null;
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

export function renderEditor() {
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
          if (callbacks.selectSlot) callbacks.selectSlot(sIdx, bIdx, slIdx);
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

export function addSection() {
  if (state.currentPattern) {
    state.currentPattern = null;
    if (dom.currentPatternTitle) dom.currentPatternTitle.textContent = "자유 연주곡";
    if (callbacks.renderKeyChips) callbacks.renderKeyChips();
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
  if (callbacks.renderHeader) callbacks.renderHeader();
  renderEditor();
  
  // Scroll to bottom
  setTimeout(() => {
    if (dom.progressionEditor) {
      dom.progressionEditor.scrollTop = dom.progressionEditor.scrollHeight;
    }
  }, 100);
}

export function removeSection(sIdx) {
  if (state.song.sections.length <= 1) return;
  
  if (state.currentPattern) {
    state.currentPattern = null;
    if (dom.currentPatternTitle) dom.currentPatternTitle.textContent = "자유 연주곡";
    if (callbacks.renderKeyChips) callbacks.renderKeyChips();
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
  if (callbacks.renderHeader) callbacks.renderHeader();
  renderEditor();
}
