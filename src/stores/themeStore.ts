import { create } from 'zustand';
import { secureGet, secureSet } from '@/utils/secureStorage';

export type ThemeMode = 'terra';

const VALID_MODES: ThemeMode[] = ['terra'];

interface ThemeState {
  mode: ThemeMode;
  resolved: ThemeMode;
  initialize: () => Promise<void>;
  setMode: (mode: ThemeMode) => Promise<void>;
}

export const useThemeStore = create<ThemeState>((set) => ({
  mode: 'terra',
  resolved: 'terra',

  initialize: async () => {
    const saved = await secureGet('bw_theme_mode');
    const mode: ThemeMode = VALID_MODES.includes(saved as ThemeMode)
      ? (saved as ThemeMode)
      : 'terra';
    set({ mode, resolved: mode });
  },

  setMode: async (mode) => {
    await secureSet('bw_theme_mode', mode);
    set({ mode, resolved: mode });
  },
}));
