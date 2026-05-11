/**
 * Budgets screen — monthly budget progress.
 * Design: thin progress bars, flat list in grouped card, clean hierarchy.
 */
import { useState, useCallback, useRef } from 'react';
import { View, ScrollView, Pressable, StyleSheet, Alert } from 'react-native';
import { Text } from '@/components/ui/Text';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { router, useFocusEffect } from 'expo-router';
import { format } from '@/utils/dateUtils';
import { useTheme } from '@/hooks/useTheme';
import { getDatabase } from '@/db/database';
import { getBudgetsByMonth, deleteBudget } from '@/db/budgetQueries';
import { getAllCategories } from '@/db/categoryQueries';
import { getSpendingByCategory } from '@/db/transactionQueries';
import type { Budget, Category } from '@/types';

function formatCurrency(amount: number) {
  return '₱' + amount.toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export default function BudgetsScreen() {
  const { colors, radius, isDark } = useTheme();
  const insets = useSafeAreaInsets();

  const now   = new Date();
  const year  = now.getFullYear();
  const month = now.getMonth() + 1;
  const monthLabel = format(now, 'MMMM yyyy');

  const [budgets,    setBudgets]    = useState<Budget[]>([]);
  const [categories, setCategories] = useState<Map<string, Category>>(new Map());
  const [spending,   setSpending]   = useState<Map<string, number>>(new Map());
  const [loading,    setLoading]    = useState(true);
  const hasLoaded = useRef(false);

  useFocusEffect(
    useCallback(() => {
      let active = true;
      (async () => {
        if (!hasLoaded.current) setLoading(true);
        const db = await getDatabase();
        const [blist, cats, spends] = await Promise.all([
          getBudgetsByMonth(db, year, month),
          getAllCategories(db),
          getSpendingByCategory(db, year, month),
        ]);
        if (!active) return;
        setBudgets(blist);
        const catMap = new Map<string, Category>();
        cats.forEach((c) => catMap.set(c.id, c));
        setCategories(catMap);
        const spendMap = new Map<string, number>();
        spends.forEach((s) => spendMap.set(s.categoryId, s.total));
        setSpending(spendMap);
        setLoading(false);
        hasLoaded.current = true;
      })();
      return () => { active = false; };
    }, [year, month])
  );

  // Total summary
  const totalBudgeted = budgets.reduce((s, b) => s + b.amount, 0);
  const totalSpent    = budgets.reduce((s, b) => s + (spending.get(b.categoryId) ?? 0), 0);
  const overallRatio  = totalBudgeted > 0 ? Math.min(totalSpent / totalBudgeted, 1) : 0;

  function barColor(ratio: number) {
    if (ratio >= 1)   return colors.expense;
    if (ratio >= 0.9) return colors.expense;
    if (ratio >= 0.6) return colors.warning;
    return colors.accent;
  }

  function confirmDeleteBudget(budget: Budget) {
    const cat = categories.get(budget.categoryId);
    Alert.alert(
      'Delete Budget',
      `Delete the "${cat?.name ?? budget.categoryId}" budget?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              const db = await getDatabase();
              await deleteBudget(db, budget.id);
              setBudgets((prev) => prev.filter((b) => b.id !== budget.id));
            } catch (e: unknown) {
              Alert.alert('Error', e instanceof Error ? e.message : String(e));
            }
          },
        },
      ]
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>

      {/* Header */}
      <View style={[styles.header, {
        paddingTop: insets.top + 12,
        paddingHorizontal: 20,
        paddingBottom: 12,
        backgroundColor: colors.background,
        borderBottomWidth: 1,
        borderBottomColor: colors.border,
      }]}>
        <View style={styles.headerRow}>
          <View>
            <Text style={{ color: colors.textPrimary, fontSize: 22, fontWeight: '600', letterSpacing: -0.4 }}>
              Budgets
            </Text>
            <Text style={{ color: colors.textTertiary, fontSize: 12, letterSpacing: 0.2, marginTop: 2 }}>
              {monthLabel}
            </Text>
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            {/* Add button */}
            <Pressable
              onPress={() => router.push('/(modals)/add-budget')}
              style={({ pressed }) => [styles.addBtn, { backgroundColor: colors.accent, borderRadius: radius.lg, opacity: pressed ? 0.8 : 1 }]}
            >
              <Ionicons name="add" size={18} color={'#FFFFFF'} />
              <Text style={{ color: '#FFFFFF', fontSize: 13, fontWeight: '600' }}>Add</Text>
            </Pressable>
          </View>
        </View>
      </View>

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: insets.bottom + 80 }}
        showsVerticalScrollIndicator={false}
      >

        {loading ? (
          <Text style={{ color: colors.textTertiary, textAlign: 'center', marginTop: 48, fontSize: 14 }}>
            Loading...
          </Text>
        ) : budgets.length === 0 ? (

          /* Empty state */
          <View style={{ alignItems: 'center', paddingTop: 64, gap: 12 }}>
            <View style={[styles.emptyIcon, { backgroundColor: colors.surfaceElevated }]}>
              <Ionicons name="pie-chart-outline" size={26} color={colors.textTertiary} />
            </View>
            <Text style={{ color: colors.textPrimary, fontSize: 16, fontWeight: '600', letterSpacing: -0.2 }}>
              No budgets yet
            </Text>
            <Text style={{ color: colors.textTertiary, fontSize: 13, textAlign: 'center', lineHeight: 20 }}>
              Set budgets to track your spending{'\n'}by category.
            </Text>
            <Pressable
              style={({ pressed }) => [styles.addBtn, { backgroundColor: colors.accent, borderRadius: radius.lg, opacity: pressed ? 0.8 : 1, marginTop: 4 }]}
              onPress={() => router.push('/(modals)/add-budget')}
            >
              <Ionicons name="add" size={16} color={'#FFFFFF'} />
              <Text style={{ color: '#FFFFFF', fontSize: 13, fontWeight: '600' }}>Add Budget</Text>
            </Pressable>
          </View>

        ) : (
          <>
            {/* ── Summary card ── */}
            <View style={[styles.summaryCard, {
              marginTop: 20,
              backgroundColor: colors.surface,
              borderRadius: radius.lg,
              borderWidth: 1,
              borderColor: colors.border,
              ...(isDark ? {} : { shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.04, shadowRadius: 2, elevation: 1 }),
            }]}>
              <View style={styles.summaryRow}>
                <View style={styles.summaryItem}>
                  <Text style={{ color: colors.textTertiary, fontSize: 11, fontWeight: '500', letterSpacing: 0.3, textTransform: 'uppercase' }}>
                    Spent
                  </Text>
                  <Text style={{ color: barColor(overallRatio), fontSize: 20, fontWeight: '700', letterSpacing: -0.4, marginTop: 4 }}>
                    {formatCurrency(totalSpent)}
                  </Text>
                </View>
                <View style={{ width: 1, backgroundColor: colors.border }} />
                <View style={styles.summaryItem}>
                  <Text style={{ color: colors.textTertiary, fontSize: 11, fontWeight: '500', letterSpacing: 0.3, textTransform: 'uppercase' }}>
                    Budget
                  </Text>
                  <Text style={{ color: colors.textPrimary, fontSize: 20, fontWeight: '700', letterSpacing: -0.4, marginTop: 4 }}>
                    {formatCurrency(totalBudgeted)}
                  </Text>
                </View>
              </View>
              {/* Overall progress bar */}
              <View style={{ paddingHorizontal: 16, paddingBottom: 16 }}>
                <View style={[styles.progressTrack, { backgroundColor: colors.surfaceElevated }]}>
                  <View style={[styles.progressFill, {
                    width: `${overallRatio * 100}%`,
                    backgroundColor: barColor(overallRatio),
                  }]} />
                </View>
                <Text style={{ color: colors.textTertiary, fontSize: 11, marginTop: 6 }}>
                  {Math.round(overallRatio * 100)}% of total budget used
                </Text>
              </View>
            </View>

            {/* ── Budget items ── */}
            <View style={[{
              marginTop: 16,
              backgroundColor: colors.surface,
              borderRadius: radius.lg,
              borderWidth: 1,
              borderColor: colors.border,
              overflow: 'hidden',
              ...(isDark ? {} : { shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.04, shadowRadius: 2, elevation: 1 }),
            }]}>
              {budgets.map((budget, idx) => {
                const cat     = categories.get(budget.categoryId);
                const spent   = spending.get(budget.categoryId) ?? 0;
                const ratio   = budget.amount > 0 ? Math.min(spent / budget.amount, 1) : 0;
                const pColor  = barColor(ratio);
                const isLast  = idx === budgets.length - 1;
                const overBudget = ratio >= 1;

                return (
                  <View
                    key={budget.id}
                    style={[styles.budgetRow, !isLast && { borderBottomWidth: 1, borderBottomColor: colors.border }]}
                  >
                    {/* Icon + name + amounts + delete */}
                    <View style={styles.budgetTop}>
                      <View style={[styles.catDot, { backgroundColor: (cat?.color ?? colors.accent) + '33', borderRadius: 6 }]}>
                        <Ionicons name="wallet-outline" size={14} color={cat?.color ?? colors.accent} />
                      </View>
                      <Text style={{ flex: 1, color: colors.textPrimary, fontSize: 15, fontWeight: '500' }}>
                        {cat?.name ?? budget.categoryId}
                      </Text>
                      <View style={{ alignItems: 'flex-end', marginRight: 10 }}>
                        <Text style={{ color: pColor, fontSize: 13, fontWeight: '600' }}>
                          {formatCurrency(spent)}
                        </Text>
                        <Text style={{ color: colors.textTertiary, fontSize: 11, marginTop: 1 }}>
                          of {formatCurrency(budget.amount)}
                        </Text>
                      </View>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                        <Pressable
                          onPress={() => confirmDeleteBudget(budget)}
                          hitSlop={8}
                          style={({ pressed }) => ({ opacity: pressed ? 0.5 : 1 })}
                        >
                          <Ionicons name="trash-outline" size={16} color={colors.textTertiary} />
                        </Pressable>
                      </View>
                    </View>

                    {/* Progress bar — full width */}
                    <View style={[styles.progressTrack, { backgroundColor: colors.surfaceElevated, marginTop: 10 }]}>
                      <View style={[styles.progressFill, {
                        width: `${ratio * 100}%`,
                        backgroundColor: pColor,
                      }]} />
                    </View>

                    {/* Status label */}
                    {overBudget && (
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 6 }}>
                        <Ionicons name="warning-outline" size={11} color={colors.expense} />
                        <Text style={{ color: colors.expense, fontSize: 11, fontWeight: '500' }}>
                          Over budget by {formatCurrency(spent - budget.amount)}
                        </Text>
                      </View>
                    )}
                  </View>
                );
              })}
            </View>
          </>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  header: {},
  headerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  addBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 14, paddingVertical: 8 },
  emptyIcon: { width: 52, height: 52, borderRadius: 9999, alignItems: 'center', justifyContent: 'center' },
  summaryCard: {},
  summaryRow: { flexDirection: 'row', overflow: 'hidden' },
  summaryItem: { flex: 1, padding: 16 },
  progressTrack: { height: 6, width: '100%', borderRadius: 9999, overflow: 'hidden' },
  progressFill: { height: '100%', borderRadius: 9999 },
  budgetRow: { paddingHorizontal: 16, paddingVertical: 14 },
  budgetTop: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  catDot: { width: 28, height: 28, alignItems: 'center', justifyContent: 'center' },
});
