/**
 * Auth store — tracks biometric lock state and app lock timeout.
 */
import { create } from 'zustand';
import { authenticateWithBiometrics, isBiometricAvailable } from '@/utils/biometric';
import { secureGet, secureSet } from '@/utils/secureStorage';
import { STORAGE_KEYS } from '@/constants';

interface AuthState {
  isLocked: boolean;
  isBiometricEnabled: boolean;
  lockTimeoutMinutes: number;
  isLoading: boolean;

  // Actions
  initialize: () => Promise<void>;
  unlock: () => Promise<boolean>;
  lock: () => void;
  setBiometricEnabled: (enabled: boolean) => Promise<void>;
  setLockTimeout: (minutes: number) => Promise<void>;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  isLocked: true,
  isBiometricEnabled: false,
  lockTimeoutMinutes: 1,
  isLoading: true,

  initialize: async () => {
    const [biometricEnabled, lockTimeout] = await Promise.all([
      secureGet(STORAGE_KEYS.BIOMETRIC_ENABLED),
      secureGet(STORAGE_KEYS.LOCK_TIMEOUT_MINUTES),
    ]);

    const available = await isBiometricAvailable();

    set({
      isBiometricEnabled: available && biometricEnabled === 'true',
      lockTimeoutMinutes: lockTimeout ? parseInt(lockTimeout, 10) : 1,
      isLoading: false,
      isLocked: available && biometricEnabled === 'true',
    });
  },

  unlock: async () => {
    const { isBiometricEnabled } = get();
    if (!isBiometricEnabled) {
      set({ isLocked: false });
      return true;
    }

    const success = await authenticateWithBiometrics(
      'Authenticate to access Chiki'
    );

    if (success) {
      set({ isLocked: false });
      await secureSet(STORAGE_KEYS.LAST_ACTIVE_AT, Date.now().toString());
    }

    return success;
  },

  lock: () => set({ isLocked: true }),

  setBiometricEnabled: async (enabled: boolean) => {
    await secureSet(STORAGE_KEYS.BIOMETRIC_ENABLED, enabled.toString());
    set({ isBiometricEnabled: enabled });
  },

  setLockTimeout: async (minutes: number) => {
    await secureSet(STORAGE_KEYS.LOCK_TIMEOUT_MINUTES, minutes.toString());
    set({ lockTimeoutMinutes: minutes });
  },
}));
