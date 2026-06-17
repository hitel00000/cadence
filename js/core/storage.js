/**
 * Cadence - Data Storage & Migration Layer
 */

import { createEmptySlot, createContinueSlot } from '../chordDb.js';

const KEYS = {
  LEGACY_SONG: "cadence_song",
  CURRENT_SONG: "cadence:v1:currentSong",
  SETTINGS: "cadence:v1:settings",
  FAVORITES: "cadence:v1:favorites",
  RECENT: "cadence:v1:recent",
  USER_PATTERNS: "cadence:v1:userPatterns"
};

/**
 * Validate imported JSON data schema to prevent app crashes.
 * 
 * @param {Object} data - Parsed JSON object to validate
 * @returns {boolean} - true if schema is valid
 */
export function validateImportData(data) {
  if (!data || data.format !== "cadence-export") return false;
  if (typeof data.version !== "number") return false;
  if (data.favorites && !Array.isArray(data.favorites)) return false;
  if (data.recent && !Array.isArray(data.recent)) return false;
  if (data.userPatterns && !Array.isArray(data.userPatterns)) return false;
  return true;
}

/**
 * Migrate legacy song structure (e.g. measures -> bars, null/hold slots -> slot objects).
 * 
 * @param {Object} song - Legacy song object
 * @returns {Object} - Migrated song object
 */
function migrateSongStructure(song) {
  if (!song || !song.sections) return song;

  song.sections.forEach(section => {
    // 1. Migrate measures to bars
    if (section.measures && !section.bars) {
      section.bars = section.measures;
      delete section.measures;
    }
    
    // 2. Validate and migrate slots inside bars
    if (section.bars) {
      section.bars.forEach(bar => {
        if (bar.slots) {
          bar.slots = bar.slots.map(slot => {
            if (slot === null) {
              return createEmptySlot();
            }
            if (slot.hold) {
              return createContinueSlot();
            }
            return {
              root: slot.root ?? null,
              quality: slot.quality ?? "major",
              tension: slot.tension ?? "",
              extension: slot.extension ?? "",
              bassNote: slot.bassNote ?? null,
              isContinue: !!slot.isContinue
            };
          });
        } else {
          bar.slots = [createEmptySlot(), createEmptySlot()];
        }
      });
    }
  });

  return song;
}

/**
 * Loads the current active song, handling legacy localStorage migration if necessary.
 * 
 * @returns {Object|null} - The active song object, or null if not found
 */
export function loadSong() {
  try {
    // Check for legacy song storage first
    const legacySaved = localStorage.getItem(KEYS.LEGACY_SONG);
    if (legacySaved) {
      const parsedLegacy = JSON.parse(legacySaved);
      if (parsedLegacy && parsedLegacy.sections && parsedLegacy.sections.length > 0) {
        const migratedSong = migrateSongStructure(parsedLegacy);
        // Save to the new key and remove the legacy key
        localStorage.setItem(KEYS.CURRENT_SONG, JSON.stringify(migratedSong));
        localStorage.removeItem(KEYS.LEGACY_SONG);
        return migratedSong;
      }
    }

    // Load from current active key
    const saved = localStorage.getItem(KEYS.CURRENT_SONG);
    if (saved) {
      const song = JSON.parse(saved);
      if (song && song.sections && song.sections.length > 0) {
        return migrateSongStructure(song);
      }
    }
  } catch (e) {
    console.error("Failed to load song from storage:", e);
  }
  return null;
}

/**
 * Saves the current active song to localStorage.
 * 
 * @param {Object} song - The song state to save
 */
export function saveSong(song) {
  try {
    if (song) {
      localStorage.setItem(KEYS.CURRENT_SONG, JSON.stringify(song));
    }
  } catch (e) {
    console.error("Failed to save song to storage:", e);
  }
}

/**
 * Load global user settings.
 */
export function loadSettings() {
  try {
    const saved = localStorage.getItem(KEYS.SETTINGS);
    return saved ? JSON.parse(saved) : null;
  } catch (e) {
    console.error("Failed to load settings:", e);
    return null;
  }
}

/**
 * Save global user settings.
 */
export function saveSettings(settings) {
  try {
    localStorage.setItem(KEYS.SETTINGS, JSON.stringify(settings));
  } catch (e) {
    console.error("Failed to save settings:", e);
  }
}

/**
 * Load favorites list (array of pattern IDs).
 */
export function loadFavorites() {
  try {
    const saved = localStorage.getItem(KEYS.FAVORITES);
    return saved ? JSON.parse(saved) : [];
  } catch (e) {
    console.error("Failed to load favorites:", e);
    return [];
  }
}

/**
 * Save favorites list.
 */
export function saveFavorites(favorites) {
  try {
    localStorage.setItem(KEYS.FAVORITES, JSON.stringify(favorites));
  } catch (e) {
    console.error("Failed to save favorites:", e);
  }
}

/**
 * Load recent practice session history.
 */
export function loadRecent() {
  try {
    const saved = localStorage.getItem(KEYS.RECENT);
    return saved ? JSON.parse(saved) : [];
  } catch (e) {
    console.error("Failed to load recent history:", e);
    return [];
  }
}

/**
 * Save recent practice history.
 */
export function saveRecent(recent) {
  try {
    localStorage.setItem(KEYS.RECENT, JSON.stringify(recent));
  } catch (e) {
    console.error("Failed to save recent history:", e);
  }
}

/**
 * Load custom user patterns.
 */
export function loadUserPatterns() {
  try {
    const saved = localStorage.getItem(KEYS.USER_PATTERNS);
    return saved ? JSON.parse(saved) : [];
  } catch (e) {
    console.error("Failed to load user patterns:", e);
    return [];
  }
}

/**
 * Save custom user patterns.
 */
export function saveUserPatterns(patterns) {
  try {
    localStorage.setItem(KEYS.USER_PATTERNS, JSON.stringify(patterns));
  } catch (e) {
    console.error("Failed to save user patterns:", e);
  }
}

/**
 * Exports all user data (settings, favorites, recent history, custom patterns) to a JSON string.
 * Excludes default static books.
 * 
 * @returns {string} - JSON string containing all exportable user data
 */
export function exportData() {
  const exportPayload = {
    format: "cadence-export",
    version: 1,
    exportedAt: new Date().toISOString(),
    settings: loadSettings(),
    favorites: loadFavorites(),
    recent: loadRecent(),
    userPatterns: loadUserPatterns()
  };
  return JSON.stringify(exportPayload, null, 2);
}

/**
 * Imports user data from a JSON string, performs schema validation, and merges/overwrites storage.
 * Handles duplicate pattern IDs by adding a suffix to avoid collisions.
 * 
 * @param {string} jsonStr - JSON string containing imported data
 * @returns {boolean} - true if import was successful
 */
export function importData(jsonStr) {
  try {
    const data = JSON.parse(jsonStr);
    if (!validateImportData(data)) {
      throw new Error("Invalid schema format");
    }

    // 1. Restore settings if present
    if (data.settings) {
      saveSettings(data.settings);
    }

    // 2. Merge favorites (union to avoid duplicates)
    if (data.favorites) {
      const currentFavs = loadFavorites();
      const mergedFavs = Array.from(new Set([...currentFavs, ...data.favorites]));
      saveFavorites(mergedFavs);
    }

    // 3. Merge recent history (limit history to 50 elements)
    if (data.recent) {
      const currentRecent = loadRecent();
      const mergedRecent = [...data.recent, ...currentRecent]
        .sort((a, b) => new Date(b.playedAt) - new Date(a.playedAt))
        .slice(0, 50);
      saveRecent(mergedRecent);
    }

    // 4. Merge user custom patterns, solving ID collisions
    if (data.userPatterns) {
      const currentUserPatterns = loadUserPatterns();
      const updatedUserPatterns = [...currentUserPatterns];

      data.userPatterns.forEach(importedPattern => {
        // Resolve ID collision
        let resolvedId = importedPattern.id;
        const exists = currentUserPatterns.some(p => p.id === resolvedId);
        if (exists) {
          const timestamp = Date.now().toString().slice(-4);
          resolvedId = `${importedPattern.id}-imported-${timestamp}`;
          importedPattern.id = resolvedId;
          importedPattern.title = `${importedPattern.title} (Imported)`;
        }
        updatedUserPatterns.push(importedPattern);
      });
      saveUserPatterns(updatedUserPatterns);
    }

    return true;
  } catch (e) {
    console.error("Failed to import data:", e);
    return false;
  }
}
