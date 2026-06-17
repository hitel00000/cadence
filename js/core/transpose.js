/**
 * Cadence - Dynamic Transposition Engine
 */

const NOTE_OFFSETS = {
  "C": 0, "C#": 1, "Db": 1, "D": 2, "D#": 3, "Eb": 3, "E": 4, "F": 5, 
  "F#": 6, "Gb": 6, "G": 7, "G#": 8, "Ab": 8, "A": 9, "A#": 10, "Bb": 10, "B": 11
};

const SHARP_KEYS = ["G", "D", "A", "E", "B", "F#", "C#", "Em", "Bm", "F#m", "C#m", "G#m", "D#m"];
const FLAT_KEYS = ["F", "Bb", "Eb", "Ab", "Db", "Gb", "Dm", "Gm", "Cm", "Fm", "Bbm", "Ebm"];

function getNoteOffset(note) {
  if (!note) return 0;
  // Clean minor suffix or other characters (e.g. "Am" -> "A")
  const cleanNote = note.replace(/m$/, "");
  return NOTE_OFFSETS[cleanNote] ?? 0;
}

function getNoteName(offset, targetKey = "C") {
  const isFlatKey = FLAT_KEYS.includes(targetKey);
  const sharpNames = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];
  const flatNames = ["C", "Db", "D", "Eb", "E", "F", "Gb", "G", "Ab", "A", "Bb", "B"];
  return isFlatKey ? flatNames[offset] : sharpNames[offset];
}

/**
 * Transpose a single chord string by a given number of semitones.
 * Handles slash chords and preserves chord qualities/tensions.
 * 
 * @param {string} chordStr - e.g. "Cmaj7", "F#m/A", "C"
 * @param {number} semitones - semitones to shift (positive or negative)
 * @param {string} targetKey - target key to determine sharp/flat spelling
 * @returns {string} - transposed chord string
 */
export function transposeChord(chordStr, semitones, targetKey = "C") {
  if (!chordStr || chordStr === "—" || chordStr === "↳") return chordStr;
  
  // Parse chord: Root(G1), Quality/Tension(G2), Slash Root(G3)
  const regex = /^([A-G][#b]?)([^/]*)(?:\/([A-G][#b]?))?$/;
  const match = chordStr.match(regex);
  if (!match) return chordStr; // Return as-is if parsing fails
  
  const root = match[1];
  const quality = match[2];
  const slashRoot = match[3];
  
  // Transpose root
  const rootOffset = NOTE_OFFSETS[root];
  if (rootOffset === undefined) return chordStr;
  const newRootOffset = (rootOffset + semitones + 12) % 12;
  const newRoot = getNoteName(newRootOffset, targetKey);
  
  // Transpose slash root if present
  let newSlashPart = "";
  if (slashRoot) {
    const slashOffset = NOTE_OFFSETS[slashRoot];
    if (slashOffset !== undefined) {
      const newSlashOffset = (slashOffset + semitones + 12) % 12;
      const newSlash = getNoteName(newSlashOffset, targetKey);
      newSlashPart = "/" + newSlash;
    }
  }
  
  return newRoot + quality + newSlashPart;
}

/**
 * Transposes a complete pattern's chord list from its default key to a target key.
 * 
 * @param {Object} pattern - Pattern object containing defaultKey and chords array
 * @param {string} targetKey - Target key (e.g. "G")
 * @returns {Object} - Shallow copy of the pattern with transposed chords and targetKey set
 */
export function transposePattern(pattern, targetKey) {
  if (!pattern || !pattern.defaultKey || !pattern.chords) return pattern;
  
  const fromOffset = getNoteOffset(pattern.defaultKey);
  const toOffset = getNoteOffset(targetKey);
  const semitones = (toOffset - fromOffset + 12) % 12;
  
  const transposedChords = pattern.chords.map(chord => 
    transposeChord(chord, semitones, targetKey)
  );
  
  return {
    ...pattern,
    targetKey: targetKey,
    chords: transposedChords
  };
}
