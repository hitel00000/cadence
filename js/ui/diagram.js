/* ==========================================================================
   Cadence - Guitar Fretboard Fingering Diagram SVG Renderer
   ========================================================================== */

import { resolveChordShape } from '../chordDb.js';
import { dom } from './dom.js';

/**
 * Draw SVG guitar chord fingering diagram.
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
