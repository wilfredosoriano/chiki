/**
 * Goals screen — savings goal tracker.
 * "Add Money" deducts from a chosen account and records a transaction,
 * keeping account balances and transaction history accurate.
 */
import { useState, useCallback, useRef } from 'react';
import { View, ScrollView, Pressable, TextInput, StyleSheet, Alert, Platform } from 'react-native';
import { Text } from '@/components/ui/Text';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { router, useFocusEffect } from 'expo-router';
import { format } from '@/utils/dateUtils';
import { useTheme } from '@/hooks/useTheme';
import { useSubscriptionStore } from '@/stores/subscriptionStore';
import { useAccountStore } from '@/stores/accountStore';
import { useTransactionStore } from '@/stores/transactionStore';
import { getDatabase } from '@/db/database';
import { getAllGoals, updateGoalAmount, deleteGoal } from '@/db/goalQueries';
import { updateAccountBalance } from '@/db/accountQueries';
import { insertTransaction } from '@/db/transactionQueries';
import type { SavingsGoal, Transaction } from '@/types';

function LockedScreen({ feature, description, onUpgrade }: { feature: string; description: string; onUpgrade: () => void }) {
  const { colors, radius } = useTheme();
  const insets = useSafeAreaInsets();
  return (
    <View style={{ flex: 1, backgroundColor: colors.background, alignItems: 'center', justifyContent: 'center', padding: 32, paddingBottom: insets.bottom + 80 }}>
      <View style={{ width: 64, height: 64, borderRadius: 32, backgroundColor: colors.surfaceElevated, alignItems: 'center', justifyContent: 'center', marginBottom: 20 }}>
        <Ionicons name="lock-closed" size={28} color={colors.textTertiary} />
      </View>
      <Text style={{ color: colors.textPrimary, fontSize: 20, fontWeight: '700', letterSpacing: -0.4, textAlign: 'center', marginBottom: 8 }}>
        {feature}
      </Text>
      <Text style={{ color: colors.textSecondary, fontSize: 14, textAlign: 'center', lineHeight: 21, marginBottom: 28 }}>
        {description}{'\n'}Available on Chiki Premium.
      </Text>
      <Pressable
        onPress={onUpgrade}
        style={({ pressed }) => ({
          backgroundColor: colors.primary,
          borderRadius: radius.lg,
          paddingHorizontal: 28,
          paddingVertical: 14,
          opacity: pressed ? 0.8 : 1,
        })}
      >
        <Text style={{ color: colors.primaryFg, fontWeight: '700', fontSize: 15 }}>Upgrade to Premium</Text>
      </Pressable>
    </View>
  );
}

function formatCurrency(amount: number) {
  return '₱' + amount.toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export default function GoalsScreen() {
  const { colors, radius, isDark } = useTheme();
  const insets = useSafeAreaInsets();
  const isPremium = useSubscriptionStore((s) => s.isPremium);

  const { accounts, updateAccount } = useAccountStore();
  const { addTransaction } = useTransactionStore();

  const [goals,    setGoals]    = useState<SavingsGoal[]>([]);
  const [loading,  setLoading]  = useState(true);
  const [addingTo, setAddingTo] = useState<string | null>(null);
  const [addAmount, setAddAmount] = useState('');
  const [selectedAccountId, setSelectedAccountId] = useState<string | null>(null);
  const hasLoaded = useRef(false);

  useFocusEffect(
    useCallback(() => {
      let active = true;
      (async () => {
        if (!hasLoaded.current) setLoading(true);
        const db   = await getDatabase();
        const list = await getAllGoals(db);
        if (!active) return;
        setGoals(list);
        setLoading(false);
        hasLoaded.current = true;
      })();
      return () => { active = false; };
    }, [])
  );

  async function handleAddMoney(goal: SavingsGoal) {
    const parsed = parseFloat(addAmount.replace(/,/g, ''));
    if (isNaN(parsed) || parsed <= 0) {
      Alert.alert('Invalid amount', 'Enter a valid amount to add.');
      return;
    }
    if (!selectedAccountId) {
      Alert.alert('No account selected', 'Please choose which account to save from.');
      return;
    }
    const account = accounts.find((a) => a.id === selectedAccountId);
    if (!account) {
      Alert.alert('Account not found', 'Please select a valid account.');
      return;
    }
    if (account.balance < parsed) {
      Alert.alert(
        'Insufficient balance',
        `${account.name} only has ${formatCurrency(account.balance)}. Not enough to save ${formatCurrency(parsed)}.`,
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Save Anyway', style: 'destructive', onPress: () => commitSaving(goal, account, parsed) },
        ]
      );
      return;
    }
    await commitSaving(goal, account, parsed);
  }

  async function commitSaving(
    goal: SavingsGoal,
    account: ReturnType<typeof useAccountStore.getState>['accounts'][0],
    parsed: number,
  ) {
    try {
      const db  = await getDatabase();
      const now = new Date().toISOString();
      const d   = new Date();
      const localDate = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

      // 1. Update goal amount
      const newGoalAmount = goal.currentAmount + parsed;
      await updateGoalAmount(db, goal.id, newGoalAmount);

      // 2. Deduct from account — round to avoid float drift
      const newAccountBalance = Math.round((account.balance - parsed) * 100) / 100;
      await updateAccountBalance(db, account.id, newAccountBalance);
      updateAccount(account.id, { balance: newAccountBalance });

      // 3. Record transaction so history stays accurate
      const tx: Transaction = {
        id: Date.now().toString(36) + Math.random().toString(36).slice(2, 7),
        accountId: account.id,
        type: 'expense',
        amount: parsed,
        categoryId: 'cat_savings',
        note: `Savings: ${goal.name}`,
        date: localDate,
        isRecurring: false,
        createdAt: now,
        updatedAt: now,
      };
      await insertTransaction(db, tx);
      addTransaction(tx);

      // 4. Update local goal state
      setGoals((prev) =>
        prev.map((g) => g.id === goal.id ? { ...g, currentAmount: newGoalAmount } : g)
      );
      setAddingTo(null);
      setAddAmount('');
      setSelectedAccountId(null);

      const isComplete = newGoalAmount >= goal.targetAmount;
      if (isComplete) {
        Alert.alert('🎉 Goal Reached!', `You've hit your target for "${goal.name}". Congratulations!`);
      } else {
        const remaining = goal.targetAmount - newGoalAmount;
        Alert.alert(
          'Saved!',
          `${formatCurrency(parsed)} saved from ${account.name}.\n${formatCurrency(remaining)} to go!`,
        );
      }
    } catch (e: unknown) {
      Alert.alert('Error', e instanceof Error ? e.message : String(e));
    }
  }

  function confirmDeleteGoal(goal: SavingsGoal) {
    Alert.alert(
      'Delete Goal',
      `Delete "${goal.name}"? Your saved progress will be lost.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              const db = await getDatabase();
              await deleteGoal(db, goal.id);
              setGoals((prev) => prev.filter((g) => g.id !== goal.id));
            } catch (e: unknown) {
              Alert.alert('Error', e instanceof Error ? e.message : String(e));
            }
          },
        },
      ]
    );
  }

  if (!isPremium) {
    return (
      <LockedScreen
        feature="Savings Goals"
        description="Track and reach your savings targets."
        onUpgrade={() => router.push('/(modals)/paywall')}
      />
    );
  }

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
        justifyContent: 'space-between',
      }}>
        <Text style={{ color: colors.textPrimary, fontSize: 22, fontWeight: '600', letterSpacing: -0.4 }}>
          Savings Goals
        </Text>
        <Pressable
          onPress={() => router.push('/(modals)/add-goal')}
          style={({ pressed }) => [styles.addBtn, { backgroundColor: colors.accent, borderRadius: radius.lg, opacity: pressed ? 0.8 : 1 }]}
        >
          <Ionicons name="add" size={18} color="#FFFFFF" />
          <Text style={{ color: '#FFFFFF', fontSize: 13, fontWeight: '600' }}>Add</Text>
        </Pressable>
      </View>

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: insets.bottom + 80 }}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {loading ? (
          <Text style={{ color: colors.textTertiary, textAlign: 'center', marginTop: 48, fontSize: 14 }}>
            Loading...
          </Text>
        ) : goals.length === 0 ? (

          <View style={{ alignItems: 'center', paddingTop: 64, gap: 12 }}>
            <View style={[styles.emptyIcon, { backgroundColor: colors.surfaceElevated }]}>
              <Ionicons name="trophy-outline" size={26} color={colors.textTertiary} />
            </View>
            <Text style={{ color: colors.textPrimary, fontSize: 16, fontWeight: '600', letterSpacing: -0.2 }}>
              No savings goals yet
            </Text>
            <Text style={{ color: colors.textTertiary, fontSize: 13, textAlign: 'center', lineHeight: 20 }}>
              Set a goal and track your progress{'\n'}toward it.
            </Text>
            <Pressable
              style={({ pressed }) => [styles.addBtn, { backgroundColor: colors.accent, borderRadius: radius.lg, opacity: pressed ? 0.8 : 1, marginTop: 4 }]}
              onPress={() => router.push('/(modals)/add-goal')}
            >
              <Ionicons name="add" size={16} color="#FFFFFF" />
              <Text style={{ color: '#FFFFFF', fontSize: 13, fontWeight: '600' }}>Add Goal</Text>
            </Pressable>
          </View>

        ) : (
          <View style={{ gap: 12, marginTop: 20 }}>
            {goals.map((goal) => {
              const ratio     = goal.targetAmount > 0 ? Math.min(goal.currentAmount / goal.targetAmount, 1) : 0;
              const isAdding  = addingTo === goal.id;
              const completed = goal.currentAmount >= goal.targetAmount;
              const remaining = goal.targetAmount - goal.currentAmount;

              return (
                <View
                  key={goal.id}
                  style={[styles.goalCard, {
                    backgroundColor: colors.surface,
                    borderRadius: radius.lg,
                    borderWidth: 1,
                    borderColor: colors.border,
                    ...(isDark ? {} : { shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.04, shadowRadius: 2, elevation: 1 }),
                  }]}
                >
                  {/* Header row */}
                  <View style={styles.goalHeader}>
                    <View style={[styles.goalIcon, { backgroundColor: goal.color + '22', borderRadius: radius.md }]}>
                      <Text style={{ fontSize: 20 }}>{goal.icon || '🌱'}</Text>
                    </View>
                    <View style={{ flex: 1 }}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                        <Text style={{ color: colors.textPrimary, fontSize: 17, fontWeight: '600', letterSpacing: -0.2, flex: 1 }}>
                          {goal.name}
                        </Text>
                        {completed && (
                          <Ionicons name="checkmark-circle" size={18} color={colors.income} />
                        )}
                      </View>
                      {goal.targetDate && (
                        <Text style={{ color: colors.textTertiary, fontSize: 12, letterSpacing: 0.2, marginTop: 2 }}>
                          Target: {format(new Date(goal.targetDate + 'T00:00:00'), 'MMM d, yyyy')}
                        </Text>
                      )}
                    </View>
                    <Pressable
                      onPress={() => confirmDeleteGoal(goal)}
                      hitSlop={8}
                      style={({ pressed }) => ({ opacity: pressed ? 0.5 : 1 })}
                    >
                      <Ionicons name="trash-outline" size={16} color={colors.textTertiary} />
                    </Pressable>
                  </View>

                  {/* Amounts */}
                  <View style={styles.amountRow}>
                    <View>
                      <Text style={{ color: colors.textTertiary, fontSize: 11, fontWeight: '500', letterSpacing: 0.3, textTransform: 'uppercase', marginBottom: 2 }}>
                        Saved
                      </Text>
                      <Text style={{ color: goal.color, fontSize: 22, fontWeight: '600', letterSpacing: -0.4 }}>
                        {formatCurrency(goal.currentAmount)}
                      </Text>
                    </View>
                    {!completed && (
                      <View style={{ alignItems: 'flex-end' }}>
                        <Text style={{ color: colors.textTertiary, fontSize: 11, fontWeight: '500', letterSpacing: 0.3, textTransform: 'uppercase', marginBottom: 2 }}>
                          Remaining
                        </Text>
                        <Text style={{ color: colors.textSecondary, fontSize: 17, fontWeight: '600', letterSpacing: -0.2 }}>
                          {formatCurrency(remaining)}
                        </Text>
                      </View>
                    )}
                  </View>

                  {/* Progress bar */}
                  <View style={[styles.progressTrack, { backgroundColor: colors.surfaceElevated, marginTop: 10 }]}>
                    <View style={[styles.progressFill, {
                      width: `${ratio * 100}%`,
                      backgroundColor: completed ? colors.income : goal.color,
                    }]} />
                  </View>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 6 }}>
                    <Text style={{ color: colors.textTertiary, fontSize: 11 }}>
                      {Math.round(ratio * 100)}% complete
                    </Text>
                    <Text style={{ color: colors.textTertiary, fontSize: 11 }}>
                      {formatCurrency(goal.targetAmount)}
                    </Text>
                  </View>

                  {/* Add money section */}
                  {!completed && (
                    <View style={{ marginTop: 14 }}>
                      {isAdding ? (
                        <View style={{ gap: 10 }}>

                          {/* Amount input */}
                          <View style={[styles.inputRow, {
                            backgroundColor: colors.surfaceElevated,
                            borderRadius: radius.md,
                            borderWidth: 1,
                            borderColor: colors.accent,
                          }]}>
                            <Text style={{ color: goal.color, fontWeight: '600', fontSize: 17 }}>₱</Text>
                            <TextInput
                              value={addAmount}
                              onChangeText={setAddAmount}
                              placeholder="0.00"
                              placeholderTextColor={colors.textTertiary}
                              keyboardType="decimal-pad"
                              autoFocus
                              style={{ flex: 1, color: colors.textPrimary, fontSize: 17, marginLeft: 8, fontFamily: 'Montserrat_400Regular' }}
                            />
                          </View>

                          {/* Account picker */}
                          <Text style={{ color: colors.textTertiary, fontSize: 11, fontWeight: '500', letterSpacing: 0.3, textTransform: 'uppercase' }}>
                            Save from
                          </Text>
                          <ScrollView
                            horizontal
                            showsHorizontalScrollIndicator={false}
                            contentContainerStyle={{ gap: 8 }}
                          >
                            {accounts.map((acct) => {
                              const isSelected = selectedAccountId === acct.id;
                              return (
                                <Pressable
                                  key={acct.id}
                                  onPress={() => setSelectedAccountId(acct.id)}
                                  style={({ pressed }) => ({
                                    paddingHorizontal: 12,
                                    paddingVertical: 9,
                                    borderRadius: radius.lg,
                                    borderWidth: isSelected ? 1.5 : 1,
                                    borderColor: isSelected ? goal.color : colors.border,
                                    backgroundColor: isSelected ? goal.color + '15' : colors.surfaceElevated,
                                    opacity: pressed ? 0.75 : 1,
                                    gap: 2,
                                  })}
                                >
                                  <Text style={{ color: isSelected ? goal.color : colors.textPrimary, fontSize: 12, fontWeight: '700' }}>
                                    {acct.name}
                                  </Text>
                                  <Text style={{ color: isSelected ? goal.color : colors.textTertiary, fontSize: 11 }}>
                                    {formatCurrency(acct.balance)}
                                  </Text>
                                </Pressable>
                              );
                            })}
                          </ScrollView>

                          {/* Buttons */}
                          <View style={{ flexDirection: 'row', gap: 8 }}>
                            <Pressable
                              style={({ pressed }) => [styles.actionBtn, { flex: 1, backgroundColor: colors.surfaceElevated, borderRadius: radius.md, opacity: pressed ? 0.7 : 1 }]}
                              onPress={() => { setAddingTo(null); setAddAmount(''); setSelectedAccountId(null); }}
                            >
                              <Text style={{ color: colors.textSecondary, fontWeight: '500', fontSize: 14 }}>Cancel</Text>
                            </Pressable>
                            <Pressable
                              style={({ pressed }) => [styles.actionBtn, { flex: 2, backgroundColor: selectedAccountId ? goal.color : colors.border, borderRadius: radius.md, opacity: pressed ? 0.8 : 1 }]}
                              onPress={() => handleAddMoney(goal)}
                            >
                              <Text style={{ fontSize: 15 }}>{goal.icon || '🌱'}</Text>
                              <Text style={{ color: '#fff', fontWeight: '600', fontSize: 14 }}>Save Money</Text>
                            </Pressable>
                          </View>

                        </View>
                      ) : (
                        <Pressable
                          style={({ pressed }) => [styles.actionBtn, {
                            backgroundColor: goal.color + '15',
                            borderRadius: radius.md,
                            borderColor: goal.color + '40',
                            borderWidth: 1,
                            opacity: pressed ? 0.7 : 1,
                          }]}
                          onPress={() => { setAddingTo(goal.id); setAddAmount(''); setSelectedAccountId(null); }}
                        >
                          <Ionicons name="add-circle-outline" size={15} color={goal.color} />
                          <Text style={{ color: goal.color, fontWeight: '500', fontSize: 14 }}>Add Money</Text>
                        </Pressable>
                      )}
                    </View>
                  )}
                </View>
              );
            })}
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  addBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 14, paddingVertical: 8 },
  emptyIcon: { width: 52, height: 52, borderRadius: 9999, alignItems: 'center', justifyContent: 'center' },
  goalCard: { padding: 16 },
  goalHeader: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, marginBottom: 14 },
  goalIcon: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  amountRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end' },
  progressTrack: { height: 6, width: '100%', borderRadius: 9999, overflow: 'hidden' },
  progressFill: { height: '100%', borderRadius: 9999 },
  inputRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, paddingVertical: 12 },
  actionBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 6, paddingVertical: 11,
  },
});
