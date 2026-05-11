/**
 * Dashboard — net worth, mini account cards, quick actions, recent transactions.
 * Design: restraint over decoration. Data-dense but calm.
 */
import { ScrollView, FlatList, View, Pressable, StyleSheet, Dimensions, Animated, Image } from 'react-native';
import { Text } from '@/components/ui/Text';
import { useRef, useState, useCallback, useMemo } from 'react';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { router, useFocusEffect } from 'expo-router';
import { useTheme } from '@/hooks/useTheme';
import { useAccountStore } from '@/stores/accountStore';
import { useTransactionStore } from '@/stores/transactionStore';
import { useAlertStore } from '@/stores/alertStore';
import { useSubscriptionStore } from '@/stores/subscriptionStore';
import { PhysicalCard } from '@/components/ui/PhysicalCard';
import { SectionHeader } from '@/components/ui/SectionHeader';
import { NotificationPanel } from '@/components/NotificationPanel';
import { format } from '@/utils/dateUtils';
import { DEFAULT_EXPENSE_CATEGORIES, DEFAULT_INCOME_CATEGORIES } from '@/constants';
import { TransactionDetailSheet } from '@/components/ui/TransactionDetailSheet';
import type { Transaction, Category } from '@/types';
import { getDatabase } from '@/db/database';
import { getBudgetsByMonth } from '@/db/budgetQueries';
import { getAllLoans } from '@/db/loanQueries';
import { getAllGoals } from '@/db/goalQueries';
import { generateAlerts } from '@/utils/generateAlerts';
import { generateInsights, type Insight } from '@/utils/generateInsights';

const CATEGORY_NAMES: Record<string, string> = {};
[...DEFAULT_EXPENSE_CATEGORIES, ...DEFAULT_INCOME_CATEGORIES].forEach((c) => {
  CATEGORY_NAMES[c.id] = c.name;
});

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const CARD_WIDTH = SCREEN_WIDTH - 48;

function formatCurrency(amount: number) {
  const abs = Math.abs(amount);
  return (amount < 0 ? '-' : '') + '₱' + abs.toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function getGreeting() {
  const h = new Date().getHours();
  if (h < 12) return 'Good morning';
  if (h < 17) return 'Good afternoon';
  return 'Good evening';
}

function getDateLabel() {
  return format(new Date(), 'EEEE, MMM d, yyyy');
}

// ── Chiki net worth mood ──────────────────────────────────────────────────────

interface ChikiMood { image: ReturnType<typeof require>; label: string; color: string; bg: string; }

function getNetWorthMood(
  netWorth: number,
  netMonthly: number,
  transactions: ReturnType<typeof useTransactionStore.getState>['transactions'],
  totalLoanBalance: number,
): ChikiMood {
  const now = new Date();
  const thisMonthPrefix = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  const dayOfMonth = now.getDate();

  const thisMonthExpenses = transactions.filter(
    (t) => t.type === 'expense' && t.date.startsWith(thisMonthPrefix)
  );
  const totalThisMonth = thisMonthExpenses.reduce((s, t) => s + t.amount, 0);

  // Only project after at least 10 days so early-month data doesn't skew it
  const projectedMonthEnd = dayOfMonth >= 10 ? (totalThisMonth / dayOfMonth) * 30 : 0;

  const thisMonthIncome = transactions
    .filter((t) => t.type === 'income' && t.date.startsWith(thisMonthPrefix) && t.note !== 'Initial Balance')
    .reduce((s, t) => s + t.amount, 0);

  // Only warn if: we have income recorded, projected spend > 1.4x income, AND deficit > 20% of net worth
  const burningFast = projectedMonthEnd > 0
    && thisMonthIncome > 0
    && projectedMonthEnd > thisMonthIncome * 1.4
    && Math.abs(netMonthly) / Math.max(netWorth, 1) > 0.2;

  // Zero transactions this month
  const noActivity = thisMonthExpenses.length === 0;

  // No money added yet
  if (netWorth === 0 && totalLoanBalance === 0)
    return { image: require('../../assets/images/mood/idle.png'), label: "Uy wala pa palang pera dito! Ilagay mo na ang pera mo para masubaybayan natin kung saan napupunta. Kaya mo 'yan!", color: '#A1A1AA', bg: '#A1A1AA18' };

  // Total loans exceed net worth — drowning in debt
  if (totalLoanBalance > 0 && totalLoanBalance > netWorth)
    return { image: require('../../assets/images/mood/sad.png'), label: `Nako pre, ang utang mo na ₱${totalLoanBalance.toLocaleString('en-PH', { maximumFractionDigits: 0 })} ay mas malaki pa sa net worth mo! Kailangan nating mag-focus sa pagbabayad ng utang. Kayang kaya 'yan!`, color: '#F87171', bg: '#F8717118' };

  // Burning through money fast this month
  if (burningFast)
    return { image: require('../../assets/images/mood/shock.png'), label: `Sa bilis ng gastos mo, mauubos na lahat bago pa matapos ang buwan! Projected mo pang ₱${projectedMonthEnd.toLocaleString('en-PH', { maximumFractionDigits: 0 })} ang mapupunta. May butas ba ang bulsa mo pre?`, color: '#F87171', bg: '#F8717118' };

  // Expenses exist but no income recorded — spending from savings
  if (netMonthly < 0 && thisMonthIncome === 0)
    return { image: require('../../assets/images/mood/neutral.png'), label: `May gastos ka na ngayong buwan pero wala pang recorded na kita. Siguruhing i-log mo rin ang iyong kita ha!`, color: '#A1A1AA', bg: '#A1A1AA18' };

  // Negative month with income recorded — tiered by how bad the deficit is
  if (netMonthly < 0 && thisMonthIncome > 0) {
    const deficit = Math.abs(netMonthly);
    // Spending is more than double the income → serious
    if (totalThisMonth > thisMonthIncome * 2)
      return { image: require('../../assets/images/mood/shock.png'), label: `Pre, ₱${deficit.toLocaleString('en-PH', { maximumFractionDigits: 0 })} na ang lugi mo ngayong buwan at doble pa sa kita mo ang ginastos mo! Seryosohin na natin ito ha.`, color: '#F87171', bg: '#F8717118' };
    // Spending exceeds income by 20%+ → noticeable warning
    if (totalThisMonth > thisMonthIncome * 1.2)
      return { image: require('../../assets/images/mood/sad.png'), label: `Huy, ₱${deficit.toLocaleString('en-PH', { maximumFractionDigits: 0 })} na ang baba ngayong buwan at lumagpas ka na sa kita mo! Mag-ingat na tayo, baka lumala pa.`, color: '#FB923C', bg: '#FB923C18' };
    // Mild — spending slightly over income
    return { image: require('../../assets/images/mood/spending.png'), label: `Konting baba lang ngayong buwan (₱${deficit.toLocaleString('en-PH', { maximumFractionDigits: 0 })}), hindi pa malala. Pero mag-ingat na tayo ha, baka lumala pa.`, color: '#FCD34D', bg: '#FCD34D18' };
  }

  // No activity yet
  if (noActivity)
    return { image: require('../../assets/images/mood/neutral.png'), label: "Wala pa akong nakitang gastos ngayong buwan. Okay lang, baka nag-iimpok ka na? O natutulog lang? Haha!", color: '#A1A1AA', bg: '#A1A1AA18' };

  // Growing fast
  if (netMonthly > 0 && netMonthly / Math.max(netWorth, 1) > 0.05)
    return { image: require('../../assets/images/mood/success.png'), label: `Grabe ka talaga! Tumaas ng ₱${netMonthly.toLocaleString('en-PH', { maximumFractionDigits: 0 })} ang net worth mo ngayong buwan. Slay!`, color: '#4ADE80', bg: '#4ADE8018' };

  // Normal positive
  if (netMonthly > 0)
    return { image: require('../../assets/images/mood/happy.png'), label: `Okay naman! Tumataba na ang pitaka mo ng ₱${netMonthly.toLocaleString('en-PH', { maximumFractionDigits: 0 })} ngayong buwan.`, color: '#4ADE80', bg: '#4ADE8018' };

  // Neutral — no change
  return { image: require('../../assets/images/mood/neutral.png'), label: "Wala pang galaw ngayong buwan. Sige, mag-log na ng kita at gastos para makita natin ang progress mo!", color: '#A1A1AA', bg: '#A1A1AA18' };
}

// ─── Chiki mood image map (insights) ─────────────────────────────────────────
// Keyed by accentColor. Keep a separate default so the ?? fallback always works
// (TypeScript types Record<string,T> as non-nullable, so obj[missingKey] returns
//  undefined at runtime but TS won't warn — a plain const avoids the silent failure).
const CHIKI_MOOD_IMAGE: Record<string, ReturnType<typeof require>> = {
  '#166534': require('../../assets/images/mood/success.png'),   // positive / on-track
  '#92400E': require('../../assets/images/mood/shock.png'),     // warning / projection
  '#991B1B': require('../../assets/images/mood/sad.png'),       // over budget / bad
  '#B45309': require('../../assets/images/mood/spending.png'),  // spending heavy
  '#4C1D95': require('../../assets/images/mood/thinking.png'),  // weekend pattern
  '#1E3A5F': require('../../assets/images/mood/motivation.png'),// weekday pattern
};
const CHIKI_MOOD_DEFAULT = require('../../assets/images/mood/neutral.png');

function ChikiNetWorthMood({ netWorth, netMonthly, transactions, totalLoanBalance, categoryNames, colors, shadow, isDark }: {
  netWorth: number; netMonthly: number;
  transactions: ReturnType<typeof useTransactionStore.getState>['transactions'];
  totalLoanBalance: number;
  categoryNames: Record<string, string>;
  colors: any; shadow: any; isDark: boolean;
}) {
  const mood = getNetWorthMood(netWorth, netMonthly, transactions, totalLoanBalance);
  return (
    <View style={{
      flexDirection: 'row', alignItems: 'center', gap: 10,
      marginTop: 16, marginHorizontal: 20,
    }}>
      <Image source={mood.image} style={{ width: 120, height: 120 }} resizeMode="contain" />
      {/* Speech bubble */}
      <View style={{
        flex: 1, flexDirection: 'row', alignItems: 'center',
        backgroundColor: colors.surface,
        borderRadius: 16,
        borderBottomLeftRadius: 4,
        paddingHorizontal: 12,
        paddingVertical: 10,
        minHeight: 60,
      }}>
        <Text style={{ color: colors.textPrimary, fontSize: 12, fontWeight: '500', flex: 1, lineHeight: 17 }}>
          {mood.label}
        </Text>
      </View>
    </View>
  );
}

// Pressable row that scales on press
function PressableRow({
  onPress,
  onLongPress,
  children,
  style,
}: {
  onPress: () => void;
  onLongPress?: () => void;
  children: React.ReactNode;
  style?: object;
}) {
  const scale = useRef(new Animated.Value(1)).current;
  const opacity = useRef(new Animated.Value(1)).current;
  function pressIn() {
    Animated.parallel([
      Animated.spring(scale, { toValue: 0.97, useNativeDriver: true, speed: 50, bounciness: 0 }),
      Animated.timing(opacity, { toValue: 0.85, useNativeDriver: true, duration: 80 }),
    ]).start();
  }
  function pressOut() {
    Animated.parallel([
      Animated.spring(scale, { toValue: 1, useNativeDriver: true, speed: 50, bounciness: 4 }),
      Animated.timing(opacity, { toValue: 1, useNativeDriver: true, duration: 80 }),
    ]).start();
  }
  return (
    <Pressable
      onPress={onPress}
      onLongPress={onLongPress}
      delayLongPress={300}
      onPressIn={pressIn}
      onPressOut={pressOut}
    >
      <Animated.View style={[style, { transform: [{ scale }], opacity }]}>
        {children}
      </Animated.View>
    </Pressable>
  );
}

export default function DashboardScreen() {
  const { colors, spacing, radius, shadow, isDark } = useTheme();
  const insets = useSafeAreaInsets();
  const { accounts, getNetWorth } = useAccountStore();
  const { transactions } = useTransactionStore();
  const alertStore = useAlertStore();
  const unreadCount = alertStore.getUnreadCount();
  const isPremium = useSubscriptionStore((s) => s.isPremium);

  const [showNotifications, setShowNotifications] = useState(false);
  const [insights, setInsights] = useState<Insight[]>([]);
  const [totalLoanBalance, setTotalLoanBalance] = useState(0);
  const [selectedTx, setSelectedTx] = useState<Transaction | null>(null);
  const [detailVisible, setDetailVisible] = useState(false);

  const categoryMap = useMemo(() => {
    const m = new Map<string, Category>();
    [...DEFAULT_EXPENSE_CATEGORIES, ...DEFAULT_INCOME_CATEGORIES].forEach((c) => {
      m.set(c.id, c as Category);
    });
    return m;
  }, []);

  useFocusEffect(
    useCallback(() => {
      let active = true;
      (async () => {
        try {
          const now = new Date();
          const db = await getDatabase();
          const [budgets, loans, goals] = await Promise.all([
            getBudgetsByMonth(db, now.getFullYear(), now.getMonth() + 1),
            getAllLoans(db),
            getAllGoals(db),
          ]);
          if (!active) return;

          const activeLoans = loans.filter((l) => l.isActive);
          setTotalLoanBalance(activeLoans.reduce((s, l) => s + l.remainingBalance, 0));

          const alerts = generateAlerts({
            budgets, transactions, loans, goals,
            categoryNames: CATEGORY_NAMES,
          });
          await alertStore.setAlerts(alerts);

          const newInsights = generateInsights({
            transactions, budgets, loans, goals, accounts,
            categoryNames: CATEGORY_NAMES,
          });
          setInsights(newInsights);
        } catch {
          // non-critical — silently skip
        }
      })();
      return () => { active = false; };
    }, [transactions, accounts])
  );

  const netWorth = getNetWorth();
  const now = new Date();

  const thisMonthExpenses = transactions
    .filter((t) => t.type === 'expense' && t.date.startsWith(format(now, 'yyyy-MM')))
    .reduce((sum, t) => sum + t.amount, 0);

  const thisMonthIncome = transactions
    .filter((t) => t.type === 'income' && t.date.startsWith(format(now, 'yyyy-MM')) && t.note !== 'Initial Balance')
    .reduce((sum, t) => sum + t.amount, 0);

  const netMonthly = thisMonthIncome - thisMonthExpenses;

  const recentTransactions = [...transactions]
    .sort((a, b) => b.date.localeCompare(a.date))
    .slice(0, 8);

  // Account type → accent color for mini cards
  const accountColor = (type: string) => {
    switch (type) {
      case 'savings':    return isDark ? '#4ADE80' : '#16A34A';
      case 'investment': return isDark ? '#9B9EA1' : '#5F6266';
      case 'cash':       return isDark ? '#FCD34D' : '#D97706';
      default:           return isDark ? '#A1A1AA' : '#71717A';
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <NotificationPanel
        visible={showNotifications}
        onClose={() => setShowNotifications(false)}
      />
      <TransactionDetailSheet
        transaction={selectedTx}
        visible={detailVisible}
        onClose={() => setDetailVisible(false)}
        onDelete={() => setDetailVisible(false)}
        categories={categoryMap}
        accounts={accounts}
      />

      <ScrollView
        contentContainerStyle={{ paddingTop: insets.top + 16, paddingBottom: insets.bottom + 80 }}
        showsVerticalScrollIndicator={false}
      >

        {/* ── Header ── */}
        <View style={[styles.header, { paddingHorizontal: 20 }]}>
          {/* Left: date + greeting */}
          <View style={{ gap: 2 }}>
            <Text style={{ color: colors.textTertiary, fontSize: 11, fontWeight: '500', letterSpacing: 0.3 }}>
              {getDateLabel()}
            </Text>
            <Text style={{ color: colors.textPrimary, fontSize: 20, fontWeight: '700', letterSpacing: -0.4 }}>
              {getGreeting()} 👋
            </Text>
          </View>

          {/* Right: chat + notification bell */}
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
            <Pressable
              onPress={() => isPremium
                ? router.push('/(modals)/chiki-chat')
                : router.push('/(modals)/paywall')
              }
              style={({ pressed }) => ({ opacity: pressed ? 0.6 : 1, padding: 4 })}
            >
              <View style={{ position: 'relative' }}>
                <Ionicons name="chatbubble-ellipses-outline" size={22} color={colors.textSecondary} />
                {!isPremium && (
                  <View style={[styles.lockBadge, { backgroundColor: colors.accent }]}>
                    <Ionicons name="lock-closed" size={7} color="#fff" />
                  </View>
                )}
              </View>
            </Pressable>
            <Pressable
              onPress={() => setShowNotifications(true)}
              style={({ pressed }) => ({ opacity: pressed ? 0.6 : 1, padding: 4 })}
            >
              <View style={{ position: 'relative' }}>
                <Ionicons name="notifications-outline" size={22} color={colors.textSecondary} />
                {unreadCount > 0 && (
                  <View style={[styles.bellBadge, { backgroundColor: colors.expense }]} />
                )}
              </View>
            </Pressable>
          </View>
        </View>

        {/* ── Net Worth ── */}
        <View style={[styles.netWorthSection, { paddingHorizontal: 20, marginTop: 28 }]}>
          <Text style={{ color: colors.textTertiary, fontSize: 11, fontWeight: '500', letterSpacing: 0.5, textTransform: 'uppercase' }}>
            Net Worth
          </Text>
          <Text style={{ color: colors.textPrimary, fontSize: 40, fontWeight: '700', letterSpacing: -1.5, marginTop: 6 }}>
            {formatCurrency(netWorth)}
          </Text>
          {/* Monthly delta badge */}
          <View style={[styles.deltaBadge, {
            backgroundColor: netMonthly >= 0 ? colors.income + '18' : colors.expense + '18',
            marginTop: 10,
          }]}>
            <Ionicons
              name={netMonthly >= 0 ? 'trending-up' : 'trending-down'}
              size={13}
              color={netMonthly >= 0 ? colors.income : colors.expense}
            />
            <Text style={{ color: netMonthly >= 0 ? colors.income : colors.expense, fontSize: 12, fontWeight: '500' }}>
              {netMonthly >= 0 ? '+' : ''}{formatCurrency(netMonthly)} this month
            </Text>
          </View>
        </View>

        {/* ── Chiki mood message ── */}
        <ChikiNetWorthMood netWorth={netWorth} netMonthly={netMonthly} transactions={transactions} totalLoanBalance={totalLoanBalance} categoryNames={CATEGORY_NAMES} colors={colors} shadow={shadow} isDark={isDark} />

        {/* ── Income / Expense Summary Card ── */}
        {(() => {
          const savingsRate = thisMonthIncome > 0
            ? Math.max(0, ((thisMonthIncome - thisMonthExpenses) / thisMonthIncome) * 100)
            : 0;
          const isOver = thisMonthExpenses > thisMonthIncome && thisMonthIncome > 0;

          return (
            <View style={{
              marginHorizontal: 20,
              marginTop: 20,
              backgroundColor: '#082D20',
              borderRadius: radius.xl,
              overflow: 'hidden',
              ...(isDark ? {} : shadow.md),
            }}>
              {/* Top label row */}
              <View style={{ paddingHorizontal: 16, paddingTop: 14, paddingBottom: 2, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                <Text style={{ color: 'rgba(255,255,255,0.40)', fontSize: 10, fontWeight: '600', letterSpacing: 0.8, textTransform: 'uppercase' }}>
                  This Month
                </Text>
                {thisMonthIncome > 0 && (
                  <View style={{
                    flexDirection: 'row', alignItems: 'center', gap: 4,
                    backgroundColor: isOver ? 'rgba(240,100,80,0.18)' : 'rgba(255,186,0,0.15)',
                    paddingHorizontal: 8, paddingVertical: 3, borderRadius: 9999,
                  }}>
                    <Ionicons
                      name={isOver ? 'warning-outline' : 'leaf-outline'}
                      size={10}
                      color={isOver ? '#F5A49A' : '#FFBA00'}
                    />
                    <Text style={{ color: isOver ? '#F5A49A' : '#FFBA00', fontSize: 10, fontWeight: '600' }}>
                      {isOver ? 'Over budget' : `Saved ${savingsRate.toFixed(0)}%`}
                    </Text>
                  </View>
                )}
              </View>

              {/* Two columns */}
              <View style={{ flexDirection: 'row', paddingHorizontal: 4, paddingBottom: 4 }}>
                {/* Income */}
                <View style={{ flex: 1, padding: 12 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 7 }}>
                    <View style={{
                      width: 22, height: 22, borderRadius: 11,
                      backgroundColor: 'rgba(255,186,0,0.18)',
                      alignItems: 'center', justifyContent: 'center',
                    }}>
                      <Ionicons name="arrow-up" size={11} color="#FFBA00" />
                    </View>
                    <Text style={{ color: 'rgba(255,255,255,0.50)', fontSize: 10, fontWeight: '600', letterSpacing: 0.4, textTransform: 'uppercase' }}>
                      Income
                    </Text>
                  </View>
                  <Text style={{ color: '#FFBA00', fontSize: 19, fontWeight: '700', letterSpacing: -0.4 }}>
                    {formatCurrency(thisMonthIncome)}
                  </Text>
                </View>

                {/* Divider */}
                <View style={{ width: 1, backgroundColor: 'rgba(255,255,255,0.08)', marginVertical: 10 }} />

                {/* Expenses */}
                <View style={{ flex: 1, padding: 12 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 7 }}>
                    <View style={{
                      width: 22, height: 22, borderRadius: 11,
                      backgroundColor: 'rgba(240,100,80,0.18)',
                      alignItems: 'center', justifyContent: 'center',
                    }}>
                      <Ionicons name="arrow-down" size={11} color="#F5A49A" />
                    </View>
                    <Text style={{ color: 'rgba(255,255,255,0.50)', fontSize: 10, fontWeight: '600', letterSpacing: 0.4, textTransform: 'uppercase' }}>
                      Expenses
                    </Text>
                  </View>
                  <Text style={{ color: '#F5A49A', fontSize: 19, fontWeight: '700', letterSpacing: -0.4 }}>
                    {formatCurrency(thisMonthExpenses)}
                  </Text>
                </View>
              </View>

            </View>
          );
        })()}

        {/* ── Quick Actions ── */}
        <View style={[styles.quickActions, { marginHorizontal: 20, marginTop: 24 }]}>
          {([
            { label: 'Expense',  icon: 'remove-circle-outline'   as const, route: '/(modals)/add-transaction?type=expense'  },
            { label: 'Income',   icon: 'add-circle-outline'      as const, route: '/(modals)/add-transaction?type=income'   },
            { label: 'Transfer', icon: 'swap-horizontal-outline' as const, route: '/(modals)/add-transaction?type=transfer' },
            { label: 'Budget',   icon: 'pie-chart-outline'       as const, route: '/(modals)/add-budget'                    },
          ] as const).map((action) => (
            <Pressable
              key={action.label}
              onPress={() => router.push(action.route as any)}
              style={({ pressed }) => [
                styles.quickBtn,
                {
                  backgroundColor: '#082D20',
                  borderRadius: radius.lg,
                  opacity: pressed ? 0.7 : 1,
                  shadowColor: '#000',
                  shadowOffset: { width: 0, height: 4 },
                  shadowOpacity: 0.15,
                  shadowRadius: 10,
                  elevation: 4,
                },
              ]}
            >
              <View style={[styles.quickIconCircle, { backgroundColor: 'rgba(255,186,0,0.15)' }]}>
                <Ionicons name={action.icon} size={20} color="#FFBA00" />
              </View>
              <Text style={{ color: 'rgba(255,255,255,0.70)', fontSize: 11, fontWeight: '500', marginTop: 6 }}>
                {action.label}
              </Text>
            </Pressable>
          ))}
        </View>

        {/* ── Chiki's Insights ── */}
        {isPremium && insights.length > 0 && (
          <View style={{ marginTop: 28 }}>
            {/* Header with Chiki mascot */}
            <View style={[styles.sectionRow, { paddingHorizontal: 20, marginBottom: 12 }]}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <View>
                  <Text style={{ color: colors.textPrimary, fontSize: 13, fontWeight: '700', letterSpacing: -0.2 }}>
                    Chiki's Insights
                  </Text>
                  <Text style={{ color: colors.textTertiary, fontSize: 11, fontWeight: '400' }}>
                    {insights.length} {insights.length === 1 ? 'insight' : 'insights'} for you
                  </Text>
                </View>
              </View>
            </View>

            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              decelerationRate="fast"
              contentContainerStyle={{ paddingHorizontal: 20, gap: 10, paddingBottom: 2 }}
            >
              {insights.map((insight) => {
                const moodImage = CHIKI_MOOD_IMAGE[insight.accentColor] ?? CHIKI_MOOD_DEFAULT;

                return (
                  <View
                    key={insight.id}
                    style={[
                      styles.insightCard,
                      {
                        backgroundColor: colors.surface,
                        borderColor: colors.border,
                        borderRadius: radius.xl,
                        ...(isDark ? {} : shadow.md),
                      },
                    ]}
                  >
                    {/* Icon row */}
                    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
                      <View style={[styles.insightIconBubble, { backgroundColor: insight.accentColor + '18' }]}>
                        <Ionicons name={insight.icon as any} size={16} color={insight.accentColor} />
                      </View>
                      <Image source={moodImage} style={{ width: 90, height: 90, opacity: 0.90 }} resizeMode="contain" />
                    </View>

                    {/* Title */}
                    <Text
                      style={{ color: colors.textPrimary, fontSize: 13, fontWeight: '700', letterSpacing: -0.3, lineHeight: 19, marginBottom: 5 }}
                      numberOfLines={2}
                    >
                      {insight.title}
                    </Text>

                    {/* Body */}
                    <Text
                      style={{ color: colors.textSecondary, fontSize: 11.5, lineHeight: 16 }}
                      numberOfLines={2}
                    >
                      {insight.body}
                    </Text>
                  </View>
                );
              })}
            </ScrollView>
          </View>
        )}

        {/* ── My Accounts ── */}
        <View style={{ marginTop: 32 }}>
          <View style={[styles.sectionRow, { paddingHorizontal: 20 }]}>
            <Text style={{ color: colors.textTertiary, fontSize: 11, fontWeight: '500', letterSpacing: 0.5, textTransform: 'uppercase' }}>
              My Accounts
            </Text>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              {accounts.length > 0 && (
                <Pressable
                  onPress={() => router.push('/(modals)/all-accounts')}
                  style={({ pressed }) => [styles.addChip, { backgroundColor: '#082D20', opacity: pressed ? 0.7 : 1 }]}
                >
                  <Text style={{ color: '#FFBA00', fontSize: 11, fontWeight: '500' }}>See all</Text>
                </Pressable>
              )}
              <Pressable
                onPress={() => router.push('/(modals)/add-account')}
                style={({ pressed }) => [styles.addChip, { backgroundColor: '#082D20', opacity: pressed ? 0.7 : 1 }]}
              >
                <Ionicons name="add" size={14} color="#FFBA00" />
                <Text style={{ color: '#FFBA00', fontSize: 11, fontWeight: '500' }}>Add</Text>
              </Pressable>
            </View>
          </View>

          {accounts.length === 0 ? (
            <Pressable
              style={({ pressed }) => [
                styles.emptyCard,
                {
                  marginHorizontal: 20,
                  marginTop: 12,
                  backgroundColor: colors.surface,
                  borderRadius: radius.lg,
                  borderWidth: 1,
                  borderColor: colors.border,
                  opacity: pressed ? 0.7 : 1,
                },
              ]}
              onPress={() => router.push('/(modals)/add-account')}
            >
              <View style={[styles.emptyIcon, { backgroundColor: colors.surfaceElevated }]}>
                <Ionicons name="card-outline" size={22} color={colors.textTertiary} />
              </View>
              <Text style={{ color: colors.textTertiary, fontSize: 13, marginTop: 10 }}>
                Add your first account
              </Text>
            </Pressable>
          ) : (
            <FlatList
              data={accounts}
              keyExtractor={(item) => item.id}
              horizontal
              pagingEnabled
              showsHorizontalScrollIndicator={false}
              snapToAlignment="center"
              decelerationRate="fast"
              contentContainerStyle={{ paddingHorizontal: 20, gap: 12, paddingTop: 12, paddingBottom: 4 }}
              renderItem={({ item }) => (
                <View style={{ width: CARD_WIDTH }}>
                  <PhysicalCard account={item} />
                </View>
              )}
            />
          )}

          {accounts.length > 1 && (
            <View style={styles.dots}>
              {accounts.map((_, i) => (
                <View key={i} style={[styles.dot, { backgroundColor: i === 0 ? colors.accent : colors.border }]} />
              ))}
            </View>
          )}
        </View>

        {/* ── Recent Transactions ── */}
        <View style={{ paddingHorizontal: 20 }}>
          <SectionHeader
            title="Recent Transactions"
            actionLabel="See all"
            onAction={() => router.navigate('/(tabs)/transactions')}
          />

          {recentTransactions.length === 0 ? (
            <View style={[styles.emptyTxCard, {
              backgroundColor: colors.surface,
              borderRadius: radius.lg,
              borderWidth: 1,
              borderColor: colors.border,
            }]}>
              <Text style={{ color: colors.textTertiary, fontSize: 13, textAlign: 'center' }}>
                No transactions yet.
              </Text>
            </View>
          ) : (
            <View style={{
              backgroundColor: colors.surface,
              borderRadius: radius.lg,
              borderWidth: 1,
              borderColor: colors.border,
              overflow: 'hidden',
              ...(isDark ? {} : shadow.sm),
            }}>
              {recentTransactions.map((t, idx) => {
                const isLast = idx === recentTransactions.length - 1;
                const txColor = t.type === 'income' ? colors.income : t.type === 'expense' ? colors.expense : colors.accent;
                return (
                  <PressableRow
                    key={t.id}
                    onPress={() => {}}
                    onLongPress={() => { setSelectedTx(t); setDetailVisible(true); }}
                    style={{}}
                  >
                    <View style={[styles.txRow, !isLast && { borderBottomWidth: 1, borderBottomColor: colors.border }]}>
                      {/* Category icon circle */}
                      <View style={[styles.txIconCircle, { backgroundColor: colors.surfaceElevated }]}>
                        <Ionicons
                          name={t.type === 'income' ? 'arrow-up' : t.type === 'expense' ? 'arrow-down' : 'swap-horizontal'}
                          size={16}
                          color={txColor}
                        />
                      </View>
                      {/* Name + date */}
                      <View style={{ flex: 1 }}>
                        <Text style={{ color: colors.textPrimary, fontSize: 15, fontWeight: '500' }} numberOfLines={1} ellipsizeMode="tail">
                          {t.note ?? CATEGORY_NAMES[t.categoryId] ?? t.categoryId}
                        </Text>
                        <Text style={{ color: colors.textTertiary, fontSize: 12, letterSpacing: 0.2, marginTop: 1 }}>
                          {format(new Date(t.date), 'MMM d, yyyy')}
                        </Text>
                      </View>
                      {/* Amount */}
                      <Text style={{ color: txColor, fontSize: 15, fontWeight: '600', letterSpacing: -0.2 }}>
                        {t.type === 'income' ? '+' : t.type === 'expense' ? '-' : ''}{formatCurrency(t.amount)}
                      </Text>
                    </View>
                  </PressableRow>
                );
              })}
            </View>
          )}
        </View>

      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  netWorthSection: {},
  deltaBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    alignSelf: 'flex-start',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 9999,
  },
  quickActions: { flexDirection: 'row', gap: 8 },
  quickBtn: { flex: 1, alignItems: 'center', paddingVertical: 14, paddingHorizontal: 4 },
  quickIconCircle: { width: 40, height: 40, borderRadius: 9999, alignItems: 'center', justifyContent: 'center' },
  sectionRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  addChip: { flexDirection: 'row', alignItems: 'center', gap: 3, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 9999 },
  emptyCard: { padding: 24, alignItems: 'center' },
  emptyIcon: { width: 48, height: 48, borderRadius: 9999, alignItems: 'center', justifyContent: 'center' },
  dots: { flexDirection: 'row', justifyContent: 'center', gap: 5, marginTop: 10 },
  dot: { width: 5, height: 5, borderRadius: 3 },
  emptyTxCard: { paddingVertical: 24, alignItems: 'center' },
  txRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 13,
  },
  txIconCircle: { width: 32, height: 32, borderRadius: 9999, alignItems: 'center', justifyContent: 'center' },
  bellBadge: {
    position: 'absolute',
    top: 0,
    right: 0,
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  chatBtn: {
    width: 32,
    height: 32,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  lockBadge: {
    position: 'absolute',
    bottom: -2,
    right: -2,
    width: 12,
    height: 12,
    borderRadius: 6,
    alignItems: 'center',
    justifyContent: 'center',
  },
  chikiAvatar: {
    width: 52,
    height: 52,
    borderRadius: 26,
    alignItems: 'center',
    justifyContent: 'center',
  },
  insightCard: {
    width: 270,
    borderWidth: 1,
    padding: 14,
  },
  insightIconBubble: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
