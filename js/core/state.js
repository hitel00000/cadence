/* ==========================================================================
   Cadence - Centralized Reactive State Store
   ========================================================================== */

const initialState = {
  song: null,
  playback: {
    isPlaying: false,
    currentSlot: 0,
    loopABActive: false,
    loopStartBar: 0,
    loopEndBar: 0,
    wakeLockEnabled: true
  },
  editing: null, // { sectionIndex, barIndex, slotIndex }
  books: [],
  currentPattern: null,
  currentKey: "C",
  uiMode: "practice", // "practice" or "edit"
  searchQuery: "",
  selectedCategory: "all"
};

class StateStore {
  constructor() {
    this.listeners = {};
    
    const onChange = (path, value, oldValue) => {
      // 1. Notify exact path subscribers (e.g. 'playback.currentSlot')
      if (this.listeners[path]) {
        this.listeners[path].forEach(cb => cb(value, oldValue));
      }
      
      // 2. Notify parent path subscribers (e.g. 'playback')
      const parts = path.split('.');
      if (parts.length > 1) {
        const parentPath = parts.slice(0, -1).join('.');
        if (this.listeners[parentPath]) {
          this.listeners[parentPath].forEach(cb => cb(this.getNestedValue(parentPath), null));
        }
      }
    };
    
    this.state = this.deepProxy(initialState, '', onChange);
  }

  getNestedValue(path) {
    return path.split('.').reduce((obj, key) => obj && obj[key], this.state);
  }

  deepProxy(obj, path, onChange) {
    const self = this;
    return new Proxy(obj, {
      get(target, property, receiver) {
        const val = Reflect.get(target, property, receiver);
        if (typeof val === 'object' && val !== null) {
          const nextPath = path ? `${path}.${String(property)}` : String(property);
          return self.deepProxy(val, nextPath, onChange);
        }
        return val;
      },
      set(target, property, value, receiver) {
        const oldValue = target[property];
        const success = Reflect.set(target, property, value, receiver);
        if (success && oldValue !== value) {
          const nextPath = path ? `${path}.${String(property)}` : String(property);
          onChange(nextPath, value, oldValue);
        }
        return success;
      }
    });
  }

  /**
   * Subscribe to state changes at a specific property path.
   * 
   * @param {string} path - State property path (e.g., 'uiMode' or 'playback.currentSlot')
   * @param {function} callback - Function called with (newValue, oldValue)
   * @returns {function} - Unsubscribe function
   */
  subscribe(path, callback) {
    if (!this.listeners[path]) {
      this.listeners[path] = [];
    }
    this.listeners[path].push(callback);
    return () => {
      this.listeners[path] = this.listeners[path].filter(cb => cb !== callback);
    };
  }
}

export const store = new StateStore();
export const state = store.state;
