/**
 * Analytics screen — spending insights with charts.
 */
import { useState, useCallback } from 'react';
import {
  View, ScrollView, Dimensions, Pressable,
} from 'react-native';
import { Text } from '@/components/ui/Text';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { router, useFocusEffect } from 'expo-router';
import { PieChart, BarChart, LineChart } from 'react-native-gifted-charts';
import { format, subMonths, getDaysInMonth } from '@/utils/dateUtils';
import { useTheme } from '@/hooks/useTheme';
import { getDatabase } from '@/db/database';
import { getSpendingByCategory } from '@/db/transactionQueries';
import { getAllCategories } from '@/db/categoryQueries';
import type { Category } from '@/types';

const { width: SCREEN_W } = Dimensions.get('window');
const CHART_W = SCREEN_W - 40; // 20px padding each side

function formatCurrency(amount: number) {
  if (amount >= 1_000_000) return '₱' + (amount / 1_000_000).toFixed(1) + 'M';
  if (amount >= 1_000) return '₱' + (amount / 1_000).toFixed(1) + 'K';
  return '₱' + amount.toLocaleString('en-PH', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
}

// Pleasing chart color palette that works in both light and dark
const PIE_PALETTE = [
  '#5F6266', '#8A8D90', '#60A5FA', '#4ADE80',
  '#FB923C', '#F472B6', '#A78BFA', '#FBBF24',
];

interface MonthlyData {
  month: string;   // 'YYYY-MM'
  income: number;
  expense: number;
}

interface DailyData {
  date: string;
  total: number;
}

interface CategorySpend {
  categoryId: string;
  total: number;
  name: string;
  color: string;
}

export default function AnalyticsScreen() {
  const { colors, radius, isDark } = useTheme();
  const insets = useSafeAreaInsets();

  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth() + 1;
  const monthLabel = format(now, 'MMMM yyyy');

  const [categoryData, setCategoryData] = useState<CategorySpend[]>([]);
  const [monthlyData, setMonthlyData]   = useState<MonthlyData[]>([]);
  const [dailyData, setDailyData]       = useState<DailyData[]>([]);
  const [loading, setLoading]           = useState(true);

  useFocusEffect(
    useCallback(() => {
      let active = true;
      (async () => {
        setLoading(true);
        const db = await getDatabase();

        // 1. Category spending
        const [spends, cats] = await Promise.all([
          getSpendingByCategory(db, year, month),
          getAllCategories(db),
        ]);
        const catMap = new Map<string, Category>();
        cats.forEach((c) => catMap.set(c.id, c));

        const catSpends: CategorySpend[] = spends
          .map((s, i) => ({
            categoryId: s.categoryId,
            total: s.total,
            name: catMap.get(s.categoryId)?.name ?? s.categoryId,
            color: catMap.get(s.categoryId)?.color ?? PIE_PALETTE[i % PIE_PALETTE.length],
          }))
          .sort((a, b) => b.total - a.total);

        // 2. Monthly income/expense for last 6 months
        const monthlyRows = await db.getAllAsync<{ month: string; income: number; expense: number }>(
          `SELECT
            strftime('%Y-%m', date) as month,
            SUM(CASE WHEN type = 'income' THEN amount ELSE 0 END) as income,
            SUM(CASE WHEN type = 'expense' THEN amount ELSE 0 END) as expense
           FROM transactions
           WHERE date >= date('now', '-5 months', 'start of month')
           GROUP BY strftime('%Y-%m', date)
           ORDER BY month ASC;`
        );

        // Fill in missing months with zeros
        const filledMonthly: MonthlyData[] = [];
        for (let i = 5; i >= 0; i--) {
          const d = subMonths(now, i);
          const key = format(d, 'yyyy-MM');
          const found = monthlyRows.find((r) => r.month === key);
          filledMonthly.push({ month: key, income: found?.income ?? 0, expense: found?.expense ?? 0 });
        }

        // 3. Daily expenses this month
        const pad = String(month).padStart(2, '0');
        const dailyRows = await db.getAllAsync<{ date: string; total: number }>(
          `SELECT date, SUM(amount) as total
           FROM transactions
           WHERE type = 'expense' AND date LIKE ?
           GROUP BY date
           ORDER BY date ASC;`,
          [`${year}-${pad}-%`]
        );

        // Fill in all days of the month with 0 if missing
        const daysInMonth = getDaysInMonth(now);
        const filledDaily: DailyData[] = [];
        for (let d = 1; d <= daysInMonth; d++) {
          const dateStr = `${year}-${pad}-${String(d).padStart(2, '0')}`;
          const found = dailyRows.find((r) => r.date === dateStr);
          filledDaily.push({ date: dateStr, total: found?.total ?? 0 });
        }

        if (!active) return;
        setCategoryData(catSpends);
        setMonthlyData(filledMonthly);
        setDailyData(filledDaily);
        setLoading(false);
      })();
      return () => { active = false; };
    }, [year, month])
  );

  const totalIncome  = monthlyData.find((m) => m.month === format(now, 'yyyy-MM'))?.income ?? 0;
  const totalExpense = monthlyData.find((m) => m.month === format(now, 'yyyy-MM'))?.expense ?? 0;
  const savingsRate  = totalIncome > 0 ? Math.round(((totalIncome - totalExpense) / totalIncome) * 100) : 0;

  // Pie chart data — top 5 + "Other"
  const topN = 5;
  const topCats = categoryData.slice(0, topN);
  const otherTotal = categoryData.slice(topN).reduce((s, c) => s + c.total, 0);
  const pieData = [
    ...topCats.map((c, i) => ({
      value: Math.round(c.total),
      color: c.color || PIE_PALETTE[i % PIE_PALETTE.length],
      text: '',
    })),
    ...(otherTotal > 0 ? [{ value: Math.round(otherTotal), color: '#C0C3C6', text: '' }] : []),
  ];

  // Bar chart data — alternating income/expense per month
  const barData = monthlyData.flatMap((m, i) => {
    const label = format(new Date(m.month + '-01'), 'MMM');
    return [
      {
        value: Math.round(m.income),
        frontColor: colors.income,
        label: label,
        spacing: 4,
        labelTextStyle: { color: colors.textTertiary, fontSize: 10, fontFamily: 'Montserrat_400Regular' },
      },
      {
        value: Math.round(m.expense),
        frontColor: colors.expense,
        spacing: i < monthlyData.length - 1 ? 16 : 0,
      },
    ];
  });

  // Line chart data — daily spending
  const lineData = dailyData.map((d) => ({
    value: Math.round(d.total),
  }));

  const maxBarValue = Math.max(...monthlyData.flatMap((m) => [m.income, m.expense]), 1);

  const sectionHeader = (title: string, subtitle?: string) => (
    <View style={{ marginBottom: 14 }}>
      <Text style={{ color: colors.textPrimary, fontSize: 16, fontWeight: '600', letterSpacing: -0.3 }}>
        {title}
      </Text>
      {subtitle ? (
        <Text style={{ color: colors.textTertiary, fontSize: 12, marginTop: 2 }}>{subtitle}</Text>
      ) : null}
    </View>
  );

  const cardStyle = {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 20,
    ...(isDark ? {} : { shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.04, shadowRadius: 2, elevation: 1 }),
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      {/* Header */}
      <View style={{
        paddingTop: insets.top + 12,
        paddingHorizontal: 20,
        paddingBottom: 12,
        backgroundColor: colors.background,
        borderBottomWidth: 1,
        borderBottomColor: colors.border,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
      }}>
        <Pressable
          onPress={() => router.back()}
          hitSlop={8}
          style={({ pressed }) => ({ opacity: pressed ? 0.6 : 1 })}
        >
          <Ionicons name="chevron-back" size={22} color={colors.textPrimary} />
        </Pressable>
        <View>
          <Text style={{ color: colors.textPrimary, fontSize: 22, fontWeight: '600', letterSpacing: -0.4 }}>
            Analytics
          </Text>
          <Text style={{ color: colors.textTertiary, fontSize: 12, marginTop: 1 }}>{monthLabel}</Text>
        </View>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 20, paddingBottom: insets.bottom + 100, gap: 24 }}
      >
        {/* ── Summary row ── */}
        <View style={{ flexDirection: 'row', gap: 10 }}>
          {[
            { label: 'Income', value: formatCurrency(totalIncome), color: colors.income, icon: 'trending-up' as const },
            { label: 'Expenses', value: formatCurrency(totalExpense), color: colors.expense, icon: 'trending-down' as const },
            { label: 'Saved', value: `${savingsRate}%`, color: savingsRate >= 0 ? colors.income : colors.expense, icon: 'wallet' as const },
          ].map((item) => (
            <View key={item.label} style={[{ flex: 1, padding: 14, borderRadius: radius.lg, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, alignItems: 'center', gap: 6 }, isDark ? {} : { shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.04, shadowRadius: 2, elevation: 1 }]}>
              <Ionicons name={item.icon} size={18} color={item.color} />
              <Text style={{ color: item.color, fontSize: 15, fontWeight: '700', letterSpacing: -0.3 }}>
                {item.value}
              </Text>
              <Text style={{ color: colors.textTertiary, fontSize: 10, fontWeight: '500', letterSpacing: 0.3, textTransform: 'uppercase' }}>
                {item.label}
              </Text>
            </View>
          ))}
        </View>

        {/* ── Spending by Category ── */}
        {pieData.length > 0 && (
          <View>
            {sectionHeader('Spending by Category', monthLabel)}
            <View style={cardStyle}>
              {/* Donut chart centered */}
              <View style={{ alignItems: 'center', marginBottom: 20 }}>
                <PieChart
                  data={pieData}
                  donut
                  radius={90}
                  innerRadius={58}
                  showText={false}
                  centerLabelComponent={() => (
                    <View style={{ alignItems: 'center' }}>
                      <Text style={{ color: colors.expense, fontSize: 14, fontWeight: '700' }}>
                        {formatCurrency(totalExpense)}
                      </Text>
                      <Text style={{ color: colors.textTertiary, fontSize: 10 }}>spent</Text>
                    </View>
                  )}
                />
              </View>

              {/* Legend */}
              <View style={{ gap: 10 }}>
                {topCats.map((cat, i) => {
                  const pct = totalExpense > 0 ? Math.round((cat.total / totalExpense) * 100) : 0;
                  const barW = totalExpense > 0 ? (cat.total / totalExpense) * (CHART_W - 80) : 0;
                  return (
                    <View key={cat.categoryId} style={{ gap: 4 }}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                          <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: cat.color || PIE_PALETTE[i] }} />
                          <Text style={{ color: colors.textPrimary, fontSize: 13, fontWeight: '500' }}>{cat.name}</Text>
                        </View>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                          <Text style={{ color: colors.textTertiary, fontSize: 12 }}>{pct}%</Text>
                          <Text style={{ color: colors.textSecondary, fontSize: 13, fontWeight: '600', minWidth: 70, textAlign: 'right' }}>
                            {formatCurrency(cat.total)}
                          </Text>
                        </View>
                      </View>
                      {/* Mini bar */}
                      <View style={{ height: 3, backgroundColor: colors.surfaceElevated, borderRadius: 9999, overflow: 'hidden' }}>
                        <View style={{ height: 3, width: barW, backgroundColor: cat.color || PIE_PALETTE[i], borderRadius: 9999 }} />
                      </View>
                    </View>
                  );
                })}
                {otherTotal > 0 && (
                  <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                      <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: '#C0C3C6' }} />
                      <Text style={{ color: colors.textTertiary, fontSize: 13 }}>Other</Text>
                    </View>
                    <Text style={{ color: colors.textTertiary, fontSize: 13 }}>{formatCurrency(otherTotal)}</Text>
                  </View>
                )}
              </View>
            </View>
          </View>
        )}

        {/* ── Monthly Overview ── */}
        {monthlyData.some((m) => m.income > 0 || m.expense > 0) && (
          <View>
            {sectionHeader('Monthly Overview', 'Last 6 months')}
            <View style={[cardStyle, { paddingHorizontal: 12 }]}>
              {/* Legend */}
              <View style={{ flexDirection: 'row', gap: 16, marginBottom: 16, paddingHorizontal: 8 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  <View style={{ width: 10, height: 10, borderRadius: 2, backgroundColor: colors.income }} />
                  <Text style={{ color: colors.textTertiary, fontSize: 12 }}>Income</Text>
                </View>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  <View style={{ width: 10, height: 10, borderRadius: 2, backgroundColor: colors.expense }} />
                  <Text style={{ color: colors.textTertiary, fontSize: 12 }}>Expenses</Text>
                </View>
              </View>
              <BarChart
                data={barData}
                barWidth={18}
                barBorderRadius={4}
                noOfSections={4}
                maxValue={Math.ceil(maxBarValue * 1.15 / 1000) * 1000 || 1000}
                yAxisThickness={0}
                xAxisThickness={1}
                xAxisColor={colors.border}
                yAxisTextStyle={{ color: colors.textTertiary, fontSize: 10, fontFamily: 'Montserrat_400Regular' }}
                hideRules
                width={CHART_W - 40}
                height={180}
                yAxisLabelFormatter={(v: number) => formatCurrency(v)}
                isAnimated
              />
            </View>
          </View>
        )}

        {/* ── Daily Spending ── */}
        {dailyData.some((d) => d.total > 0) && (
          <View>
            {sectionHeader('Daily Spending', monthLabel)}
            <View style={[cardStyle, { paddingHorizontal: 8 }]}>
              <LineChart
                data={lineData}
                width={CHART_W - 40}
                height={160}
                color={colors.accent}
                thickness={2}
                startFillColor={colors.accent}
                endFillColor={colors.accent + '00'}
                startOpacity={0.25}
                endOpacity={0}
                areaChart
                curved
                hideDataPoints
                noOfSections={4}
                yAxisThickness={0}
                xAxisThickness={1}
                xAxisColor={colors.border}
                yAxisTextStyle={{ color: colors.textTertiary, fontSize: 10, fontFamily: 'Montserrat_400Regular' }}
                xAxisLabelTexts={dailyData.map((d) => {
                  const day = parseInt(d.date.split('-')[2], 10);
                  return day === 1 || day % 7 === 0 ? String(day) : '';
                })}
                xAxisLabelTextStyle={{ color: colors.textTertiary, fontSize: 10, fontFamily: 'Montserrat_400Regular' }}
                hideRules
                yAxisLabelFormatter={(v: number) => formatCurrency(v)}
                isAnimated
              />
            </View>
          </View>
        )}

        {/* Empty state */}
        {!loading && categoryData.length === 0 && monthlyData.every((m) => m.income === 0 && m.expense === 0) && (
          <View style={{ alignItems: 'center', paddingTop: 48, gap: 12 }}>
            <View style={{ width: 56, height: 56, borderRadius: 28, backgroundColor: colors.surfaceElevated, alignItems: 'center', justifyContent: 'center' }}>
              <Ionicons name="bar-chart-outline" size={26} color={colors.textTertiary} />
            </View>
            <Text style={{ color: colors.textPrimary, fontSize: 16, fontWeight: '600' }}>No data yet</Text>
            <Text style={{ color: colors.textTertiary, fontSize: 13, textAlign: 'center', lineHeight: 20 }}>
              Add some transactions to{'\n'}see your spending analytics.
            </Text>
          </View>
        )}
      </ScrollView>
    </View>
  );
}
