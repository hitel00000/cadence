/**
 * Cadence - Pattern to Song Structure Adapter
 */

import { transposePattern } from './transpose.js';
import { createEmptySlot, createContinueSlot } from '../chordDb.js';

/**
 * Parses a chord string (e.g. "Cmaj7/G", "Am", "—") into a standard slot object.
 * 
 * @param {string} chordStr - Chord string to parse
 * @returns {Object} - Slot object compatible with application state
 */
export function parseChordStringToSlot(chordStr) {
  if (!chordStr || chordStr === "—") {
    return createEmptySlot();
  }
  if (chordStr === "↳" || chordStr === "continue") {
    return createContinueSlot();
  }

  // Parse: Root(G1), Suffix(G2), Slash Bass(G3)
  const regex = /^([A-G][#b]?)([^/]*)(?:\/([A-G][#b]?))?$/;
  const match = chordStr.match(regex);
  if (!match) {
    return createEmptySlot();
  }

  const root = match[1];
  let suffix = match[2] || "";
  const bassNote = match[3] || null;

  let quality = "major";
  let tension = "";
  let extension = "";

  // Extract extension at the end of the suffix (e.g. add9, 9, 11, add11, 13)
  const extMatch = suffix.match(/(add9|add11|9|11|13)$/);
  if (extMatch) {
    extension = extMatch[1];
    suffix = suffix.slice(0, -extension.length);
  }

  // Determine quality and tension
  if (suffix === "m" || suffix === "min") {
    quality = "minor";
  } else if (suffix === "maj7" || suffix === "maj") {
    quality = "major";
    tension = "maj7";
  } else if (suffix === "m7" || suffix === "min7") {
    quality = "minor";
    tension = "7";
  } else if (suffix === "mmaj7") {
    quality = "minor";
    tension = "maj7";
  } else if (suffix === "7") {
    quality = "major";
    tension = "7";
  } else if (suffix === "sus2") {
    quality = "major";
    tension = "sus2";
  } else if (suffix === "sus4" || suffix === "sus") {
    quality = "major";
    tension = "sus4";
  } else if (suffix === "dim" || suffix === "dim7") {
    quality = "dim";
    if (suffix.includes("7")) tension = "7";
  } else if (suffix === "aug" || suffix === "aug7") {
    quality = "aug";
    if (suffix.includes("7")) tension = "7";
  }

  return {
    root,
    quality,
    tension,
    extension,
    bassNote,
    isContinue: false
  };
}

/**
 * Adapts a pattern (and target key) to the legacy song structure for sequencer playback.
 * Each chord in the pattern represents 1 bar (4 beats), which is split into:
 * [ChordSlot, ContinueSlot] in 4/4 meter.
 * 
 * @param {Object} pattern - Pattern object (e.g. from static book JSON)
 * @param {string} targetKey - Target transposition key (e.g. "G")
 * @returns {Object} - Legacy song object structure
 */
export function patternToSong(pattern, targetKey) {
  if (!pattern) return null;

  // 1. Transpose the pattern dynamically
  const transposedPattern = transposePattern(pattern, targetKey);
  const chords = transposedPattern.chords || [];

  // 2. Build bars from chords
  const bars = chords.map(chordStr => {
    if (chordStr === "—") {
      // 1 bar of rest
      return {
        slots: [createEmptySlot(), createEmptySlot()]
      };
    }
    
    const chordSlot = parseChordStringToSlot(chordStr);
    const continueSlot = createContinueSlot();
    
    return {
      slots: [chordSlot, continueSlot]
    };
  });

  // 3. Chunk bars into sections of exactly 4 bars (to align with the 1 Section = 4 Bars constraint)
  const sections = [];
  const chunkSize = 4;
  
  if (bars.length === 0) {
    sections.push({
      bars: Array.from({ length: chunkSize }, () => ({
        slots: [createEmptySlot(), createEmptySlot()]
      }))
    });
  } else {
    for (let i = 0; i < bars.length; i += chunkSize) {
      const chunk = bars.slice(i, i + chunkSize);
      // Pad the last section to 4 bars if it's incomplete
      while (chunk.length < chunkSize) {
        chunk.push({
          slots: [createEmptySlot(), createEmptySlot()]
        });
      }
      sections.push({ bars: chunk });
    }
  }

  // 4. Construct default properties
  const defaultBpm = pattern.bpm || 90;
  const defaultStroke = (pattern.feel && pattern.feel.length > 0) ? pattern.feel[0] : "arpeggio";

  return {
    bpm: defaultBpm,
    stroke: defaultStroke,
    loop: true,
    sections: sections
  };
}
