/* ==========================================================================
   Cadence - Chord Picker Modal UI Component
   ========================================================================== */

import { dom } from './dom.js';
import { state } from '../core/state.js';
import { getDisplayString } from '../chordDb.js';
import { drawChordDiagram } from './diagram.js';

const ROOTS = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];
const QUALITIES = [
  { value: "major", label: "Major" },
  { value: "minor", label: "Minor" },
  { value: "dim", label: "dim" },
  { value: "aug", label: "aug" }
];
const TENSIONS = [
  { value: "", label: "—" },
  { value: "sus2", label: "sus2" },
  { value: "sus4", label: "sus4" },
  { value: "7", label: "7" },
  { value: "maj7", label: "maj7" }
];
const EXTENSIONS = [
  { value: "", label: "—" },
  { value: "9", label: "9" },
  { value: "add9", label: "add9" },
  { value: "11", label: "11" },
  { value: "add11", label: "add11" },
  { value: "13", label: "13" }
];

let callbacks = {};
let showBassNoteAccordion = false;

/**
 * Initialize Chord Picker Modal.
 * 
 * @param {Object} cb - Callbacks from app.js
 * @param {Function} cb.getEditingSlot
 * @param {Function} cb.updateEditingSlot
 * @param {Function} cb.previewEditingChord
 * @param {Function} cb.toggleContinueSlot
 * @param {Function} cb.clearEditingChord
 * @param {Function} cb.renderEditor
 */
export function initChordPicker(cb) {
  callbacks = cb;
  
  // Modal Picker actions
  if (dom.closeModalBtn) dom.closeModalBtn.addEventListener("click", closePicker);
  if (dom.modalOverlay) dom.modalOverlay.addEventListener("click", closePicker);
  
  if (dom.previewSoundBtn) dom.previewSoundBtn.addEventListener("click", () => {
    if (callbacks.previewEditingChord) callbacks.previewEditingChord();
  });
  if (dom.continueToggleBtn) dom.continueToggleBtn.addEventListener("click", () => {
    if (callbacks.toggleContinueSlot) callbacks.toggleContinueSlot();
  });
  if (dom.clearChordBtn) dom.clearChordBtn.addEventListener("click", () => {
    if (callbacks.clearEditingChord) callbacks.clearEditingChord();
  });
  if (dom.confirmChordBtn) dom.confirmChordBtn.addEventListener("click", closePicker);
  
  // Bass accordion toggle
  if (dom.bassAccordionHeader) {
    dom.bassAccordionHeader.addEventListener("click", () => {
      showBassNoteAccordion = !showBassNoteAccordion;
      renderPicker();
    });
  }
}

export function openPicker() {
  if (dom.modalOverlay) dom.modalOverlay.classList.add("open");
  if (dom.modalSheet) dom.modalSheet.classList.add("open");
  renderPicker();
}

export function closePicker() {
  if (dom.modalOverlay) dom.modalOverlay.classList.remove("open");
  if (dom.modalSheet) dom.modalSheet.classList.remove("open");
  state.editing = null;
  if (callbacks.renderEditor) callbacks.renderEditor();
}

export function renderPicker() {
  if (!state.editing || !callbacks.getEditingSlot) return;
  const slot = callbacks.getEditingSlot();
  if (!slot) return;
  
  // Update Header text
  const chordName = getDisplayString(slot);
  if (dom.modalChordName) dom.modalChordName.textContent = chordName;
  
  if (dom.modalChordSub) {
    if (slot.isContinue) {
      dom.modalChordSub.textContent = "이전 코드를 한 번 더 연주합니다 (반복).";
    } else {
      dom.modalChordSub.textContent = slot.root ? "기타 지판을 누르는 방법을 확인하세요." : "지판을 선택하여 화음을 구성해 보세요.";
    }
  }
  
  if (dom.continueToggleBtn) {
    if (slot.isContinue) {
      dom.continueToggleBtn.classList.add("active");
    } else {
      dom.continueToggleBtn.classList.remove("active");
    }
  }
  
  // Show / Hide Clear button
  if (dom.clearChordBtn) {
    if (slot.isContinue) {
      dom.clearChordBtn.style.display = "none";
    } else {
      dom.clearChordBtn.style.display = "block";
    }
  }
  
  // Render subgrids
  if (dom.pickerRoots) {
    renderButtonGrid(dom.pickerRoots, ROOTS, slot.root, "root", (val) => {
      if (callbacks.updateEditingSlot) callbacks.updateEditingSlot({ root: val, isContinue: false });
    }, slot.isContinue);
  }
  
  if (dom.pickerQualities) {
    renderButtonGrid(dom.pickerQualities, QUALITIES, slot.quality, "quality", (val) => {
      if (callbacks.updateEditingSlot) callbacks.updateEditingSlot({ quality: val });
    }, slot.isContinue || !slot.root);
  }
  
  if (dom.pickerTensions) {
    renderButtonGrid(dom.pickerTensions, TENSIONS, slot.tension, "tension", (val) => {
      if (callbacks.updateEditingSlot) callbacks.updateEditingSlot({ tension: val });
    }, slot.isContinue || !slot.root);
  }
  
  if (dom.pickerExtensions) {
    renderButtonGrid(dom.pickerExtensions, EXTENSIONS, slot.extension, "extension", (val) => {
      if (callbacks.updateEditingSlot) callbacks.updateEditingSlot({ extension: val });
    }, slot.isContinue || !slot.root);
  }
  
  // Render Bass Note accordion
  if (dom.bassAccordionContent && dom.bassAccordionIcon && dom.bassNoteList) {
    if (showBassNoteAccordion) {
      dom.bassAccordionContent.style.display = "block";
      dom.bassAccordionIcon.textContent = "▲";
      
      // Render bass note buttons
      dom.bassNoteList.innerHTML = "";
      
      // None option button
      const noneBtn = document.createElement("button");
      noneBtn.className = `picker-btn ${!slot.bassNote ? "active" : ""}`;
      noneBtn.setAttribute("data-testid", "bass-none");
      noneBtn.textContent = "—";
      noneBtn.disabled = slot.isContinue || !slot.root;
      noneBtn.addEventListener("click", () => {
        if (callbacks.updateEditingSlot) callbacks.updateEditingSlot({ bassNote: null });
      });
      dom.bassNoteList.appendChild(noneBtn);
      
      // Map roots
      ROOTS.forEach(root => {
        const btn = document.createElement("button");
        btn.className = `picker-btn font-mono ${slot.bassNote === root ? "active" : ""}`;
        btn.setAttribute("data-testid", `bass-${root}`);
        btn.textContent = root;
        btn.disabled = slot.isContinue || !slot.root;
        btn.addEventListener("click", () => {
          if (callbacks.updateEditingSlot) callbacks.updateEditingSlot({ bassNote: root });
        });
        dom.bassNoteList.appendChild(btn);
      });
    } else {
      dom.bassAccordionContent.style.display = "none";
      dom.bassAccordionIcon.textContent = "▼";
    }
  }
  
  // Draw Fretboard SVG
  drawChordDiagram(slot);
}

function renderButtonGrid(container, list, activeValue, type, onSelect, isDisabled) {
  container.innerHTML = "";
  
  list.forEach(item => {
    const val = typeof item === "string" ? item : item.value;
    const label = typeof item === "string" ? item : item.label;
    
    const btn = document.createElement("button");
    
    let btnClass = "picker-btn";
    if (type === "root") btnClass += " font-mono";
    if (type === "tension" || type === "extension") btnClass += " px-pad";
    if (activeValue === val) btnClass += " active";
    
    btn.className = btnClass;
    btn.setAttribute("data-testid", `${type}-${val || "none"}`);
    btn.textContent = label;
    btn.disabled = isDisabled;
    btn.addEventListener("click", () => onSelect(val));
    
    container.appendChild(btn);
  });
}

export function isPickerOpen() {
  return dom.modalOverlay && dom.modalOverlay.classList.contains("open");
}
