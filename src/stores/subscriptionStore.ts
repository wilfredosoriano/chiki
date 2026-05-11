// TODO: Replace mock with RevenueCat when publishing
//
// This is a mock subscription store for development and TestFlight builds.
// It persists isPremium to SecureStore so the toggle survives app restarts.
// Replace `subscribe`, `restore`, and `initialize` with RevenueCat calls
// before submitting to the App Store / Play Store.

import { create } from 'zustand';
import { secureGet, secureSet } from '@/utils/secureStorage';

const STORAGE_KEY = 'bw_is_premium';

interface SubscriptionState {
  isPremium: boolean;
  isLoading: boolean;
  initialize: () => Promise<void>;
  subscribe: () => Promise<void>;
  restore: () => Promise<void>;
  reset: () => Promise<void>;
}

export const useSubscriptionStore = create<SubscriptionState>((set) => ({
  isPremium: false,
  isLoading: true,

  initialize: async () => {
    try {
      const stored = await secureGet(STORAGE_KEY);
      set({ isPremium: stored === 'true', isLoading: false });
    } catch {
      set({ isLoading: false });
    }
  },

  subscribe: async () => {
    await secureSet(STORAGE_KEY, 'true');
    set({ isPremium: true });
  },

  restore: async () => {
    await secureSet(STORAGE_KEY, 'true');
    set({ isPremium: true });
  },

  // For testing — resets premium status back to free tier
  reset: async () => {
    await secureSet(STORAGE_KEY, 'false');
    set({ isPremium: false });
  },
}));
