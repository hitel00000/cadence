/* ==========================================================================
   Cadence - Key Chips Transposition UI Selector Component
   ========================================================================== */

import { dom } from './dom.js';
import { state } from '../core/state.js';
import { applyPatternChange } from '../core/song.js';

export function renderKeyChips() {
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
