/* ==========================================================================
   Cadence - Main Application Controller
   ========================================================================== */

import { 
  createEmptySlot, 
  createContinueSlot, 
  getDisplayString, 
  resolveChordShape 
} from './chordDb.js';
import { 
  previewChord, 
  startSequencer, 
  stopSequencer, 
  seekSequencer, 
  isSequencerPlaying 
} from './audio.js';

// SVG Icons markup
const ICONS = {
  play: `<svg width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24" stroke-linecap="round" stroke-linejoin="round"><polygon points="5 3 19 12 5 21 5 3"></polygon></svg>`,
  pause: `<svg width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24" stroke-linecap="round" stroke-linejoin="round"><rect x="6" y="4" width="4" height="16"></rect><rect x="14" y="4" width="4" height="16"></rect></svg>`,
  stop: `<svg width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24" stroke-linecap="round" stroke-linejoin="round"><rect x="4" y="4" width="16" height="16" rx="2"></rect></svg>`,
  loop: `<svg width="15" height="15" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24" stroke-linecap="round" stroke-linejoin="round"><path d="m17 2 4 4-4 4"></path><path d="M3 11v-1a4 4 0 0 1 4-4h14"></path><path d="m7 22-4-4 4-4"></path><path d="M21 13v1a4 4 0 0 1-4 4H3"></path></svg>`,
  trash: `<svg width="13" height="13" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18"></path><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"></path><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"></path><line x1="10" x2="10" y1="11" y2="17"></line><line x1="14" x2="14" y1="11" y2="17"></line></svg>`,
  plus: `<svg width="15" height="15" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24" stroke-linecap="round" stroke-linejoin="round"><line x1="12" x2="12" y1="5" y2="19"></line><line x1="5" x2="19" y1="12" y2="12"></line></svg>`,
  seekFirst: `<svg width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24" stroke-linecap="round" stroke-linejoin="round"><polygon points="19 20 9 12 19 4 19 20"></polygon><line x1="5" x2="5" y1="19" y2="5"></line></svg>`,
  seekLast: `<svg width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24" stroke-linecap="round" stroke-linejoin="round"><polygon points="5 4 15 12 5 20 5 4"></polygon><line x1="19" x2="19" y1="5" y2="19"></line></svg>`,
  seekPrev: `<svg width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24" stroke-linecap="round" stroke-linejoin="round"><polyline points="15 18 9 12 15 6"></polyline></svg>`,
  seekNext: `<svg width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 18 15 12 9 6"></polyline></svg>`,
  close: `<svg width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24" stroke-linecap="round" stroke-linejoin="round"><line x1="18" x2="6" y1="6" y2="18"></line><line x1="6" x2="18" y1="6" y2="18"></line></svg>`,
  music: `<svg width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24" stroke-linecap="round" stroke-linejoin="round"><path d="M9 18V5l12-2v13"></path><circle cx="6" cy="18" r="3"></circle><circle cx="18" cy="16" r="3"></circle></svg>`
};

// Constant display tables
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
const STROKE_TEXT = { strong: "Strong", soft: "Soft", arpeggio: "Arpeggio" };
const STROKE_SYMBOL = { strong: "↓↓", soft: "↕↕", arpeggio: "~" };

// Global Application State
let state = {
  song: null,
  playback: {
    isPlaying: false,
    currentSlot: 0
  },
  editing: null // { sectionIndex, barIndex, slotIndex }
};

let showBassNoteAccordion = false;

// DOM Cache
const dom = {
  sectionCount: null,
  autoSavedText: null,
  bpmInput: null,
  bpmDown: null,
  bpmUp: null,
  strokeSelector: null,
  loopToggle: null,
  seekFirst: null,
  seekPrev: null,
  playPause: null,
  stop: null,
  seekNext: null,
  seekLast: null,
  positionDisplay: null,
  progressionEditor: null,
  modalOverlay: null,
  modalSheet: null,
  modalChordName: null,
  modalChordSub: null,
  previewSoundBtn: null,
  closeModalBtn: null,
  continueToggleBtn: null,
  pickerRoots: null,
  pickerQualities: null,
  pickerTensions: null,
  pickerExtensions: null,
  bassAccordionHeader: null,
  bassAccordionContent: null,
  bassAccordionIcon: null,
  bassNoteList: null,
  diagramBox: null,
  clearChordBtn: null,
  confirmChordBtn: null
};

// Initialize Application
document.addEventListener("DOMContentLoaded", () => {
  cacheDOMElements();
  loadSong();
  renderHeader();
  renderToolbar();
  renderEditor();
  bindEvents();
});

// Cache DOM references
function cacheDOMElements() {
  dom.sectionCount = document.querySelector("[data-testid='section-count']");
  dom.autoSavedText = document.querySelector(".status-container span:last-child");
  
  dom.bpmInput = document.querySelector("[data-testid='bpm-input']");
  dom.bpmDown = document.querySelector("[data-testid='bpm-down']");
  dom.bpmUp = document.querySelector("[data-testid='bpm-up']");
  dom.strokeSelector = document.querySelector("[data-testid='stroke-selector']");
  dom.loopToggle = document.querySelector("[data-testid='loop-toggle']");
  
  dom.seekFirst = document.querySelector("[data-testid='seek-first']");
  dom.seekPrev = document.querySelector("[data-testid='seek-prev']");
  dom.playPause = document.querySelector("[data-testid='play-pause']");
  dom.stop = document.querySelector("[data-testid='stop']");
  dom.seekNext = document.querySelector("[data-testid='seek-next']");
  dom.seekLast = document.querySelector("[data-testid='seek-last']");
  dom.positionDisplay = document.querySelector("[data-testid='position-display']");
  
  dom.progressionEditor = document.querySelector("[data-testid='progression-editor']");
  
  // Picker modal elements
  dom.modalOverlay = document.getElementById("modal-overlay");
  dom.modalSheet = document.getElementById("modal-sheet");
  dom.modalChordName = document.getElementById("modal-chord-name");
  dom.modalChordSub = document.getElementById("modal-chord-sub");
  dom.previewSoundBtn = document.getElementById("preview-sound-btn");
  dom.closeModalBtn = document.getElementById("close-modal-btn");
  dom.continueToggleBtn = document.getElementById("continue-toggle-btn");
  
  dom.pickerRoots = document.getElementById("picker-roots");
  dom.pickerQualities = document.getElementById("picker-qualities");
  dom.pickerTensions = document.getElementById("picker-tensions");
  dom.pickerExtensions = document.getElementById("picker-extensions");
  
  dom.bassAccordionHeader = document.getElementById("bass-accordion-header");
  dom.bassAccordionContent = document.getElementById("bass-accordion-content");
  dom.bassAccordionIcon = document.getElementById("bass-accordion-icon");
  dom.bassNoteList = document.getElementById("bass-note-list");
  
  dom.diagramBox = document.getElementById("diagram-box");
  
  dom.clearChordBtn = document.getElementById("clear-chord-btn");
  dom.confirmChordBtn = document.getElementById("confirm-chord-btn");
  
  // Set icons
  dom.seekFirst.innerHTML = ICONS.seekFirst;
  dom.seekPrev.innerHTML = ICONS.seekPrev;
  dom.playPause.innerHTML = ICONS.play;
  dom.stop.innerHTML = ICONS.stop;
  dom.seekNext.innerHTML = ICONS.seekNext;
  dom.seekLast.innerHTML = ICONS.seekLast;
  dom.loopToggle.innerHTML = ICONS.loop;
  dom.previewSoundBtn.innerHTML = ICONS.music;
  dom.closeModalBtn.innerHTML = ICONS.close;
}

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
  try {
    const saved = localStorage.getItem("cadence_song");
    if (saved) {
      state.song = JSON.parse(saved);
      // Validate structure roughly
      if (!state.song.sections || state.song.sections.length === 0) {
        state.song = createDefaultSong();
      }
    } else {
      state.song = createDefaultSong();
    }
  } catch (e) {
    console.error("Failed to load song from localStorage:", e);
    state.song = createDefaultSong();
  }
}

function saveSong() {
  try {
    localStorage.setItem("cadence_song", JSON.stringify(state.song));
    
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

function renderToolbar() {
  dom.bpmInput.value = state.song.bpm;
  
  const strokeSymbol = STROKE_SYMBOL[state.song.stroke] || "~";
  const strokeText = STROKE_TEXT[state.song.stroke] || "Arpeggio";
  dom.strokeSelector.querySelector(".stroke-symbol").textContent = strokeSymbol;
  dom.strokeSelector.querySelector(".stroke-text").textContent = strokeText;
  dom.strokeSelector.title = `Stroke: ${strokeText}`;
  
  if (state.song.loop) {
    dom.loopToggle.classList.add("active");
  } else {
    dom.loopToggle.classList.remove("active");
  }
  
  updatePositionDisplay();
}

function updatePositionDisplay() {
  const currentSlot = state.playback.currentSlot;
  const currentBar = Math.floor(currentSlot / 2);
  const totalBars = state.song.sections.length * 4;
  dom.positionDisplay.textContent = `${currentBar + 1}/${totalBars}`;
}

function renderEditor() {
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

// ─── Chord Picker Modal Logic ───

function openPicker() {
  dom.modalOverlay.classList.add("open");
  dom.modalSheet.classList.add("open");
  renderPicker();
}

function closePicker() {
  dom.modalOverlay.classList.remove("open");
  dom.modalSheet.classList.remove("open");
  state.editing = null;
  // Re-render editor to clear editing border rings
  renderEditor();
}

function renderPicker() {
  if (!state.editing) return;
  const slot = getEditingSlot();
  
  // Update Header text
  const chordName = getDisplayString(slot);
  dom.modalChordName.textContent = chordName;
  
  if (slot.isContinue) {
    dom.modalChordSub.textContent = "이전 코드 소리를 길게 이어 연주합니다.";
    dom.continueToggleBtn.classList.add("active");
  } else {
    dom.modalChordSub.textContent = slot.root ? "기타 지판을 누르는 방법을 확인하세요." : "지판을 선택하여 화음을 구성해 보세요.";
    dom.continueToggleBtn.classList.remove("active");
  }
  
  // Show / Hide Clear button
  if (slot.isContinue) {
    dom.clearChordBtn.style.display = "none";
  } else {
    dom.clearChordBtn.style.display = "block";
  }
  
  // Render subgrids
  renderButtonGrid(dom.pickerRoots, ROOTS, slot.root, "root", (val) => {
    updateEditingSlot({ root: val, isContinue: false });
  }, slot.isContinue);
  
  renderButtonGrid(dom.pickerQualities, QUALITIES, slot.quality, "quality", (val) => {
    updateEditingSlot({ quality: val });
  }, slot.isContinue || !slot.root);
  
  renderButtonGrid(dom.pickerTensions, TENSIONS, slot.tension, "tension", (val) => {
    updateEditingSlot({ tension: val });
  }, slot.isContinue || !slot.root);
  
  renderButtonGrid(dom.pickerExtensions, EXTENSIONS, slot.extension, "extension", (val) => {
    updateEditingSlot({ extension: val });
  }, slot.isContinue || !slot.root);
  
  // Render Bass Note accordion
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
      updateEditingSlot({ bassNote: null });
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
        updateEditingSlot({ bassNote: root });
      });
      dom.bassNoteList.appendChild(btn);
    });
  } else {
    dom.bassAccordionContent.style.display = "none";
    dom.bassAccordionIcon.textContent = "▼";
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

// Draw fretboard diagram helper inside modal dialog
function drawChordDiagram(chord) {
  const container = dom.diagramBox;
  container.innerHTML = "";
  
  if (!chord || !chord.root || chord.isContinue) {
    container.innerHTML = `<div class="flex items-center justify-center text-muted-foreground text-xs" style="width: 160px; height: 176px;">No diagram</div>`;
    return;
  }
  
  const shape = resolveChordShape(chord);
  if (!shape) {
    container.innerHTML = `<div class="flex items-center justify-center text-muted-foreground text-xs" style="width: 160px; height: 176px;">No diagram</div>`;
    return;
  }
  
  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  svg.setAttribute("width", "160");
  svg.setAttribute("height", "176");
  svg.setAttribute("viewBox", "0 0 160 176");
  svg.setAttribute("class", "diagram-svg-box");
  
  const width = 160;
  const height = 176;
  const topPad = width * 0.2;
  const leftPad = width * 0.1;
  const rightPad = width * 0.1;
  const bottomPad = width * 0.08;
  
  const gridW = width - leftPad - rightPad;
  const gridH = height - topPad - bottomPad;
  
  const stringsCount = 6;
  const fretsCount = 5;
  
  const stepX = gridW / (stringsCount - 1);
  const stepY = gridH / fretsCount;
  const dotRadius = stepX * 0.28;
  
  const baseFret = shape.baseFret ?? 1;
  const barre = shape.barre;
  const frets = shape.frets;
  
  const activeFrets = frets.filter(f => f > 0);
  const minFret = barre ?? (activeFrets.length ? Math.min(...activeFrets) : 1);
  const displayBaseFret = Math.max(1, minFret <= 4 ? 1 : minFret);
  
  const gridTop = topPad;
  
  let html = `<rect width="${width}" height="${height}" fill="transparent"></rect>`;
  
  // Nut line (if baseFret is 1)
  if (baseFret <= 1 || displayBaseFret <= 1) {
    html += `<line x1="${leftPad - 2}" y1="${gridTop}" x2="${leftPad + gridW + 2}" y2="${gridTop}" stroke="currentColor" stroke-width="4" stroke-linecap="round"></line>`;
  } else {
    // Label base fret e.g. "3fr"
    html += `<text x="${leftPad - 8}" y="${gridTop + stepY/2 + 4}" font-size="${width * 0.08}" fill="currentColor" text-anchor="end" opacity="0.7">${displayBaseFret}fr</text>`;
  }
  
  // Fret lines
  for (let i = 0; i < fretsCount; i++) {
    const y = gridTop + (i + 1) * stepY;
    html += `<line x1="${leftPad}" y1="${y}" x2="${leftPad + gridW}" y2="${y}" stroke="currentColor" stroke-width="0.8" opacity="0.4"></line>`;
  }
  
  // String lines
  for (let i = 0; i < stringsCount; i++) {
    const x = leftPad + i * stepX;
    const strokeW = [2.2, 1.8, 1.4, 1.1, 0.9, 0.7][i];
    html += `<line x1="${x}" y1="${gridTop}" x2="${x}" y2="${gridTop + gridH}" stroke="currentColor" stroke-width="${strokeW}" opacity="0.5"></line>`;
  }
  
  // Barre chord indicator
  if (barre !== undefined) {
    const relativeFret = barre - displayBaseFret + 1;
    if (relativeFret >= 1 && relativeFret <= fretsCount) {
      const firstActiveString = frets.indexOf(-1) >= 0 ? frets.findIndex(f => f >= 0) : 0;
      const xStart = leftPad + firstActiveString * stepX;
      const xEnd = leftPad + (stringsCount - 1) * stepX;
      const y = gridTop + relativeFret * stepY - stepY / 2;
      
      html += `<rect x="${xStart - dotRadius * 0.7}" y="${y - dotRadius * 0.9}" width="${xEnd - xStart + dotRadius * 1.4}" height="${dotRadius * 1.8}" rx="${dotRadius * 0.9}" fill="var(--primary)" opacity="0.9"></rect>`;
    }
  }
  
  // Fingers, opens and mutes
  frets.forEach((fret, stringIdx) => {
    const x = leftPad + stringIdx * stepX;
    const yTop = gridTop - stepY * 0.45;
    
    if (fret === -1) {
      const size = dotRadius * 0.55;
      html += `<g opacity="0.7">
        <line x1="${x - size}" y1="${yTop - size}" x2="${x + size}" y2="${yTop + size}" stroke="currentColor" stroke-width="1.5"></line>
        <line x1="${x + size}" y1="${yTop - size}" x2="${x - size}" y2="${yTop + size}" stroke="currentColor" stroke-width="1.5"></line>
      </g>`;
    } else if (fret === 0) {
      html += `<circle cx="${x}" cy="${yTop}" r="${dotRadius * 0.75}" fill="none" stroke="currentColor" stroke-width="1.5" opacity="0.8"></circle>`;
    } else {
      const relativeFret = fret - displayBaseFret + 1;
      if (relativeFret >= 1 && relativeFret <= fretsCount) {
        if (barre !== undefined && fret === barre) return;
        const y = gridTop + relativeFret * stepY - stepY / 2;
        html += `<circle cx="${x}" cy="${y}" r="${dotRadius}" fill="var(--primary)"></circle>`;
      }
    }
  });
  
  svg.innerHTML = html;
  container.appendChild(svg);
}

// ─── Actions & Callbacks ───

function selectSlot(sIdx, bIdx, slIdx) {
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
      previewChord(slot, state.song.stroke);
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

function previewEditingChord() {
  const slot = getEditingSlot();
  if (slot && slot.root && !slot.isContinue) {
    previewChord(slot, state.song.stroke);
  }
}

function clearEditingChord() {
  updateEditingSlot(createEmptySlot());
  closePicker();
}

function addSection() {
  const newSection = {
    bars: Array.from({ length: 4 }, () => ({
      slots: [createEmptySlot(), createEmptySlot()]
    }))
  };
  
  state.song.sections.push(newSection);
  saveSong();
  renderHeader();
  renderEditor();
  
  // Scroll to bottom
  setTimeout(() => {
    dom.progressionEditor.scrollTop = dom.progressionEditor.scrollHeight;
  }, 100);
}

function removeSection(sIdx) {
  if (state.song.sections.length <= 1) return;
  
  state.song.sections.splice(sIdx, 1);
  
  // Handle editor focus safety
  if (state.editing && state.editing.sectionIndex === sIdx) {
    state.editing = null;
    closePicker();
  } else if (state.editing && state.editing.sectionIndex > sIdx) {
    state.editing.sectionIndex--;
  }
  
  saveSong();
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
  
  startSequencer({
    bpm: state.song.bpm,
    stroke: state.song.stroke,
    loop: state.song.loop,
    totalSlots: totalSlots,
    getSlot: (idx) => getSlotByAbsoluteIndex(idx),
    onBeat: (idx) => {
      updatePlayheadDOM(idx);
    },
    onEnd: () => {
      // Loop finished, reset playhead
      state.playback.isPlaying = false;
      state.playback.currentSlot = 0;
      dom.playPause.innerHTML = ICONS.play;
      dom.playPause.classList.remove("playing");
      dom.playPause.classList.add("paused");
      updatePlayheadDOM(0);
    }
  });
  
  // Seek sequencer to current selection
  seekSequencer(state.playback.currentSlot);
}

function pausePlayback() {
  if (!state.playback.isPlaying) return;
  
  state.playback.isPlaying = false;
  dom.playPause.innerHTML = ICONS.play;
  dom.playPause.classList.remove("playing");
  dom.playPause.classList.add("paused");
  stopSequencer();
}

function stopPlayback() {
  state.playback.isPlaying = false;
  state.playback.currentSlot = 0;
  dom.playPause.innerHTML = ICONS.play;
  dom.playPause.classList.remove("playing");
  dom.playPause.classList.add("paused");
  stopSequencer();
  updatePlayheadDOM(0);
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
  // BPM Inputs
  dom.bpmInput.addEventListener("change", (e) => {
    let bpm = parseInt(e.target.value) || 120;
    bpm = Math.max(40, Math.min(240, bpm));
    state.song.bpm = bpm;
    dom.bpmInput.value = bpm;
    saveSong();
    
    // If playing, restart sequencer to apply BPM change immediately
    if (state.playback.isPlaying) {
      stopSequencer();
      startPlayback();
    }
  });
  
  dom.bpmDown.addEventListener("click", () => {
    state.song.bpm = Math.max(40, state.song.bpm - 1);
    dom.bpmInput.value = state.song.bpm;
    saveSong();
    if (state.playback.isPlaying) {
      stopSequencer();
      startPlayback();
    }
  });
  
  dom.bpmUp.addEventListener("click", () => {
    state.song.bpm = Math.min(240, state.song.bpm + 1);
    dom.bpmInput.value = state.song.bpm;
    saveSong();
    if (state.playback.isPlaying) {
      stopSequencer();
      startPlayback();
    }
  });
  
  // Prevent button focus grabbing on click
  dom.bpmDown.addEventListener("pointerdown", e => e.preventDefault());
  dom.bpmUp.addEventListener("pointerdown", e => e.preventDefault());
  
  // Stroke Selector
  dom.strokeSelector.addEventListener("click", () => {
    const list = ["strong", "soft", "arpeggio"];
    const idx = list.indexOf(state.song.stroke);
    state.song.stroke = list[(idx + 1) % 3];
    saveSong();
    renderToolbar();
    
    // Restart if playing
    if (state.playback.isPlaying) {
      stopSequencer();
      startPlayback();
    }
  });
  
  // Loop Toggle
  dom.loopToggle.addEventListener("click", () => {
    state.song.loop = !state.song.loop;
    saveSong();
    renderToolbar();
    
    // Restart if playing
    if (state.playback.isPlaying) {
      stopSequencer();
      startPlayback();
    }
  });
  
  // Sequencer control actions
  dom.playPause.addEventListener("click", togglePlayback);
  dom.stop.addEventListener("click", stopPlayback);
  dom.seekFirst.addEventListener("click", seekFirst);
  dom.seekPrev.addEventListener("click", seekPrev);
  dom.seekNext.addEventListener("click", seekNext);
  dom.seekLast.addEventListener("click", seekLast);
  
  // Modal Picker actions
  dom.closeModalBtn.addEventListener("click", closePicker);
  dom.modalOverlay.addEventListener("click", closePicker);
  
  dom.previewSoundBtn.addEventListener("click", previewEditingChord);
  dom.continueToggleBtn.addEventListener("click", toggleContinueSlot);
  dom.clearChordBtn.addEventListener("click", clearEditingChord);
  dom.confirmChordBtn.addEventListener("click", closePicker);
  
  // Bass accordion toggle
  dom.bassAccordionHeader.addEventListener("click", () => {
    showBassNoteAccordion = !showBassNoteAccordion;
    renderPicker();
  });
  
  // Keyboard Shortcuts (Spacebar = Play/Pause, Esc = Stop)
  window.addEventListener("keydown", (e) => {
    if (e.target.tagName === "INPUT" || e.target.tagName === "BUTTON") {
      return; // Skip shortcuts when typing/focussed
    }
    
    if (e.code === "Space") {
      e.preventDefault();
      togglePlayback();
    } else if (e.code === "Escape") {
      e.preventDefault();
      if (dom.modalOverlay.classList.contains("open")) {
        closePicker();
      } else {
        stopPlayback();
      }
    }
  });
}
