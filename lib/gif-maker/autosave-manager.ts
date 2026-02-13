/**
 * Autosave Manager for GIF Maker
 *
 * Automatically saves editor state to localStorage
 * with debouncing and error handling
 */

const AUTOSAVE_KEY = 'gif-maker-autosave';
const AUTOSAVE_INTERVAL = 30000; // 30 seconds
const AUTOSAVE_VERSION = '2.0';

export interface AutosaveData {
  version: string;
  timestamp: number;
  state: any;
}

let autosaveTimer: NodeJS.Timeout | null = null;

/**
 * Save state to localStorage
 */
export function saveToLocalStorage(state: any): boolean {
  try {
    const data: AutosaveData = {
      version: AUTOSAVE_VERSION,
      timestamp: Date.now(),
      state,
    };

    localStorage.setItem(AUTOSAVE_KEY, JSON.stringify(data));
    console.log('✅ Autosave successful');
    return true;
  } catch (error) {
    console.error('❌ Autosave failed:', error);
    return false;
  }
}

/**
 * Load state from localStorage
 */
export function loadFromLocalStorage(): any | null {
  try {
    const saved = localStorage.getItem(AUTOSAVE_KEY);
    if (!saved) return null;

    const data: AutosaveData = JSON.parse(saved);

    // Check version compatibility
    if (data.version !== AUTOSAVE_VERSION) {
      console.warn('Autosave version mismatch, ignoring saved state');
      return null;
    }

    console.log(`✅ Loaded autosave from ${new Date(data.timestamp).toLocaleString()}`);
    return data.state;
  } catch (error) {
    console.error('❌ Failed to load autosave:', error);
    return null;
  }
}

/**
 * Clear autosave data
 */
export function clearAutosave(): void {
  try {
    localStorage.removeItem(AUTOSAVE_KEY);
    console.log('✅ Autosave cleared');
  } catch (error) {
    console.error('❌ Failed to clear autosave:', error);
  }
}

/**
 * Check if autosave exists
 */
export function hasAutosave(): boolean {
  try {
    const saved = localStorage.getItem(AUTOSAVE_KEY);
    return saved !== null;
  } catch {
    return false;
  }
}

/**
 * Get autosave age in milliseconds
 */
export function getAutosaveAge(): number | null {
  try {
    const saved = localStorage.getItem(AUTOSAVE_KEY);
    if (!saved) return null;

    const data: AutosaveData = JSON.parse(saved);
    return Date.now() - data.timestamp;
  } catch {
    return null;
  }
}

/**
 * Start autosave with debouncing
 */
export function startAutosave(
  getState: () => any,
  interval: number = AUTOSAVE_INTERVAL
): void {
  if (autosaveTimer) {
    clearInterval(autosaveTimer);
  }

  autosaveTimer = setInterval(() => {
    const state = getState();
    saveToLocalStorage(state);
  }, interval);

  console.log(`🔄 Autosave started (every ${interval / 1000}s)`);
}

/**
 * Stop autosave
 */
export function stopAutosave(): void {
  if (autosaveTimer) {
    clearInterval(autosaveTimer);
    autosaveTimer = null;
    console.log('⏸️ Autosave stopped');
  }
}

/**
 * Manual save with notification
 */
export function manualSave(state: any): { success: boolean; message: string } {
  const success = saveToLocalStorage(state);
  return {
    success,
    message: success
      ? 'Project saved successfully'
      : 'Failed to save project',
  };
}

/**
 * Export project as JSON file
 */
export function exportProject(state: any, filename?: string): void {
  try {
    const data: AutosaveData = {
      version: AUTOSAVE_VERSION,
      timestamp: Date.now(),
      state,
    };

    const blob = new Blob([JSON.stringify(data, null, 2)], {
      type: 'application/json',
    });

    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download =
      filename || `gif-maker-project-${Date.now()}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    console.log('✅ Project exported');
  } catch (error) {
    console.error('❌ Failed to export project:', error);
    throw error;
  }
}

/**
 * Import project from JSON file
 */
export function importProject(file: File): Promise<any> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = (e) => {
      try {
        const data: AutosaveData = JSON.parse(
          e.target?.result as string
        );

        // Check version compatibility
        if (data.version !== AUTOSAVE_VERSION) {
          reject(new Error('Incompatible project version'));
          return;
        }

        console.log('✅ Project imported');
        resolve(data.state);
      } catch (error) {
        console.error('❌ Failed to import project:', error);
        reject(error);
      }
    };

    reader.onerror = () => {
      reject(new Error('Failed to read file'));
    };

    reader.readAsText(file);
  });
}
