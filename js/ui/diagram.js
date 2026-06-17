/* ==========================================================================
   Cadence - Guitar Fretboard & Piano Keyboard SVG Diagram Renderer
   ========================================================================== */

import { resolveChordShape, resolveChordNotes } from '../chordDb.js';
import { loadSettings } from '../core/storage.js';
import { dom } from './dom.js';

/**
 * Draw SVG chord fingering diagram dynamically based on active instrument.
 * 
 * @param {Object} chord - Chord definition slot
 * @param {HTMLElement} [customContainer] - Optional target container
 */
export function drawChordDiagram(chord, customContainer) {
  const container = customContainer || dom.diagramBox;
  if (!container) return;
  
  container.innerHTML = "";
  
  if (!chord || !chord.root || chord.isContinue) {
    container.innerHTML = `<div class="flex items-center justify-center text-muted-foreground text-xs" style="width: 160px; height: 176px;">No diagram</div>`;
    return;
  }

  // Detect active instrument setting
  const settings = loadSettings() || { instrument: "guitar" };
  const instrument = settings.instrument || "guitar";

  if (instrument === "piano") {
    drawPianoDiagram(chord, container);
  } else {
    drawGuitarDiagram(chord, container);
  }
}

/**
 * Renders a visual piano keyboard showing pressed keys for chord voicing
 */
function drawPianoDiagram(chord, container) {
  const notes = resolveChordNotes(chord) || [];
  const activeNotes = [...new Set(notes.filter(n => n >= 0))];

  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  svg.setAttribute("width", "160");
  svg.setAttribute("height", "176");
  svg.setAttribute("viewBox", "0 0 160 176");
  svg.setAttribute("class", "diagram-svg-box");

  const width = 160;
  const height = 176;
  const topPad = 32;
  const leftPad = 8;
  const rightPad = 8;
  const bottomPad = 14;

  const gridW = width - leftPad - rightPad;
  const gridH = height - topPad - bottomPad;

  // Cover notes from C3 (48) to E5 (76) - 17 White Keys
  const whiteKeys = [48, 50, 52, 53, 55, 57, 59, 60, 62, 64, 65, 67, 69, 71, 72, 74, 76];
  const blackKeys = [
    { note: 49, leftOf: 50 }, { note: 51, leftOf: 52 },
    { note: 54, leftOf: 55 }, { note: 56, leftOf: 57 }, { note: 58, leftOf: 59 },
    { note: 61, leftOf: 62 }, { note: 63, leftOf: 64 },
    { note: 66, leftOf: 67 }, { note: 68, leftOf: 69 }, { note: 70, leftOf: 71 },
    { note: 73, leftOf: 74 }, { note: 75, leftOf: 76 }
  ];

  const whiteKeyWidth = gridW / whiteKeys.length;
  const blackKeyWidth = whiteKeyWidth * 0.65;
  const blackKeyHeight = gridH * 0.58;

  let html = `<rect width="${width}" height="${height}" fill="transparent"></rect>`;

  // 1. Draw White Keys
  whiteKeys.forEach((note, idx) => {
    const x = leftPad + idx * whiteKeyWidth;
    const isPressed = activeNotes.some(an => an === note || (an % 12 === note % 12));

    html += `<rect x="${x}" y="${topPad}" width="${whiteKeyWidth - 0.8}" height="${gridH}" fill="var(--card)" stroke="currentColor" stroke-width="0.8" opacity="0.9" rx="1.5"></rect>`;

    if (isPressed) {
      html += `<circle cx="${x + whiteKeyWidth / 2 - 0.4}" cy="${topPad + gridH - 12}" r="${whiteKeyWidth * 0.32}" fill="var(--primary)"></circle>`;
    }
  });

  // 2. Draw Black Keys
  blackKeys.forEach((bk) => {
    const leftOfIdx = whiteKeys.indexOf(bk.leftOf);
    if (leftOfIdx === -1) return;

    const x = leftPad + leftOfIdx * whiteKeyWidth - blackKeyWidth / 2;
    const isPressed = activeNotes.some(an => an === bk.note || (an % 12 === bk.note % 12));

    html += `<rect x="${x}" y="${topPad}" width="${blackKeyWidth}" height="${blackKeyHeight}" fill="#09090b" stroke="currentColor" stroke-width="0.5" rx="1"></rect>`;

    if (isPressed) {
      html += `<circle cx="${x + blackKeyWidth / 2}" cy="${topPad + blackKeyHeight - 6}" r="${blackKeyWidth * 0.35}" fill="var(--primary)"></circle>`;
    }
  });

  // 3. Instrument Header
  html += `<text x="${width / 2}" y="14" font-size="8.5" fill="currentColor" text-anchor="middle" font-weight="700" letter-spacing="1.2" opacity="0.4">PIANO KEYBOARD</text>`;

  svg.innerHTML = html;
  container.appendChild(svg);
}

/**
 * Renders original guitar fretboard diagram
 */
function drawGuitarDiagram(chord, container) {
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
  
  // Clone frets array to dynamically apply slash chord bass fingerings on low strings
  const frets = [...shape.frets];
  if (chord.bassNote) {
    const ob = {
      "C": 0, "C#": 1, "Db": 1, "D": 2, "D#": 3, "Eb": 3, "E": 4, "F": 5, 
      "F#": 6, "Gb": 6, "G": 7, "G#": 8, "Ab": 8, "A": 9, "A#": 10, "Bb": 10, "B": 11
    };
    const bassOffset = ob[chord.bassNote];
    if (bassOffset !== undefined) {
      // Mute both low strings first to override with the new bass note fingering
      frets[0] = -1;
      frets[1] = -1;
      
      // 6th string bass notes (E, F, F#, G, G#)
      if (bassOffset >= 4 && bassOffset <= 8) {
        frets[0] = bassOffset - 4;
      } else {
        // 5th string bass notes (A, A#, B, C, C#, D, D#)
        frets[1] = (bassOffset - 9 + 12) % 12;
      }
    }
  }
  
  const activeFrets = frets.filter(f => f > 0);
  const minFret = barre ?? (activeFrets.length ? Math.min(...activeFrets) : 1);
  const displayBaseFret = Math.max(1, minFret <= 4 ? 1 : minFret);
  
  const gridTop = topPad;
  
  let html = `<rect width="${width}" height="${height}" fill="transparent"></rect>`;
  
  // Nut line
  if (baseFret <= 1 || displayBaseFret <= 1) {
    html += `<line x1="${leftPad - 2}" y1="${gridTop}" x2="${leftPad + gridW + 2}" y2="${gridTop}" stroke="currentColor" stroke-width="4" stroke-linecap="round"></line>`;
  } else {
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
  
  // Instrument Header
  html += `<text x="${width / 2}" y="14" font-size="8.5" fill="currentColor" text-anchor="middle" font-weight="700" letter-spacing="1.2" opacity="0.4">GUITAR FRETBOARD</text>`;

  svg.innerHTML = html;
  container.appendChild(svg);
}
