/* ==========================================================================
   Cadence - Chord Database & Voicing Utilities
   ========================================================================== */

// Standard guitar tuning MIDI notes (E2, A2, D3, G3, B3, E4)
export const jy = [40, 45, 50, 55, 59, 64];

// Root pitch offsets
export const ob = {
  "C": 0, "C#": 1, "Db": 1, "D": 2, "D#": 3, "Eb": 3, "E": 4, "F": 5, 
  "F#": 6, "Gb": 6, "G": 7, "G#": 8, "Ab": 8, "A": 9, "A#": 10, "Bb": 10, "B": 11
};

// Chord quality pitch intervals relative to root
export const rb = {
  major: [0, 4, 7],
  minor: [0, 3, 7],
  dim: [0, 3, 6],
  aug: [0, 4, 8]
};

// Chord shapes helper factories (used in minified db)
function dl(i) { return { frets: [i, i + 2, i + 2, i + 1, i, i], barre: i, baseFret: i }; }
function Ii(i) { return { frets: [-1, i, i + 2, i + 2, i + 2, i], barre: i, baseFret: i }; }
function ta(i) { return { frets: [i, i + 2, i + 2, i, i, i], barre: i, baseFret: i }; }
function ks(i) { return { frets: [-1, i, i + 2, i + 2, i + 1, i], barre: i, baseFret: i }; }

// Helper: Format chord data to DB lookup key
export function getDbKey(chord) {
  if (!chord || !chord.root) return "";
  let key = chord.root;
  if (chord.tension === "sus2" || chord.tension === "sus4") {
    key += chord.tension;
  } else {
    if (chord.quality === "minor") key += "m";
    else if (chord.quality === "dim") key += "dim";
    else if (chord.quality === "aug") key += "aug";
    
    if (chord.tension === "7") key += "7";
    else if (chord.tension === "maj7") key += "maj7";
  }
  return key;
}

// Helper: Format chord data to display string
export function getDisplayString(chord) {
  if (!chord) return "—";
  if (chord.isContinue) return "↳";
  if (!chord.root) return "—";
  
  let text = chord.root;
  if (chord.tension === "sus2" || chord.tension === "sus4") {
    text += chord.tension;
  } else {
    if (chord.quality === "minor") text += "m";
    else if (chord.quality === "dim") text += "dim";
    else if (chord.quality === "aug") text += "aug";
    
    if (chord.tension === "7") text += "7";
    else if (chord.tension === "maj7") text += "maj7";
  }
  
  if (chord.extension) {
    text += chord.extension;
  }
  
  if (chord.bassNote && chord.bassNote !== chord.root) {
    text += "/" + chord.bassNote;
  }
  
  return text;
}

// Factory: Create default empty chord slot
export function createEmptySlot() {
  return {
    root: null,
    quality: "major",
    tension: "",
    extension: "",
    bassNote: null,
    isContinue: false
  };
}

// Factory: Create continue chord slot
export function createContinueSlot() {
  return {
    root: null,
    quality: "major",
    tension: "",
    extension: "",
    bassNote: null,
    isContinue: true
  };
}

// Resolve chord database shape
export function resolveChordShape(chord) {
  if (!chord || !chord.root) return null;
  const key = getDbKey(chord);
  return chordDb[key] ?? null;
}

// Map chord shape to absolute MIDI notes
export function mapShapeToNotes(shape) {
  const baseFret = shape.baseFret ?? 1;
  return shape.frets.map((fret, stringIdx) => {
    if (fret < 0) return -1;
    const absFret = fret === 0 ? 0 : fret + (baseFret - 1);
    return jy[stringIdx] + absFret;
  }).filter(note => note >= 0);
}

// Generate fallback voicing dynamically when shape is not in database
export function generateFallbackVoicing(chord) {
  const rootOffset = ob[chord.root ?? "C"] ?? 0;
  const intervals = rb[chord.quality] ?? [0, 4, 7];
  const notes = [];
  
  for (let stringIdx = 0; stringIdx < 6; stringIdx++) {
    const openNote = jy[stringIdx];
    const openPitchClass = openNote % 12;
    
    for (const interval of intervals) {
      const targetPitchClass = (rootOffset + interval) % 12;
      const fret = (targetPitchClass - openPitchClass + 12) % 12;
      if (fret <= 5) {
        notes.push(openNote + fret);
        break;
      }
    }
  }
  
  if (notes.length === 0) {
    notes.push(60 + rootOffset); // Default fallback note (Middle C region + offset)
  }
  return notes;
}

// Resolve all active MIDI notes for a chord slot
export function resolveChordNotes(chord) {
  if (!chord || !chord.root) return [];
  const shape = resolveChordShape(chord);
  return shape ? mapShapeToNotes(shape) : generateFallbackVoicing(chord);
}

export const chordDb = {
  "C": {"frets":[-1,3,2,0,1,0]},
  "Cm": {"frets":[-1,3,5,5,4,3],"barre":3,"baseFret":3},
  "C7": {"frets":[-1,3,2,3,1,0]},
  "Cmaj7": {"frets":[-1,3,2,0,0,0]},
  "Csus2": {"frets":[-1,3,0,0,1,3]},
  "Csus4": {"frets":[-1,3,3,0,1,1]},
  "Caug": {"frets":[-1,3,2,1,1,0]},
  "Cdim": {"frets":[-1,3,4,5,4,-1],"baseFret":1},
  "C#": {"frets":[-1,4,6,6,6,4],"barre":4,"baseFret":4},
  "C#m": {"frets":[-1,4,6,6,5,4],"barre":4,"baseFret":4},
  "C#7": {"frets":[-1,4,3,4,2,-1],"baseFret":4},
  "Db": {"frets":[-1,4,6,6,6,4],"barre":4,"baseFret":4},
  "Dbm": {"frets":[-1,4,6,6,5,4],"barre":4,"baseFret":4},
  "D": {"frets":[-1,-1,0,2,3,2]},
  "Dm": {"frets":[-1,-1,0,2,3,1]},
  "D7": {"frets":[-1,-1,0,2,1,2]},
  "Dmaj7": {"frets":[-1,-1,0,2,2,2]},
  "Dsus2": {"frets":[-1,-1,0,2,3,0]},
  "Dsus4": {"frets":[-1,-1,0,2,3,3]},
  "Daug": {"frets":[-1,-1,0,3,3,2]},
  "Ddim": {"frets":[-1,-1,0,1,3,1]},
  "D#": {"frets":[-1,6,8,8,8,6],"barre":6,"baseFret":6},
  "D#m": {"frets":[6,8,8,6,6,6],"barre":6,"baseFret":6},
  "Eb": {"frets":[-1,6,8,8,8,6],"barre":6,"baseFret":6},
  "Ebm": {"frets":[6,8,8,6,6,6],"barre":6,"baseFret":6},
  "E": {"frets":[0,2,2,1,0,0]},
  "Em": {"frets":[0,2,2,0,0,0]},
  "E7": {"frets":[0,2,0,1,0,0]},
  "Emaj7": {"frets":[0,2,1,1,0,0]},
  "Esus2": {"frets":[0,2,4,4,0,0]},
  "Esus4": {"frets":[0,2,2,2,0,0]},
  "Eaug": {"frets":[0,3,2,1,1,0]},
  "Edim": {"frets":[0,1,2,0,-1,3]},
  "F": {"frets":[1,3,3,2,1,1],"barre":1,"baseFret":1},
  "Fm": {"frets":[1,3,3,1,1,1],"barre":1,"baseFret":1},
  "F7": {"frets":[1,3,1,2,1,1],"barre":1,"baseFret":1},
  "Fmaj7": {"frets":[-1,-1,3,2,1,0]},
  "Fsus2": {"frets":[1,3,3,2,1,1],"barre":1,"baseFret":1},
  "Fsus4": {"frets":[1,3,3,3,1,1],"barre":1,"baseFret":1},
  "Faug": {"frets":[-1,-1,3,2,2,1]},
  "Fdim": {"frets":[-1,-1,3,4,3,-1],"baseFret":1},
  "F#": {"frets":[2,4,4,3,2,2],"barre":2,"baseFret":2},
  "F#m": {"frets":[2,4,4,2,2,2],"barre":2,"baseFret":2},
  "F#7": {"frets":[2,4,2,3,2,2],"barre":2,"baseFret":2},
  "Gb": {"frets":[2,4,4,3,2,2],"barre":2,"baseFret":2},
  "Gbm": {"frets":[2,4,4,2,2,2],"barre":2,"baseFret":2},
  "G": {"frets":[3,2,0,0,0,3]},
  "Gm": {"frets":[3,5,5,3,3,3],"barre":3,"baseFret":3},
  "G7": {"frets":[3,2,0,0,0,1]},
  "Gmaj7": {"frets":[3,2,0,0,0,2]},
  "Gsus2": {"frets":[3,2,0,0,3,3]},
  "Gsus4": {"frets":[3,3,0,0,1,3]},
  "Gaug": {"frets":[3,2,1,0,0,3]},
  "Gdim": {"frets":[3,4,5,3,-1,-1],"baseFret":3},
  "G#": {"frets":[4,6,6,5,4,4],"barre":4,"baseFret":4},
  "G#m": {"frets":[4,6,6,4,4,4],"barre":4,"baseFret":4},
  "G#7": {"frets":[4,6,4,5,4,4],"barre":4,"baseFret":4},
  "Ab": {"frets":[4,6,6,5,4,4],"barre":4,"baseFret":4},
  "Abm": {"frets":[4,6,6,4,4,4],"barre":4,"baseFret":4},
  "A": {"frets":[-1,0,2,2,2,0]},
  "Am": {"frets":[-1,0,2,2,1,0]},
  "A7": {"frets":[-1,0,2,0,2,0]},
  "Amaj7": {"frets":[-1,0,2,1,2,0]},
  "Asus2": {"frets":[-1,0,2,2,0,0]},
  "Asus4": {"frets":[-1,0,2,2,3,0]},
  "Aaug": {"frets":[-1,0,3,2,2,1]},
  "Adim": {"frets":[-1,0,1,2,1,-1]},
  "A#": {"frets":[-1,1,3,3,3,1],"barre":1,"baseFret":1},
  "A#m": {"frets":[-1,1,3,3,2,1],"barre":1,"baseFret":1},
  "A#7": {"frets":[-1,1,3,1,3,1],"barre":1,"baseFret":1},
  "Bb": {"frets":[-1,1,3,3,3,1],"barre":1,"baseFret":1},
  "Bbm": {"frets":[-1,1,3,3,2,1],"barre":1,"baseFret":1},
  "B": {"frets":[-1,2,4,4,4,2],"barre":2,"baseFret":2},
  "Bm": {"frets":[-1,2,4,4,3,2],"barre":2,"baseFret":2},
  "B7": {"frets":[-1,2,1,2,0,2]},
  "Bmaj7": {"frets":[-1,2,4,3,4,2],"baseFret":2},
  "Bsus2": {"frets":[-1,2,4,4,2,2],"baseFret":2},
  "Bsus4": {"frets":[-1,2,4,4,5,2],"baseFret":2},
  "Baug": {"frets":[-1,-1,1,0,0,4]},
  "Bdim": {"frets":[-1,2,3,4,3,-1],"baseFret":2},
};

