/* ==========================================================================
   Cadence - Practice Focus View UI Component (with Wake Lock & A-B Loop)
   ========================================================================== */

import { dom } from './dom.js';
import { state } from '../core/state.js';
import { getDisplayString } from '../chordDb.js';
import { drawChordDiagram } from './diagram.js';

let callbacks = {};
let wakeLock = null;

// Local helpers (copied from app.js context to maintain decoupling)
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

function findLastPlayedChordFromEditor(sectionIndex, barIndex, slotIndex) {
  if (!state.song || !state.song.sections) return null;
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

function getNextChordSlot(activeIdx) {
  if (!state.song || !state.song.sections) return null;
  const totalSlots = state.song.sections.length * 8;
  for (let i = 1; i < totalSlots; i++) {
    const nextIdx = (activeIdx + i) % totalSlots;
    const s = getSlotByAbsoluteIndex(nextIdx);
    if (s && !s.isContinue && s.root) {
      return { slot: s, index: nextIdx };
    }
  }
  return null;
}

/**
 * Initialize Practice Focus View.
 * 
 * @param {Object} cb - Callbacks from app.js
 * @param {Function} cb.seekSequencer
 * @param {Function} cb.updatePlayheadDOM
 * @param {Function} cb.stopSequencer
 * @param {Function} cb.startPlayback
 */
export function initPracticeFocusView(cb) {
  callbacks = cb;
  
  // A-B Loop toggle
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
        if (callbacks.stopSequencer) callbacks.stopSequencer();
        state.playback.isPlaying = false;
        if (callbacks.startPlayback) callbacks.startPlayback();
      }
    });
  }
  
  // A-B Loop selectors change
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
        if (callbacks.stopSequencer) callbacks.stopSequencer();
        state.playback.isPlaying = false;
        if (callbacks.startPlayback) callbacks.startPlayback();
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
        if (callbacks.stopSequencer) callbacks.stopSequencer();
        state.playback.isPlaying = false;
        if (callbacks.startPlayback) callbacks.startPlayback();
      }
    });
  }
  
  // Wake Lock Button
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
  
  // Visibility change for Wake Lock recovery
  document.addEventListener('visibilitychange', async () => {
    if (document.visibilityState === 'visible') {
      if (state.playback.isPlaying && state.playback.wakeLockEnabled) {
        await requestWakeLock();
      }
    } else {
      wakeLock = null;
    }
  });
  
  // Support check
  checkWakeLockSupport();
}

export function renderFocusView() {
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
  
  // 1. Render Current Active Chord Card
  const activeChordName = resolvedSlot ? getDisplayString(resolvedSlot) : "—";
  const nameEl = document.getElementById("focus-chord-name");
  const diagramBox = document.getElementById("focus-diagram-container");
  
  if (nameEl) nameEl.textContent = activeChordName;
  if (diagramBox) {
    diagramBox.innerHTML = "";
    if (resolvedSlot && resolvedSlot.root) {
      drawChordDiagram(resolvedSlot, diagramBox);
    }
  }
  
  // 2. Render Next Preview Chord Card
  const nextInfo = getNextChordSlot(activeSlotIdx);
  const nextNameEl = document.getElementById("focus-next-chord-name");
  const nextDiagramBox = document.getElementById("focus-next-diagram-container");
  const nextCard = document.getElementById("focus-next-chord-card");
  
  if (nextInfo) {
    if (nextCard) {
      nextCard.style.opacity = "1";
      nextCard.style.pointerEvents = "auto";
    }
    if (nextNameEl) nextNameEl.textContent = getDisplayString(nextInfo.slot);
    if (nextDiagramBox) {
      nextDiagramBox.innerHTML = "";
      drawChordDiagram(nextInfo.slot, nextDiagramBox);
    }
  } else {
    if (nextCard) {
      nextCard.style.opacity = "0.2";
      nextCard.style.pointerEvents = "none";
    }
    if (nextNameEl) nextNameEl.textContent = "—";
    if (nextDiagramBox) nextDiagramBox.innerHTML = "";
  }
  
  // Highlight active slot & loop range in the timeline
  updateFocusViewActiveSlot(activeSlotIdx);
}

export function updateFocusViewActiveSlot(activeSlotIdx) {
  const slots = document.querySelectorAll(".focus-preview-slot");
  slots.forEach((slotChip, idx) => {
    if (idx === activeSlotIdx) {
      slotChip.classList.add("active");
      // Auto-scroll the active slot into the center of the timeline view (horizontal scroll only)
      const parent = slotChip.parentElement;
      if (parent) {
        const chipLeft = slotChip.offsetLeft;
        const chipWidth = slotChip.offsetWidth;
        const parentWidth = parent.offsetWidth;
        const scrollTarget = chipLeft - (parentWidth / 2) + (chipWidth / 2);
        parent.scrollTo({ left: scrollTarget, behavior: "smooth" });
      }
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

export function rebuildFocusTimeline() {
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
      
      if (callbacks.seekSequencer) callbacks.seekSequencer(idx, loopStartSlot, loopEndSlot);
      if (callbacks.updatePlayheadDOM) callbacks.updatePlayheadDOM(idx);
    });
    
    previewContainer.appendChild(slotChip);
  }
}

export function initLoopABOptions() {
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

export async function requestWakeLock() {
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

export function releaseWakeLock() {
  if (wakeLock !== null) {
    wakeLock.release().then(() => {
      wakeLock = null;
      console.log('Screen Wake Lock released');
    });
  }
}

export function checkWakeLockSupport() {
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
