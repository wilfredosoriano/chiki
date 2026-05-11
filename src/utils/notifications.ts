/**
 * Local notification helpers — bill reminders, budget alerts, weekly summary.
 *
 * expo-notifications is loaded lazily via require() so the static import never
 * runs at module load time.  Expo Go (SDK 53+) blocks the module entirely, so
 * we check Constants.appOwnership before calling require() — Expo Go intercepts
 * require() at the native layer, bypassing a regular try/catch.
 */
import Constants from 'expo-constants';
import { Platform } from 'react-native';
import type { Loan } from '@/types';

const IS_EXPO_GO = Constants.appOwnership === 'expo';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function notif(): any | null {
  if (IS_EXPO_GO) return null;
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    return require('expo-notifications');
  } catch {
    return null;
  }
}

// ─── Setup ─────────────────────────────────────────────────────────────────

/** Call once at app startup inside useEffect. No-op in Expo Go. */
export function setupNotificationHandler(): void {
  try {
    const N = notif();
    if (!N) return;
    N.setNotificationHandler({
      handleNotification: async () => ({
        shouldShowBanner: true,
        shouldShowList: true,
        shouldPlaySound: true,
        shouldSetBadge: false,
      }),
    });
  } catch { /* Expo Go */ }
}

// ─── Permissions ───────────────────────────────────────────────────────────

/** Request permission. Returns true if granted. */
export async function requestNotificationPermission(): Promise<boolean> {
  try {
    const N = notif();
    if (!N) return false;
    if (Platform.OS === 'android') {
      await N.setNotificationChannelAsync('chiki', {
        name: 'Chiki Alerts',
        importance: N.AndroidImportance.HIGH,
        sound: 'default',
        vibrationPattern: [0, 250, 250, 250],
      });
    }
    const { status: existing } = await N.getPermissionsAsync();
    if (existing === 'granted') return true;
    const { status } = await N.requestPermissionsAsync();
    return status === 'granted';
  } catch {
    return false;
  }
}

// ─── Loan / Bill reminders ─────────────────────────────────────────────────

export async function cancelAllLoanNotifications(): Promise<void> {
  try {
    const N = notif();
    if (!N) return;
    const all = await N.getAllScheduledNotificationsAsync();
    await Promise.all(
      all
        .filter((n: { identifier: string }) => n.identifier.startsWith('loan_'))
        .map((n: { identifier: string }) => N.cancelScheduledNotificationAsync(n.identifier))
    );
  } catch { /* Expo Go */ }
}

export async function cancelLoanNotification(loanId: string): Promise<void> {
  try {
    const N = notif();
    if (!N) return;
    await N.cancelScheduledNotificationAsync(`loan_${loanId}`);
  } catch { /* Expo Go */ }
}

/**
 * Schedule a monthly notification per active loan — fires 3 days before the
 * due day at 9 AM every month.
 */
export async function scheduleLoanNotifications(loans: Loan[]): Promise<void> {
  try {
    const N = notif();
    if (!N) return;
    await cancelAllLoanNotifications();
    for (const loan of loans) {
      if (!loan.isActive) continue;
      const notifyDay = Math.max(1, loan.dueDayOfMonth - 3);
      const daysAhead = loan.dueDayOfMonth - notifyDay;
      const dueText = daysAhead === 0 ? 'today' : daysAhead === 1 ? 'tomorrow' : `in ${daysAhead} days`;
      const amount = loan.monthlyPayment.toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
      await N.scheduleNotificationAsync({
        identifier: `loan_${loan.id}`,
        content: {
          title: '💳 Loan Payment Due Soon',
          body: `${loan.name} payment of ₱${amount} is due ${dueText}.`,
          sound: 'default',
          data: { loanId: loan.id },
          ...(Platform.OS === 'android' && { channelId: 'chiki' }),
        },
        trigger: {
          type: N.SchedulableTriggerInputTypes.CALENDAR,
          day: notifyDay,
          hour: 9,
          minute: 0,
          repeats: true,
        },
      });
    }
  } catch { /* Expo Go */ }
}

// ─── Budget alerts ─────────────────────────────────────────────────────────

/**
 * Send an immediate notification when a category budget is near or exceeded.
 * Only fires at ≥80%, ≥90%, or ≥100% thresholds.
 */
export async function sendBudgetAlert(
  categoryName: string,
  spent: number,
  budget: number
): Promise<void> {
  try {
    const N = notif();
    if (!N) return;

    const ratio = spent / budget;
    const pct = Math.round(ratio * 100);
    const remaining = (budget - spent).toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

    let title: string;
    let body: string;

    if (ratio >= 1) {
      title = '🚨 Budget Exceeded';
      body = `You've gone over your ${categoryName} budget (${pct}% used).`;
    } else if (ratio >= 0.9) {
      title = '⚠️ Almost at Budget Limit';
      body = `${categoryName} is ${pct}% used — only ₱${remaining} left.`;
    } else if (ratio >= 0.8) {
      title = '💡 Budget Alert';
      body = `${categoryName} budget is ${pct}% used.`;
    } else {
      return; // below 80% — no alert
    }

    await N.scheduleNotificationAsync({
      content: {
        title,
        body,
        sound: 'default',
        ...(Platform.OS === 'android' && { channelId: 'chiki' }),
      },
      trigger: null, // fire immediately
    });
  } catch { /* Expo Go */ }
}

// ─── Weekly summary ────────────────────────────────────────────────────────

/** Schedule a recurring Sunday 8 PM reminder to review weekly spending. */
export async function scheduleWeeklySummary(): Promise<void> {
  try {
    const N = notif();
    if (!N) return;
    await N.cancelScheduledNotificationAsync('weekly_summary');
    await N.scheduleNotificationAsync({
      identifier: 'weekly_summary',
      content: {
        title: '📊 Weekly Spending Summary',
        body: "How did you do this week? Tap to review your expenses and income.",
        sound: 'default',
        ...(Platform.OS === 'android' && { channelId: 'chiki' }),
      },
      trigger: {
        type: N.SchedulableTriggerInputTypes.CALENDAR,
        weekday: 1, // 1 = Sunday
        hour: 20,
        minute: 0,
        repeats: true,
      },
    });
  } catch { /* Expo Go */ }
}

export async function cancelWeeklySummary(): Promise<void> {
  try {
    const N = notif();
    if (!N) return;
    await N.cancelScheduledNotificationAsync('weekly_summary');
  } catch { /* Expo Go */ }
}

// ─── Cancel everything ─────────────────────────────────────────────────────

/** Cancel ALL scheduled notifications (used on delete-all-data). */
export async function cancelAllNotifications(): Promise<void> {
  try {
    const N = notif();
    if (!N) return;
    await N.cancelAllScheduledNotificationsAsync();
  } catch { /* Expo Go */ }
}
