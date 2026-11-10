import { create } from 'zustand';

export type Screen = 'loading' | 'title' | 'game';
export type Overlay = null | 'pause' | 'map' | 'settings';
export type Quality = 'high' | 'low';

export interface Settings {
  /** High: bloom, shadows, MSAA, full DPR. Low: none of those. */
  quality: Quality;
}

const SETTINGS_KEY = 'sole-operator:settings';

function loadSettings(): Settings {
  const fallback: Settings = { quality: guessQuality() };
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    return raw ? { ...fallback, ...(JSON.parse(raw) as Partial<Settings>) } : fallback;
  } catch {
    return fallback;
  }
}

/** Phones and small touch screens start on Low. */
function guessQuality(): Quality {
  try {
    const coarse = window.matchMedia('(pointer: coarse)').matches;
    return coarse && Math.min(screen.width, screen.height) < 820 ? 'low' : 'high';
  } catch {
    return 'high';
  }
}

interface AppState {
  screen: Screen;
  overlay: Overlay;
  /** Overlay to return to when settings close (title or pause). */
  settingsReturn: Overlay;
  settings: Settings;
  setScreen(s: Screen): void;
  setOverlay(o: Overlay): void;
  openSettings(): void;
  closeSettings(): void;
  updateSettings(patch: Partial<Settings>): void;
}

export const useApp = create<AppState>()((set, get) => ({
  screen: 'loading',
  overlay: null,
  settingsReturn: null,
  settings: loadSettings(),
  setScreen: (screen) => set({ screen, overlay: null }),
  setOverlay: (overlay) => set({ overlay }),
  openSettings: () => set({ settingsReturn: get().overlay, overlay: 'settings' }),
  closeSettings: () => set({ overlay: get().settingsReturn }),
  updateSettings: (patch) => {
    const settings = { ...get().settings, ...patch };
    try {
      localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
    } catch {
      /* storage blocked: keep in memory */
    }
    set({ settings });
  },
}));
