/* ==========================================================================
   Cadence - Centralized DOM Cache Manager
   ========================================================================== */

import { ICONS } from './icons.js';

export const dom = {
  sectionCount: null,
  autoSavedText: null,
  bpmInput: null,
  bpmDown: null,
  bpmUp: null,
  strokeSelector: null,
  instrumentSelector: null,
  keyChips: null,
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
  confirmChordBtn: null,
  
  // New Focus Mode & Library Drawer elements
  modeToggle: null,
  modePractice: null,
  modeEdit: null,
  practiceFocusView: null,
  openLibraryBtn: null,
  currentPatternTitle: null,
  libraryDrawer: null,
  drawerBackdrop: null,
  closeDrawerBtn: null,
  librarySearch: null,
  categoryChips: null,
  libraryPatternList: null
};

export function cacheDOMElements() {
  dom.keyChips = document.getElementById("key-chips");
  dom.sectionCount = document.querySelector("[data-testid='section-count']");
  dom.autoSavedText = document.getElementById("save-status-text");
  
  dom.bpmInput = document.querySelector("[data-testid='bpm-input']");
  dom.bpmDown = document.querySelector("[data-testid='bpm-down']");
  dom.bpmUp = document.querySelector("[data-testid='bpm-up']");
  dom.strokeSelector = document.querySelector("[data-testid='stroke-selector']");
  dom.instrumentSelector = document.querySelector("[data-testid='instrument-selector']");
  dom.loopToggle = document.querySelector("[data-testid='loop-toggle']");
  
  dom.seekFirst = document.querySelector("[data-testid='seek-first']");
  dom.seekPrev = document.querySelector("[data-testid='seek-prev']");
  dom.playPause = document.querySelector("[data-testid='play-pause']");
  dom.stop = document.querySelector("[data-testid='stop']");
  dom.seekNext = document.querySelector("[data-testid='seek-next']");
  dom.seekLast = document.querySelector("[data-testid='seek-last']");
  dom.positionDisplay = document.querySelector("[data-testid='position-display']");
  
  dom.progressionEditor = document.querySelector("[data-testid='progression-editor']");
  
  // New Focus & Drawer caching
  dom.modeToggle = document.getElementById("mode-toggle");
  dom.modePractice = document.getElementById("mode-practice");
  dom.modeEdit = document.getElementById("mode-edit");
  dom.practiceFocusView = document.getElementById("practice-focus-view");
  dom.openLibraryBtn = document.getElementById("open-library-btn");
  dom.currentPatternTitle = document.getElementById("current-pattern-title");
  
  dom.libraryDrawer = document.getElementById("library-drawer");
  dom.drawerBackdrop = document.getElementById("drawer-backdrop");
  dom.closeDrawerBtn = document.getElementById("close-drawer-btn");
  dom.librarySearch = document.getElementById("library-search");
  dom.categoryChips = document.getElementById("category-chips");
  dom.libraryPatternList = document.getElementById("library-pattern-list");
  dom.autoSavedText = document.querySelector(".status-container span:last-child");
  
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
