import { create } from 'zustand';
import { secureGet, secureSet } from '@/utils/secureStorage';

interface NotificationState {
  billRemindersEnabled: boolean;
  budgetAlertsEnabled: boolean;
  weeklySummaryEnabled: boolean;
  initialize: () => Promise<void>;
  setBillRemindersEnabled: (enabled: boolean) => Promise<void>;
  setBudgetAlertsEnabled: (enabled: boolean) => Promise<void>;
  setWeeklySummaryEnabled: (enabled: boolean) => Promise<void>;
}

export const useNotificationStore = create<NotificationState>((set) => ({
  billRemindersEnabled: false,
  budgetAlertsEnabled: false,
  weeklySummaryEnabled: false,

  initialize: async () => {
    const [bill, budget, weekly] = await Promise.all([
      secureGet('bw_bill_reminders_enabled'),
      secureGet('bw_budget_alerts_enabled'),
      secureGet('bw_weekly_summary_enabled'),
    ]);
    set({
      billRemindersEnabled: bill === 'true',
      budgetAlertsEnabled: budget === 'true',
      weeklySummaryEnabled: weekly === 'true',
    });
  },

  setBillRemindersEnabled: async (enabled) => {
    await secureSet('bw_bill_reminders_enabled', enabled ? 'true' : 'false');
    set({ billRemindersEnabled: enabled });
  },

  setBudgetAlertsEnabled: async (enabled) => {
    await secureSet('bw_budget_alerts_enabled', enabled ? 'true' : 'false');
    set({ budgetAlertsEnabled: enabled });
  },

  setWeeklySummaryEnabled: async (enabled) => {
    await secureSet('bw_weekly_summary_enabled', enabled ? 'true' : 'false');
    set({ weeklySummaryEnabled: enabled });
  },
}));
