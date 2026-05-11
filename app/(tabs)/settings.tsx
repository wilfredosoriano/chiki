/**
 * Settings screen — appearance, security, notifications, subscription, feedback, about.
 * Design: section-based grouped rows, Label-style section headers, no icon backgrounds.
 */
import {
  View, ScrollView, Pressable, Switch, StyleSheet, Linking, Alert,
} from 'react-native';
import { Text } from '@/components/ui/Text';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@/hooks/useTheme';
import { useThemeStore } from '@/stores/themeStore';
import { useAuthStore } from '@/stores/authStore';
import { useSubscriptionStore } from '@/stores/subscriptionStore';
import { useNotificationStore } from '@/stores/notificationStore';
import { router } from 'expo-router';
import { LOCK_TIMEOUT_OPTIONS } from '@/constants';
import Constants from 'expo-constants';
import {
  requestNotificationPermission,
  scheduleLoanNotifications,
  cancelAllLoanNotifications,
  scheduleWeeklySummary,
  cancelWeeklySummary,
  cancelAllNotifications,
} from '@/utils/notifications';
import { getDatabase } from '@/db/database';
import { getActiveLoans } from '@/db/loanQueries';
import { getAllAccounts } from '@/db/accountQueries';
import { getRecentTransactions } from '@/db/transactionQueries';
import { useAccountStore } from '@/stores/accountStore';
import { useTransactionStore } from '@/stores/transactionStore';
import { seedDefaultData } from '@/db/seed';
import { exportTransactionsCSV, createBackup, restoreBackup } from '@/utils/dataExport';

const APP_VERSION    = Constants.expoConfig?.version ?? '1.0.0';
const FEEDBACK_EMAIL = 'fredsoriano1229@gmail.com';
const PRIVACY_URL    = 'https://fredsoriano1229-wq.github.io/chiki-legal/privacy.html';
const TERMS_URL      = 'https://fredsoriano1229-wq.github.io/chiki-legal/terms.html';


// ── Section label ─────────────────────────────────────────────────────────────
function SectionLabel({ title }: { title: string }) {
  const { colors } = useTheme();
  return (
    <Text style={{
      color: colors.textTertiary,
      fontSize: 11,
      fontWeight: '500',
      letterSpacing: 0.5,
      textTransform: 'uppercase',
      paddingHorizontal: 20,
      marginTop: 28,
      marginBottom: 8,
    }}>
      {title}
    </Text>
  );
}

// ── Row inside a grouped card ─────────────────────────────────────────────────
function SettingRow({
  icon, label, sublabel, right, onPress, dangerous, isLast,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  sublabel?: string;
  right?: React.ReactNode;
  onPress?: () => void;
  dangerous?: boolean;
  isLast?: boolean;
}) {
  const { colors, radius } = useTheme();
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.row,
        !isLast && { borderBottomWidth: 1, borderBottomColor: colors.border },
        { opacity: onPress && pressed ? 0.7 : 1 },
      ]}
    >
      <Ionicons name={icon} size={20} color={dangerous ? colors.expense : colors.textSecondary} />
      <View style={{ flex: 1 }}>
        <Text style={{
          color: dangerous ? colors.expense : colors.textPrimary,
          fontSize: 15,
          fontWeight: '400',
        }}>
          {label}
        </Text>
        {sublabel ? (
          <Text style={{ color: colors.textTertiary, fontSize: 12, letterSpacing: 0.2, marginTop: 1 }}>
            {sublabel}
          </Text>
        ) : null}
      </View>
      {right ?? (onPress && <Ionicons name="chevron-forward" size={16} color={colors.textTertiary} />)}
    </Pressable>
  );
}

// ── Main Screen ───────────────────────────────────────────────────────────────
export default function SettingsScreen() {
  const { colors, radius, isDark } = useTheme();
  const { mode, setMode } = useThemeStore();
  const { isBiometricEnabled, setBiometricEnabled, lockTimeoutMinutes, setLockTimeout, lock } = useAuthStore();
  const { isPremium } = useSubscriptionStore();
  const {
    billRemindersEnabled, setBillRemindersEnabled,
    budgetAlertsEnabled, setBudgetAlertsEnabled,
    weeklySummaryEnabled, setWeeklySummaryEnabled,
  } = useNotificationStore();
  const setAccounts     = useAccountStore((s) => s.setAccounts);
  const setTransactions = useTransactionStore((s) => s.setTransactions);
  const insets = useSafeAreaInsets();

  async function handleBillRemindersToggle(value: boolean) {
    if (value) {
      const granted = await requestNotificationPermission();
      if (!granted) {
        Alert.alert('Permission Required', 'Allow notifications in device Settings to enable bill reminders.', [
          { text: 'Not Now', style: 'cancel' },
          { text: 'Open Settings', onPress: () => Linking.openSettings() },
        ]);
        return;
      }
      await setBillRemindersEnabled(true);
      try {
        const db    = await getDatabase();
        const loans = await getActiveLoans(db);
        await scheduleLoanNotifications(loans);
        if (loans.length > 0) {
          Alert.alert('Bill Reminders On', `You'll be notified 3 days before each of your ${loans.length} active loan payment${loans.length > 1 ? 's' : ''}.`);
        } else {
          Alert.alert('Bill Reminders On', "You'll be notified when your loan payments are coming up.");
        }
      } catch { /* non-fatal */ }
    } else {
      await setBillRemindersEnabled(false);
      await cancelAllLoanNotifications();
    }
  }

  async function handleBudgetAlertsToggle(value: boolean) {
    if (value) {
      const granted = await requestNotificationPermission();
      if (!granted) {
        Alert.alert('Permission Required', 'Allow notifications in device Settings to enable budget alerts.', [
          { text: 'Not Now', style: 'cancel' },
          { text: 'Open Settings', onPress: () => Linking.openSettings() },
        ]);
        return;
      }
      await setBudgetAlertsEnabled(true);
      Alert.alert('Budget Alerts On', "You'll be notified when spending is close to or exceeds a budget limit.");
    } else {
      await setBudgetAlertsEnabled(false);
    }
  }

  async function handleWeeklySummaryToggle(value: boolean) {
    if (value) {
      const granted = await requestNotificationPermission();
      if (!granted) {
        Alert.alert('Permission Required', 'Allow notifications in device Settings.', [
          { text: 'Not Now', style: 'cancel' },
          { text: 'Open Settings', onPress: () => Linking.openSettings() },
        ]);
        return;
      }
      await setWeeklySummaryEnabled(true);
      await scheduleWeeklySummary();
      Alert.alert('Weekly Summary On', "You'll get a spending recap every Sunday at 8 PM.");
    } else {
      await setWeeklySummaryEnabled(false);
      await cancelWeeklySummary();
    }
  }

  function handleDeleteData() {
    Alert.alert('Delete All Data', 'This will permanently erase all your accounts, transactions, loans, budgets, and goals. This cannot be undone.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete Everything',
        style: 'destructive',
        onPress: () => Alert.alert('Are you sure?', 'This is permanent and cannot be recovered.', [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Yes, Delete All',
            style: 'destructive',
            onPress: async () => {
              try {
                const db = await getDatabase();
                for (const sql of [
                  'DELETE FROM transactions;', 'DELETE FROM budgets;',
                  'DELETE FROM savings_goals;', 'DELETE FROM loans;', 'DELETE FROM accounts;',
                ]) { await db.execAsync(sql); }
                await seedDefaultData(db);
                setAccounts([]);
                setTransactions([]);
                await cancelAllNotifications();
                await setBillRemindersEnabled(false);
                await setBudgetAlertsEnabled(false);
                await setWeeklySummaryEnabled(false);
                Alert.alert('Done', 'All data has been deleted.');
              } catch (e: unknown) {
                Alert.alert('Error', e instanceof Error ? e.message : String(e));
              }
            },
          },
        ]),
      },
    ]);
  }

  async function handleBiometricToggle(enabled: boolean) {
    await setBiometricEnabled(enabled);
    // Lock immediately when enabling so the user sees it working right away
    if (enabled) {
      lock();
      router.replace('/(auth)/lock');
    }
  }

  function handleLockTimeoutPress() {
    const labels: Record<number, string> = { 0: 'Immediately', 1: '1 minute', 5: '5 minutes', 15: '15 minutes', 30: '30 minutes' };
    const buttons = (LOCK_TIMEOUT_OPTIONS as readonly number[]).map((mins) => ({
      text: `${labels[mins] ?? `${mins} min`}${mins === lockTimeoutMinutes ? '  ✓' : ''}`,
      onPress: () => setLockTimeout(mins),
    }));
    Alert.alert('Auto-lock Timeout', 'Lock the app after this long in the background.', [
      ...buttons,
      { text: 'Cancel', style: 'cancel' },
    ]);
  }

  function lockTimeoutLabel(mins: number): string {
    if (mins === 0) return 'Immediately';
    if (mins === 1) return '1 minute';
    return `${mins} minutes`;
  }

  const groupStyle = {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    marginHorizontal: 20,
    overflow: 'hidden' as const,
    ...(isDark ? {} : { shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.04, shadowRadius: 2, elevation: 1 }),
  };


  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingTop: insets.top + 12, paddingBottom: insets.bottom + 80 }}
      >
        {/* ── Page title ── */}
        <View style={{ paddingHorizontal: 20, marginBottom: 4 }}>
          <Text style={{ color: colors.textPrimary, fontSize: 22, fontWeight: '600', letterSpacing: -0.4 }}>
            Settings
          </Text>
        </View>

        {/* ── Subscription section ── */}
        <SectionLabel title="Subscription" />
        {isPremium ? (
          <View style={[groupStyle, styles.premiumBanner]}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14 }}>
              <View style={[styles.premiumIcon, { backgroundColor: colors.accent + '22' }]}>
                <Ionicons name="star" size={18} color={colors.accent} />
              </View>
              <View style={{ flex: 1 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  <Text style={{ color: colors.textPrimary, fontWeight: '700', fontSize: 15, letterSpacing: -0.2 }}>
                    Chiki Premium
                  </Text>
                  <View style={{ backgroundColor: colors.accent + '22', borderRadius: 99, paddingHorizontal: 8, paddingVertical: 2 }}>
                    <Text style={{ color: colors.accent, fontSize: 10, fontWeight: '700', letterSpacing: 0.4 }}>ACTIVE</Text>
                  </View>
                </View>
                <Text style={{ color: colors.textTertiary, fontSize: 12, marginTop: 2 }}>
                  All features unlocked. Thank you!
                </Text>
              </View>
            </View>
          </View>
        ) : (
          <Pressable
            onPress={() => router.push('/(modals)/paywall')}
            style={({ pressed }) => [
              groupStyle,
              styles.premiumBanner,
              { backgroundColor: colors.accent, opacity: pressed ? 0.9 : 1 },
            ]}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14 }}>
              <View style={[styles.premiumIcon, { backgroundColor: 'rgba(255,255,255,0.15)' }]}>
                <Ionicons name="star" size={18} color="#fff" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ color: '#fff', fontWeight: '600', fontSize: 15, letterSpacing: -0.2 }}>
                  Upgrade to Premium
                </Text>
                <Text style={{ color: 'rgba(255,255,255,0.7)', fontSize: 12, letterSpacing: 0.2, marginTop: 2 }}>
                  Unlimited accounts, goals, charts & more
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={16} color="rgba(255,255,255,0.7)" />
            </View>
          </Pressable>
        )}

        {/* ── Security ── */}
        <SectionLabel title="Security" />
        <View style={groupStyle}>
          <SettingRow
            icon="finger-print-outline"
            label="Biometric Lock"
            sublabel="Face ID or fingerprint to unlock"
            right={
              <Switch
                value={isBiometricEnabled}
                onValueChange={handleBiometricToggle}
                trackColor={{ true: colors.accent, false: colors.border }}
                thumbColor="#fff"
              />
            }
          />
          <SettingRow
            icon="time-outline"
            label="Auto-lock Timeout"
            sublabel={lockTimeoutLabel(lockTimeoutMinutes)}
            onPress={isBiometricEnabled ? handleLockTimeoutPress : undefined}
            right={
              !isBiometricEnabled
                ? <Text style={{ color: colors.textTertiary, fontSize: 12 }}>Enable lock first</Text>
                : undefined
            }
            isLast
          />
        </View>

        {/* ── Notifications ── */}
        <SectionLabel title="Notifications" />
        <View style={groupStyle}>
          <SettingRow
            icon="notifications-outline"
            label="Bill Reminders"
            sublabel="3 days before loan payments are due"
            right={
              <Switch
                value={billRemindersEnabled}
                onValueChange={handleBillRemindersToggle}
                trackColor={{ true: colors.accent, false: colors.border }}
                thumbColor="#fff"
              />
            }
          />
          <SettingRow
            icon="trending-up-outline"
            label="Budget Alerts"
            sublabel="Notify at 80%, 90%, and over budget"
            right={
              <Switch
                value={budgetAlertsEnabled}
                onValueChange={handleBudgetAlertsToggle}
                trackColor={{ true: colors.accent, false: colors.border }}
                thumbColor="#fff"
              />
            }
          />
          <SettingRow
            icon="calendar-outline"
            label="Weekly Summary"
            sublabel="Spending recap every Sunday at 8 PM"
            isLast
            right={
              <Switch
                value={weeklySummaryEnabled}
                onValueChange={handleWeeklySummaryToggle}
                trackColor={{ true: colors.accent, false: colors.border }}
                thumbColor="#fff"
              />
            }
          />
        </View>

        {/* ── Insights ── */}
        <SectionLabel title="Insights" />
        <View style={groupStyle}>
          <SettingRow
            icon="bar-chart-outline"
            label="Analytics"
            sublabel="Charts for spending, income & trends"
            onPress={() => isPremium ? router.push('/(tabs)/analytics') : router.push('/(modals)/paywall')}
            isLast
            right={!isPremium ? <Ionicons name="lock-closed" size={15} color={colors.textTertiary} /> : undefined}
          />
        </View>

        {/* ── Data ── */}
        <SectionLabel title="Data" />
        <View style={groupStyle}>
          <SettingRow
            icon="download-outline"
            label="Export to CSV"
            sublabel="For Excel/Sheets only — cannot be restored"
            onPress={isPremium ? exportTransactionsCSV : () => router.push('/(modals)/paywall')}
            right={!isPremium ? <Ionicons name="lock-closed" size={15} color={colors.textTertiary} /> : undefined}
          />
          <SettingRow
            icon="cloud-upload-outline"
            label="Backup Data"
            sublabel="Save full backup (.json) to your phone"
            onPress={isPremium ? createBackup : () => router.push('/(modals)/paywall')}
            right={!isPremium ? <Ionicons name="lock-closed" size={15} color={colors.textTertiary} /> : undefined}
          />
          <SettingRow
            icon="cloud-download-outline"
            label="Restore Backup"
            sublabel="Select your .json backup file to restore"
            onPress={isPremium
              ? () => restoreBackup(async () => {
                  try {
                    const db = await getDatabase();
                    const freshAccounts = await getAllAccounts(db);
                    const freshTx = await getRecentTransactions(db, 50);
                    setAccounts(freshAccounts);
                    setTransactions(freshTx);
                  } catch {
                    // fallback: clear so user knows to restart
                    setAccounts([]);
                    setTransactions([]);
                  }
                })
              : () => router.push('/(modals)/paywall')
            }
            right={!isPremium ? <Ionicons name="lock-closed" size={15} color={colors.textTertiary} /> : undefined}
            isLast
          />
        </View>

        {/* ── Feedback ── */}
        <SectionLabel title="Feedback" />
        <View style={groupStyle}>
          <SettingRow
            icon="star-outline"
            label="Rate Chiki"
            sublabel="Love the app? Leave us a review"
            onPress={() => Alert.alert('Rate Chiki', 'Opens App Store / Play Store.', [
              { text: 'Cancel', style: 'cancel' },
              { text: 'Open', onPress: () => Alert.alert('Coming soon', 'Rate link available after publishing.') },
            ])}
          />
          <SettingRow
            icon="chatbubble-ellipses-outline"
            label="Send Feedback"
            sublabel="Share ideas or suggestions"
            onPress={() => Linking.openURL(`mailto:${FEEDBACK_EMAIL}?subject=Chiki Feedback`)}
          />
          <SettingRow
            icon="bug-outline"
            label="Report a Bug"
            sublabel="Help us fix issues"
            onPress={() => Linking.openURL(`mailto:${FEEDBACK_EMAIL}?subject=Bug Report - Chiki v${APP_VERSION}`)}
            isLast
          />
        </View>

        {/* ── About ── */}
        <SectionLabel title="About" />
        <View style={groupStyle}>
          <SettingRow
            icon="shield-checkmark-outline"
            label="Privacy Policy"
            onPress={() => Linking.openURL(PRIVACY_URL)}
          />
          <SettingRow
            icon="document-text-outline"
            label="Terms of Service"
            onPress={() => Linking.openURL(TERMS_URL)}
          />
          <SettingRow
            icon="information-circle-outline"
            label="App Version"
            sublabel={`v${APP_VERSION}`}
            isLast
          />
        </View>

        {/* ── Danger Zone ── */}
        <SectionLabel title="Danger Zone" />
        <View style={groupStyle}>
          <SettingRow
            icon="trash-outline"
            label="Delete All Data"
            sublabel="Permanently wipes all local data"
            onPress={handleDeleteData}
            dangerous
            isLast
          />
        </View>

        <View style={{ height: 24 }} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    paddingHorizontal: 16,
    paddingVertical: 14,
    minHeight: 56,
  },
  premiumBanner: {
    padding: 16,
  },
  premiumIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
