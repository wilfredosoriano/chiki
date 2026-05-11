/**
 * Add Budget modal — create a budget for a category in the current month.
 */
import { useState, useEffect } from 'react';
import {
  View, ScrollView, TouchableOpacity, TextInput, StyleSheet,
  Alert, KeyboardAvoidingView, Platform,
} from 'react-native';
import { Text } from '@/components/ui/Text';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@/hooks/useTheme';
import { getDatabase } from '@/db/database';
import { getCategoriesByType } from '@/db/categoryQueries';
import { getBudgetsByMonth, getBudgetByCategoryAndMonth, updateBudget, upsertBudget } from '@/db/budgetQueries';
import { useSubscriptionStore } from '@/stores/subscriptionStore';
import { FREE_TIER_LIMITS } from '@/constants';
import type { Budget, Category } from '@/types';

function generateId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

export default function AddBudgetScreen() {
  const { colors, typography, spacing, radius } = useTheme();
  const insets = useSafeAreaInsets();

  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth() + 1;

  const [categories, setCategories] = useState<Category[]>([]);
  const [selectedCategoryId, setSelectedCategoryId] = useState<string>('');
  const [amount, setAmount] = useState('');
  const [period, setPeriod] = useState<'monthly' | 'weekly'>('monthly');
  const [saving, setSaving] = useState(false);
  const [existingBudget, setExistingBudget] = useState<Budget | null>(null);

  // Load categories on mount
  useEffect(() => {
    (async () => {
      const db = await getDatabase();
      const cats = await getCategoriesByType(db, 'expense');
      setCategories(cats);
      if (cats.length > 0) setSelectedCategoryId(cats[0].id);
    })();
  }, []);

  // When category changes, check if a budget already exists this month
  useEffect(() => {
    if (!selectedCategoryId) return;
    (async () => {
      const db = await getDatabase();
      const existing = await getBudgetByCategoryAndMonth(db, selectedCategoryId, currentYear, currentMonth);
      setExistingBudget(existing);
      if (existing) {
        setAmount(existing.amount.toString());
        setPeriod(existing.period);
      } else {
        setAmount('');
        setPeriod('monthly');
      }
    })();
  }, [selectedCategoryId]);

  async function handleSave() {
    const { isPremium } = useSubscriptionStore.getState();
    if (!isPremium) {
      const db = await getDatabase();
      const existing = await getBudgetsByMonth(db, currentYear, currentMonth);
      if (existing.length >= FREE_TIER_LIMITS.MAX_BUDGETS) {
        Alert.alert(
          'Budget limit reached',
          `Free plan includes up to ${FREE_TIER_LIMITS.MAX_BUDGETS} budgets. Upgrade to Premium.`,
          [
            { text: 'Not now', style: 'cancel' },
            { text: 'Upgrade', onPress: () => router.push('/(modals)/paywall') },
          ]
        );
        return;
      }
    }

    const parsedAmount = parseFloat(amount.replace(/,/g, ''));
    if (isNaN(parsedAmount) || parsedAmount <= 0) {
      Alert.alert('Invalid amount', 'Please enter a valid budget amount.');
      return;
    }
    if (!selectedCategoryId) {
      Alert.alert('No category', 'Please select a category.');
      return;
    }

    setSaving(true);
    try {
      const db = await getDatabase();
      if (existingBudget) {
        // Update the existing budget — never create a duplicate
        await updateBudget(db, existingBudget.id, parsedAmount, period);
      } else {
        const budget: Budget = {
          id: generateId(),
          categoryId: selectedCategoryId,
          amount: parsedAmount,
          period,
          month: currentMonth,
          year: currentYear,
          createdAt: new Date().toISOString(),
        };
        await upsertBudget(db, budget);
      }
      router.back();
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      Alert.alert('Error saving budget', msg);
    } finally {
      setSaving(false);
    }
  }

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: colors.background }}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >

      {/* Header */}
      <View style={[styles.header, {
        paddingTop: insets.top + spacing.sm,
        paddingHorizontal: spacing.lg,
        borderBottomColor: colors.border,
        backgroundColor: colors.surface,
      }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="chevron-back" size={24} color={colors.textPrimary} />
        </TouchableOpacity>
        <Text style={{ color: colors.textPrimary, fontSize: typography.sizes.md, fontWeight: '700' }}>
          {existingBudget ? 'Edit Budget' : 'Add Budget'}
        </Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ padding: spacing.lg, gap: spacing.lg, paddingBottom: insets.bottom + 32 }}
        keyboardShouldPersistTaps="handled"
      >
        {/* Month label */}
        <View style={[styles.monthRow, {
          backgroundColor: colors.primaryLight,
          borderRadius: radius.md,
        }]}>
          <Ionicons name="calendar-outline" size={18} color={colors.primary} />
          <Text style={{ color: colors.primary, fontWeight: '600', fontSize: typography.sizes.sm }}>
            {new Date(currentYear, currentMonth - 1).toLocaleString('en-PH', { month: 'long', year: 'numeric' })}
          </Text>
        </View>

        {/* Category */}
        <View style={{ gap: spacing.sm }}>
          <Text style={{ color: colors.textSecondary, fontSize: typography.sizes.sm, fontWeight: '600' }}>
            Category
          </Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>
            {categories.map((cat) => {
              const selected = cat.id === selectedCategoryId;
              return (
                <TouchableOpacity
                  key={cat.id}
                  onPress={() => setSelectedCategoryId(cat.id)}
                  style={[styles.chip, {
                    backgroundColor: selected ? cat.color : colors.surface,
                    borderColor: selected ? cat.color : colors.border,
                    borderRadius: radius.full,
                  }]}
                >
                  <Text style={{
                    color: selected ? '#fff' : colors.textPrimary,
                    fontSize: typography.sizes.sm,
                    fontWeight: '600',
                  }}>
                    {cat.name}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        {/* Existing budget notice */}
        {existingBudget && (
          <View style={{
            flexDirection: 'row',
            alignItems: 'center',
            gap: 8,
            backgroundColor: colors.income + '15',
            borderRadius: radius.md,
            paddingHorizontal: 14,
            paddingVertical: 10,
          }}>
            <Ionicons name="information-circle-outline" size={16} color={colors.income} />
            <Text style={{ color: colors.income, fontSize: typography.sizes.sm, fontWeight: '500', flex: 1 }}>
              This category already has a budget. Editing will update the existing one.
            </Text>
          </View>
        )}

        {/* Amount */}
        <View style={{ gap: spacing.xs }}>
          <Text style={{ color: colors.textSecondary, fontSize: typography.sizes.sm, fontWeight: '600' }}>
            Budget Amount (₱)
          </Text>
          <View style={[styles.amountRow, {
            backgroundColor: colors.surface,
            borderColor: colors.border,
            borderRadius: radius.md,
          }]}>
            <Text style={{ color: colors.primary, fontSize: 28, fontWeight: '800' }}>₱</Text>
            <TextInput
              value={amount}
              onChangeText={setAmount}
              placeholder="0.00"
              placeholderTextColor={colors.textTertiary}
              keyboardType="decimal-pad"
              style={{
                flex: 1,
                color: colors.textPrimary,
                fontSize: 28,
                fontWeight: '800',
                marginLeft: spacing.sm,
              }}
            />
          </View>
        </View>

        {/* Period toggle */}
        <View style={{ gap: spacing.xs }}>
          <Text style={{ color: colors.textSecondary, fontSize: typography.sizes.sm, fontWeight: '600' }}>
            Period
          </Text>
          <View style={[styles.toggleRow, {
            backgroundColor: colors.surfaceSecondary,
            borderRadius: radius.md,
            borderColor: colors.border,
          }]}>
            {(['monthly', 'weekly'] as const).map((p) => (
              <TouchableOpacity
                key={p}
                onPress={() => setPeriod(p)}
                style={[styles.toggleBtn, {
                  backgroundColor: period === p ? colors.accent : 'transparent',
                  borderRadius: radius.sm,
                }]}
              >
                <Text style={{
                  color: period === p ? '#fff' : colors.textSecondary,
                  fontWeight: '700',
                  fontSize: typography.sizes.sm,
                }}>
                  {p.charAt(0).toUpperCase() + p.slice(1)}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Save */}
        <TouchableOpacity
          style={[styles.saveBtn, {
            backgroundColor: saving ? colors.border : colors.accent,
            borderRadius: radius.lg,
            marginTop: spacing.sm,
          }]}
          onPress={handleSave}
          disabled={saving}
        >
          <Ionicons name="checkmark-circle-outline" size={20} color="#fff" />
          <Text style={{ color: '#fff', fontWeight: '700', fontSize: typography.sizes.base }}>
            {saving ? 'Saving...' : existingBudget ? 'Update Budget' : 'Save Budget'}
          </Text>
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingBottom: 12,
    borderBottomWidth: 1,
  },
  backBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  monthRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  chip: {
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  amountRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  toggleRow: {
    flexDirection: 'row',
    borderWidth: 1,
    padding: 4,
    gap: 4,
  },
  toggleBtn: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
  },
  saveBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 16,
  },
});
