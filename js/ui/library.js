/* ==========================================================================
   Cadence - Pattern Library Drawer UI Component
   ========================================================================== */

import { dom } from './dom.js';
import { state } from '../core/state.js';

let callbacks = {};

/**
 * Initialize library drawer event listeners and callbacks.
 * 
 * @param {Object} cb - Callback functions
 * @param {Function} cb.loadSong
 * @param {Function} cb.stopSequencer
 * @param {Function} cb.startPlayback
 * @param {Function} cb.renderToolbar
 * @param {Function} cb.renderEditor
 * @param {Function} cb.renderKeyChips
 * @param {Function} cb.applyPatternChange
 */
export function initLibraryDrawer(cb) {
  callbacks = cb;
  
  // Open/Close Library Drawer
  if (dom.openLibraryBtn) {
    dom.openLibraryBtn.addEventListener("click", openLibraryDrawer);
  }
  if (dom.closeDrawerBtn) {
    dom.closeDrawerBtn.addEventListener("click", () => closeLibraryDrawer());
  }
  if (dom.drawerBackdrop) {
    dom.drawerBackdrop.addEventListener("click", () => closeLibraryDrawer());
  }
  
  // Search in library drawer
  if (dom.librarySearch) {
    dom.librarySearch.addEventListener("input", (e) => {
      state.searchQuery = e.target.value;
      renderPatternList();
    });
  }
}

export async function loadPatterns() {
  try {
    const response = await fetch('./static/books/guitar-chord-recipes.json');
    if (response.ok) {
      const book = await response.json();
      state.books = [book];
      if (callbacks.renderKeyChips) callbacks.renderKeyChips();
    }
  } catch (e) {
    console.error("Failed to load static books:", e);
  }
}

export function openLibraryDrawer() {
  if (dom.libraryDrawer) {
    dom.libraryDrawer.classList.add("open");
    renderLibraryDrawer();
  }
}

export function closeLibraryDrawer() {
  if (dom.libraryDrawer) {
    dom.libraryDrawer.classList.remove("open");
  }
}

export function renderLibraryDrawer() {
  if (!dom.categoryChips) return;
  
  const categories = ["all"];
  state.books.forEach(book => {
    book.patterns.forEach(p => {
      if (p.category && !categories.includes(p.category)) {
        categories.push(p.category);
      }
    });
  });
  
  dom.categoryChips.innerHTML = "";
  categories.forEach(cat => {
    const chip = document.createElement("button");
    chip.className = `filter-chip${state.selectedCategory === cat ? " active" : ""}`;
    chip.textContent = cat === "all" ? "전체" : cat;
    
    chip.addEventListener("click", () => {
      state.selectedCategory = cat;
      renderLibraryDrawer();
    });
    
    dom.categoryChips.appendChild(chip);
  });
  
  renderPatternList();
}

export function renderPatternList() {
  if (!dom.libraryPatternList) return;
  
  dom.libraryPatternList.innerHTML = "";
  let count = 0;
  
  // Custom Song Option
  if (state.selectedCategory === "all" && !state.searchQuery) {
    const customCard = document.createElement("div");
    customCard.className = "pattern-card";
    customCard.style.borderStyle = "dashed";
    customCard.style.borderColor = "var(--primary-border)";
    customCard.innerHTML = `
      <div class="pattern-card-header">
        <span class="pattern-card-title" style="color: var(--primary);">✏️ 내 자유 연주곡 (자유 입력)</span>
        <div class="pattern-card-meta">
          <span class="meta-badge" style="background-color: var(--primary-glow); color: var(--primary);">로컬 저장</span>
        </div>
      </div>
      <div class="pattern-card-chords">직접 코드를 마디별로 입력하고 편집하여 나만의 진행을 만듭니다.</div>
    `;
    customCard.addEventListener("click", () => {
      state.currentPattern = null;
      state.currentKey = "C";
      
      if (dom.currentPatternTitle) {
        dom.currentPatternTitle.textContent = "자유 연주곡";
      }
      
      closeLibraryDrawer();
      if (callbacks.loadSong) callbacks.loadSong();
      
      if (dom.bpmInput && state.song) {
        dom.bpmInput.value = state.song.bpm;
      }
      
      if (state.playback.isPlaying) {
        if (callbacks.stopSequencer) callbacks.stopSequencer();
        if (callbacks.startPlayback) callbacks.startPlayback();
      }
      
      if (callbacks.renderToolbar) callbacks.renderToolbar();
      if (callbacks.renderEditor) callbacks.renderEditor();
      if (callbacks.renderKeyChips) callbacks.renderKeyChips();
    });
    dom.libraryPatternList.appendChild(customCard);
  }
  
  state.books.forEach(book => {
    book.patterns.forEach(pattern => {
      if (state.selectedCategory !== "all" && pattern.category !== state.selectedCategory) {
        return;
      }
      
      if (state.searchQuery) {
        const query = state.searchQuery.toLowerCase();
        const matchesTitle = pattern.title.toLowerCase().includes(query);
        const matchesCategory = pattern.category && pattern.category.toLowerCase().includes(query);
        const matchesChords = pattern.chords.some(c => c.toLowerCase().includes(query));
        if (!matchesTitle && !matchesCategory && !matchesChords) {
          return;
        }
      }
      
      count++;
      const card = document.createElement("div");
      card.className = "pattern-card";
      
      const difficultyClass = `difficulty-${(pattern.difficulty || "Easy").toLowerCase()}`;
      
      card.innerHTML = `
        <div class="pattern-card-header">
          <span class="pattern-card-title">${pattern.title}</span>
          <div class="pattern-card-meta">
            <span class="meta-badge">${pattern.category || "기타"}</span>
            <span class="meta-badge ${difficultyClass}">${pattern.difficulty || "Easy"}</span>
          </div>
        </div>
        <div class="pattern-card-chords">${pattern.chords.join(" → ")}</div>
      `;
      
      card.addEventListener("click", () => {
        state.currentPattern = pattern;
        state.currentKey = pattern.defaultKey || "C";
        
        if (dom.currentPatternTitle) {
          dom.currentPatternTitle.textContent = pattern.title;
        }
        
        closeLibraryDrawer();
        if (callbacks.applyPatternChange) callbacks.applyPatternChange();
        if (callbacks.renderKeyChips) callbacks.renderKeyChips();
      });
      
      dom.libraryPatternList.appendChild(card);
    });
  });
  
  if (count === 0 && (state.selectedCategory !== "all" || state.searchQuery)) {
    dom.libraryPatternList.innerHTML = `<div class="text-center text-muted-foreground text-sm py-4">일치하는 패턴이 없습니다.</div>`;
  }
}
