/**
 * Alert store — in-memory alert state with read-status persisted to secure storage.
 */
import { create } from 'zustand';
import { secureGet, secureSet } from '@/utils/secureStorage';

export type AlertKind =
  | 'budget_warning'
  | 'budget_exceeded'
  | 'loan_due'
  | 'goal_milestone';

export interface AppAlert {
  id: string;         // deterministic, e.g. "budget_warning_catId_2026_04"
  kind: AlertKind;
  title: string;
  body: string;
  icon: string;       // Ionicons glyph name
  iconColor: string;  // hex color
  createdAt: string;  // ISO string
  isRead: boolean;
}

const READ_IDS_KEY = 'bw_alert_read_ids';

interface AlertState {
  alerts: AppAlert[];
  lastGeneratedAt: string | null;

  // Actions
  setAlerts: (alerts: AppAlert[]) => void;
  markAllRead: () => void;
  markRead: (id: string) => void;
  clearAll: () => void;
  initialize: () => Promise<void>;

  // Derived getter
  getUnreadCount: () => number;
}

export const useAlertStore = create<AlertState>((set, get) => ({
  alerts: [],
  lastGeneratedAt: null,

  setAlerts: async (incoming: AppAlert[]) => {
    // Load persisted read IDs and overlay them onto incoming alerts
    let readIds: string[] = [];
    try {
      const raw = await secureGet(READ_IDS_KEY);
      if (raw) readIds = JSON.parse(raw) as string[];
    } catch {
      readIds = [];
    }

    const readSet = new Set(readIds);
    const merged = incoming.map((a) => ({
      ...a,
      isRead: readSet.has(a.id),
    }));

    set({ alerts: merged, lastGeneratedAt: new Date().toISOString() });
  },

  markAllRead: async () => {
    const { alerts } = get();
    const updated = alerts.map((a) => ({ ...a, isRead: true }));
    set({ alerts: updated });

    const allIds = updated.map((a) => a.id);
    try {
      await secureSet(READ_IDS_KEY, JSON.stringify(allIds));
    } catch {
      // best-effort
    }
  },

  markRead: async (id: string) => {
    const { alerts } = get();
    const updated = alerts.map((a) => (a.id === id ? { ...a, isRead: true } : a));
    set({ alerts: updated });

    const readIds = updated.filter((a) => a.isRead).map((a) => a.id);
    try {
      await secureSet(READ_IDS_KEY, JSON.stringify(readIds));
    } catch {
      // best-effort
    }
  },

  clearAll: async () => {
    set({ alerts: [] });
    try {
      await secureSet(READ_IDS_KEY, JSON.stringify([]));
    } catch {
      // best-effort
    }
  },

  initialize: async () => {
    const { alerts } = get();
    if (alerts.length === 0) return;

    let readIds: string[] = [];
    try {
      const raw = await secureGet(READ_IDS_KEY);
      if (raw) readIds = JSON.parse(raw) as string[];
    } catch {
      readIds = [];
    }

    const readSet = new Set(readIds);
    const updated = alerts.map((a) => ({
      ...a,
      isRead: readSet.has(a.id),
    }));
    set({ alerts: updated });
  },

  getUnreadCount: () => get().alerts.filter((a) => !a.isRead).length,
}));
