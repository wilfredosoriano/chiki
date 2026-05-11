/**
 * Add Transaction modal — create expense, income, or transfer transactions.
 */
import { useState, useEffect } from 'react';
import {
  View, ScrollView, TouchableOpacity, TextInput, StyleSheet,
  Alert, KeyboardAvoidingView, Platform, Keyboard,
} from 'react-native';
import { Text } from '@/components/ui/Text';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { format } from '@/utils/dateUtils';
import { useTheme } from '@/hooks/useTheme';
import { useAccountStore } from '@/stores/accountStore';
import { useTransactionStore } from '@/stores/transactionStore';
import { useNotificationStore } from '@/stores/notificationStore';
import { DatePickerSheet } from '@/components/ui/DatePickerSheet';
import { CalculatorPad } from '@/components/ui/CalculatorPad';
import { getDatabase } from '@/db/database';
import { insertTransaction, getSpendingByCategory } from '@/db/transactionQueries';
import { updateAccountBalance } from '@/db/accountQueries';
import { getCategoriesByType } from '@/db/categoryQueries';
import { getBudgetsByMonth } from '@/db/budgetQueries';
import { sendBudgetAlert } from '@/utils/notifications';
import type { Category, Transaction, TransactionType } from '@/types';

function generateId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

function formatCurrency(amount: number) {
  return '₱' + amount.toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

const TYPE_CONFIG: Record<TransactionType, { label: string; color: string; lightColor: string; icon: keyof typeof Ionicons.glyphMap }> = {
  expense: { label: 'Expense', color: '#EF4444', lightColor: '#FEE2E2', icon: 'arrow-down-circle-outline' },
  income:  { label: 'Income',  color: '#10B981', lightColor: '#D1FAE5', icon: 'arrow-up-circle-outline' },
  transfer:{ label: 'Transfer',color: '#5F6266', lightColor: '#EEEEF0', icon: 'swap-horizontal-outline'  },
};

export default function AddTransactionScreen() {
  const { colors, typography, spacing, radius } = useTheme();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ type?: string }>();
  const { accounts } = useAccountStore();
  const { addTransaction } = useTransactionStore();
  const updateAccountInStore = useAccountStore((s) => s.updateAccount);
  const budgetAlertsEnabled = useNotificationStore((s) => s.budgetAlertsEnabled);

  const initialType = (params.type as TransactionType | undefined) ?? null;
  const [txType, setTxType] = useState<TransactionType | null>(initialType);
  const [amount, setAmount] = useState('0');
  const [keyboardVisible, setKeyboardVisible] = useState(false);
  const [selectedAccountId, setSelectedAccountId] = useState<string>(accounts[0]?.id ?? '');
  const [selectedToAccountId, setSelectedToAccountId] = useState<string>('');
  const [selectedCategoryId, setSelectedCategoryId] = useState<string>('');
  const [date, setDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [note, setNote] = useState('');
  const [categories, setCategories] = useState<Category[]>([]);
  const [saving, setSaving] = useState(false);

  // Load categories when type is selected
  useEffect(() => {
    if (!txType || txType === 'transfer') {
      setCategories([]);
      setSelectedCategoryId('');
      return;
    }
    (async () => {
      const db = await getDatabase();
      const cats = await getCategoriesByType(db, txType);
      setCategories(cats);
      if (cats.length > 0) setSelectedCategoryId(cats[0].id);
    })();
  }, [txType]);

  // Pre-select to-account for transfers
  useEffect(() => {
    if (txType === 'transfer' && accounts.length >= 2) {
      const other = accounts.find((a) => a.id !== selectedAccountId);
      if (other) setSelectedToAccountId(other.id);
    }
  }, [txType, selectedAccountId]);

  // Hide calculator pad when system keyboard appears (e.g. note field focused)
  useEffect(() => {
    const show = Keyboard.addListener('keyboardDidShow', () => setKeyboardVisible(true));
    const hide = Keyboard.addListener('keyboardDidHide', () => setKeyboardVisible(false));
    return () => { show.remove(); hide.remove(); };
  }, []);

  async function handleSave() {
    if (!txType) return;
    const parsedAmount = parseFloat(amount);
    if (isNaN(parsedAmount) || parsedAmount <= 0) {
      Alert.alert('Invalid amount', 'Please enter a valid amount greater than 0.');
      return;
    }
    if (!selectedAccountId) {
      Alert.alert('No account', 'Please select an account.');
      return;
    }
    if (txType !== 'transfer' && !selectedCategoryId) {
      Alert.alert('No category', 'Please select a category.');
      return;
    }
    if (txType === 'transfer') {
      if (!selectedToAccountId || selectedToAccountId === selectedAccountId) {
        Alert.alert('Invalid transfer', 'Please select a different destination account.');
        return;
      }
    }

    // Prevent balance from going negative for expenses and transfers
    if (txType === 'expense' || txType === 'transfer') {
      const fromAccount = accounts.find((a) => a.id === selectedAccountId);
      if (fromAccount && parsedAmount > fromAccount.balance) {
        Alert.alert(
          'Insufficient Balance',
          `${fromAccount.name} only has ${formatCurrency(fromAccount.balance)}. ` +
          `You cannot ${txType === 'transfer' ? 'transfer' : 'spend'} ${formatCurrency(parsedAmount)}.`
        );
        return;
      }
    }

    setSaving(true);
    try {
      const db = await getDatabase();
      const now = new Date().toISOString();

      // For transfers use a generic "transfer" category fallback
      const categoryId = txType === 'transfer' ? 'cat_other' : selectedCategoryId;

      // Auto-generate a descriptive note for transfers when the user didn't type one
      // e.g. "BDO → GCash" so the transaction list never shows just "Other"
      let resolvedNote = note.trim() || undefined;
      if (txType === 'transfer' && !resolvedNote) {
        const fromAcct = accounts.find((a) => a.id === selectedAccountId);
        const toAcct   = accounts.find((a) => a.id === selectedToAccountId);
        if (fromAcct && toAcct) {
          resolvedNote = `${fromAcct.name} → ${toAcct.name}`;
        }
      }

      const tx: Transaction = {
        id: generateId(),
        accountId: selectedAccountId,
        toAccountId: txType === 'transfer' ? selectedToAccountId : undefined,
        type: txType,
        amount: parsedAmount,
        categoryId,
        note: resolvedNote,
        date,
        isRecurring: false,
        createdAt: now,
        updatedAt: now,
      };

      await insertTransaction(db, tx);
      addTransaction(tx);

      // Update account balances
      const fromAccount = accounts.find((a) => a.id === selectedAccountId);
      if (fromAccount) {
        let newBalance = fromAccount.balance;
        if (txType === 'expense') newBalance -= parsedAmount;
        else if (txType === 'income') newBalance += parsedAmount;
        else if (txType === 'transfer') newBalance -= parsedAmount;
        await updateAccountBalance(db, fromAccount.id, newBalance);
        updateAccountInStore(fromAccount.id, { balance: newBalance });
      }

      if (txType === 'transfer' && selectedToAccountId) {
        const toAccount = accounts.find((a) => a.id === selectedToAccountId);
        if (toAccount) {
          const newBalance = toAccount.balance + parsedAmount;
          await updateAccountBalance(db, toAccount.id, newBalance);
          updateAccountInStore(toAccount.id, { balance: newBalance });
        }
      }

      // Budget alert — check if this expense pushes a category over 80/90/100%
      if (txType === 'expense' && budgetAlertsEnabled && selectedCategoryId) {
        try {
          const now = new Date();
          const yr = now.getFullYear();
          const mo = now.getMonth() + 1;
          const [spends, budgets] = await Promise.all([
            getSpendingByCategory(db, yr, mo),
            getBudgetsByMonth(db, yr, mo),
          ]);
          const catSpend = spends.find((s) => s.categoryId === selectedCategoryId);
          const catBudget = budgets.find((b) => b.categoryId === selectedCategoryId);
          if (catSpend && catBudget) {
            const catName = categories.find((c) => c.id === selectedCategoryId)?.name ?? selectedCategoryId;
            await sendBudgetAlert(catName, catSpend.total, catBudget.amount);
          }
        } catch {
          // Non-fatal — don't block the save
        }
      }

      router.back();
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      console.error('[AddTransaction] save failed:', msg);
      Alert.alert('Error saving transaction', msg);
    } finally {
      setSaving(false);
    }
  }

  const typeConfig = txType ? TYPE_CONFIG[txType] : null;

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>

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
          {txType ? `Add ${TYPE_CONFIG[txType].label}` : 'New Transaction'}
        </Text>
        <View style={{ width: 40 }} />
      </View>

      {/* Step 1 — Type selector */}
      {!txType && (
        <ScrollView contentContainerStyle={{ padding: spacing.lg, gap: spacing.md }}>
          <Text style={{ color: colors.textSecondary, fontSize: typography.sizes.sm, marginBottom: spacing.sm }}>
            What type of transaction?
          </Text>
          {(Object.entries(TYPE_CONFIG) as [TransactionType, typeof TYPE_CONFIG[TransactionType]][]).map(([type, cfg]) => (
            <TouchableOpacity
              key={type}
              style={[styles.typeCard, {
                backgroundColor: colors.surface,
                borderColor: colors.border,
                borderRadius: radius.lg,
              }]}
              onPress={() => { setTxType(type); setAmount('0'); }}
            >
              <View style={[styles.typeIcon, { backgroundColor: cfg.lightColor, borderRadius: radius.md }]}>
                <Ionicons name={cfg.icon} size={26} color={cfg.color} />
              </View>
              <Text style={{ flex: 1, color: colors.textPrimary, fontWeight: '700', fontSize: typography.sizes.base }}>
                {cfg.label}
              </Text>
              <Ionicons name="chevron-forward" size={18} color={colors.textTertiary} />
            </TouchableOpacity>
          ))}
        </ScrollView>
      )}

      {/* Step 2 — Form + Calculator Pad */}
      {txType && typeConfig && (
        <>
          {/* KeyboardAvoidingView only wraps the scroll area (for the note field) */}
          <KeyboardAvoidingView
            style={{ flex: 1 }}
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          >
            <ScrollView
              style={{ flex: 1 }}
              contentContainerStyle={{ padding: spacing.lg, gap: spacing.lg, paddingBottom: insets.bottom + 16 }}
              keyboardShouldPersistTaps="handled"
            >
              {/* Type badge */}
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
                <TouchableOpacity
                  style={[styles.typeBadge, { backgroundColor: typeConfig.lightColor, borderRadius: radius.full }]}
                  onPress={() => { setTxType(null); setAmount('0'); }}
                >
                  <Ionicons name={typeConfig.icon} size={16} color={typeConfig.color} />
                  <Text style={{ color: typeConfig.color, fontSize: typography.sizes.sm, fontWeight: '700' }}>
                    {typeConfig.label}
                  </Text>
                </TouchableOpacity>
                <Text style={{ color: colors.textTertiary, fontSize: typography.sizes.xs }}>Tap to change</Text>
              </View>

              {/* Amount display — read-only, driven by CalculatorPad */}
              <View style={{ gap: spacing.xs }}>
                <Text style={{ color: colors.textSecondary, fontSize: typography.sizes.sm, fontWeight: '600' }}>
                  Amount
                </Text>
                <View style={[styles.amountRow, {
                  backgroundColor: colors.surface,
                  borderColor: colors.border,
                  borderRadius: radius.md,
                }]}>
                  <Text style={{ color: typeConfig.color, fontSize: 28, fontWeight: '800' }}>₱</Text>
                  <Text
                    style={{
                      flex: 1,
                      color: amount === '0' ? colors.textTertiary : colors.textPrimary,
                      fontSize: 28,
                      fontWeight: '800',
                      fontFamily: 'Montserrat_800ExtraBold',
                      marginLeft: spacing.sm,
                    }}
                    numberOfLines={1}
                    adjustsFontSizeToFit
                  >
                    {amount}
                  </Text>
                </View>
              </View>

              {/* From Account selector */}
              <View style={{ gap: spacing.sm }}>
                <Text style={{ color: colors.textSecondary, fontSize: typography.sizes.sm, fontWeight: '600' }}>
                  {txType === 'transfer' ? 'From Account' : 'Account'}
                </Text>
                {accounts.length === 0 ? (
                  <Text style={{ color: colors.textTertiary, fontSize: typography.sizes.sm }}>
                    No accounts yet. Add one first.
                  </Text>
                ) : (
                  <View style={{ gap: spacing.xs }}>
                    {accounts.map((acc) => {
                      const selected = acc.id === selectedAccountId;
                      const accountTypeLabel = acc.type
                        ? acc.type.charAt(0).toUpperCase() + acc.type.slice(1)
                        : 'Account';
                      return (
                        <TouchableOpacity
                          key={acc.id}
                          onPress={() => setSelectedAccountId(acc.id)}
                          style={[styles.accountCard, {
                            backgroundColor: selected ? acc.color + '12' : colors.surface,
                            borderColor: selected ? acc.color : colors.border,
                            borderRadius: radius.lg,
                          }]}
                        >
                          <View style={[styles.accountStrip, { backgroundColor: acc.color }]} />
                          <View style={{ flex: 1, paddingLeft: spacing.sm }}>
                            <Text style={{ color: colors.textPrimary, fontSize: typography.sizes.base, fontWeight: '700', letterSpacing: -0.2 }}>
                              {acc.name}
                            </Text>
                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 2 }}>
                              <View style={[styles.typePill, { backgroundColor: acc.color + '20' }]}>
                                <Text style={{ color: acc.color, fontSize: 10, fontWeight: '700', letterSpacing: 0.3 }}>
                                  {accountTypeLabel.toUpperCase()}
                                </Text>
                              </View>
                            </View>
                          </View>
                          <View style={{ alignItems: 'flex-end', gap: 4 }}>
                            <Text style={{ color: selected ? acc.color : colors.textPrimary, fontSize: typography.sizes.base, fontWeight: '700', letterSpacing: -0.3 }}>
                              {formatCurrency(acc.balance)}
                            </Text>
                            {selected ? (
                              <View style={[styles.checkCircle, { backgroundColor: acc.color }]}>
                                <Ionicons name="checkmark" size={10} color="#fff" />
                              </View>
                            ) : (
                              <View style={[styles.checkCircle, { backgroundColor: colors.border }]} />
                            )}
                          </View>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                )}
              </View>

              {/* To Account for transfers */}
              {txType === 'transfer' && (
                <View style={{ gap: spacing.sm }}>
                  <Text style={{ color: colors.textSecondary, fontSize: typography.sizes.sm, fontWeight: '600' }}>
                    To Account
                  </Text>
                  <View style={{ gap: spacing.xs }}>
                    {accounts.filter((a) => a.id !== selectedAccountId).map((acc) => {
                      const selected = acc.id === selectedToAccountId;
                      const accountTypeLabel = acc.type
                        ? acc.type.charAt(0).toUpperCase() + acc.type.slice(1)
                        : 'Account';
                      return (
                        <TouchableOpacity
                          key={acc.id}
                          onPress={() => setSelectedToAccountId(acc.id)}
                          style={[styles.accountCard, {
                            backgroundColor: selected ? acc.color + '12' : colors.surface,
                            borderColor: selected ? acc.color : colors.border,
                            borderRadius: radius.lg,
                          }]}
                        >
                          <View style={[styles.accountStrip, { backgroundColor: acc.color }]} />
                          <View style={{ flex: 1, paddingLeft: spacing.sm }}>
                            <Text style={{ color: colors.textPrimary, fontSize: typography.sizes.base, fontWeight: '700', letterSpacing: -0.2 }}>
                              {acc.name}
                            </Text>
                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 2 }}>
                              <View style={[styles.typePill, { backgroundColor: acc.color + '20' }]}>
                                <Text style={{ color: acc.color, fontSize: 10, fontWeight: '700', letterSpacing: 0.3 }}>
                                  {accountTypeLabel.toUpperCase()}
                                </Text>
                              </View>
                            </View>
                          </View>
                          <View style={{ alignItems: 'flex-end', gap: 4 }}>
                            <Text style={{ color: selected ? acc.color : colors.textPrimary, fontSize: typography.sizes.base, fontWeight: '700', letterSpacing: -0.3 }}>
                              {formatCurrency(acc.balance)}
                            </Text>
                            {selected ? (
                              <View style={[styles.checkCircle, { backgroundColor: acc.color }]}>
                                <Ionicons name="checkmark" size={10} color="#fff" />
                              </View>
                            ) : (
                              <View style={[styles.checkCircle, { backgroundColor: colors.border }]} />
                            )}
                          </View>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                </View>
              )}

              {/* Category selector (not for transfers) */}
              {txType !== 'transfer' && (
                <View style={{ gap: spacing.sm }}>
                  <Text style={{ color: colors.textSecondary, fontSize: typography.sizes.sm, fontWeight: '600' }}>
                    Category
                  </Text>
                  <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs }}>
                    {categories.map((cat) => {
                      const selected = cat.id === selectedCategoryId;
                      return (
                        <TouchableOpacity
                          key={cat.id}
                          onPress={() => setSelectedCategoryId(cat.id)}
                          style={[styles.categoryChip, {
                            backgroundColor: selected ? cat.color : colors.surface,
                            borderColor: selected ? cat.color : colors.border,
                            borderRadius: radius.md,
                          }]}
                        >
                          {selected && <Ionicons name="checkmark-circle" size={13} color="#fff" />}
                          <Text style={{
                            color: selected ? '#fff' : colors.textPrimary,
                            fontSize: typography.sizes.sm,
                            fontWeight: selected ? '700' : '500',
                          }}>
                            {cat.name}
                          </Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                </View>
              )}

              {/* Date */}
              <DatePickerSheet
                label="Date"
                value={date}
                onChange={(d) => setDate(d ?? format(new Date(), 'yyyy-MM-dd'))}
              />

              {/* Note */}
              <View style={{ gap: spacing.xs }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.xs }}>
                  <Text style={{ color: colors.textSecondary, fontSize: typography.sizes.sm, fontWeight: '600' }}>
                    Note
                  </Text>
                  <View style={[styles.optionalBadge, { backgroundColor: colors.surfaceSecondary }]}>
                    <Text style={{ color: colors.textTertiary, fontSize: 10, fontWeight: '600' }}>OPTIONAL</Text>
                  </View>
                </View>
                <TextInput
                  value={note}
                  onChangeText={setNote}
                  placeholder="Add a note..."
                  placeholderTextColor={colors.textTertiary}
                  style={[styles.input, {
                    backgroundColor: colors.surface,
                    borderColor: colors.border,
                    color: colors.textPrimary,
                    borderRadius: radius.md,
                    fontSize: typography.sizes.base,
                    fontFamily: 'Montserrat_400Regular',
                  }]}
                />
              </View>

              {/* Save button */}
              <TouchableOpacity
                style={[styles.saveBtn, {
                  backgroundColor: saving ? colors.border : typeConfig.color,
                  borderRadius: radius.lg,
                  marginTop: spacing.sm,
                }]}
                onPress={handleSave}
                disabled={saving}
              >
                <Ionicons name="checkmark-circle-outline" size={20} color="#fff" />
                <Text style={{ color: '#fff', fontWeight: '700', fontSize: typography.sizes.base }}>
                  {saving ? 'Saving...' : `Save ${typeConfig.label}`}
                </Text>
              </TouchableOpacity>
            </ScrollView>
          </KeyboardAvoidingView>

          {/* Calculator pad — hidden when system keyboard is open (note field) */}
          {!keyboardVisible && (
            <CalculatorPad
              value={amount}
              onChange={setAmount}
              accentColor={typeConfig.color}
            />
          )}
        </>
      )}
    </View>
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
  typeCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    padding: 16,
    borderWidth: 1,
  },
  typeIcon: { width: 52, height: 52, alignItems: 'center', justifyContent: 'center' },
  typeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
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
  accountCard: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1.5,
    paddingVertical: 12,
    paddingRight: 14,
    overflow: 'hidden',
  },
  accountStrip: {
    width: 4,
    alignSelf: 'stretch',
    borderRadius: 2,
    marginLeft: 12,
  },
  typePill: {
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 99,
  },
  checkCircle: {
    width: 18,
    height: 18,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
  },
  categoryChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    borderWidth: 1.5,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 13,
  },
  input: {
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 13,
  },
  optionalBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  saveBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 16,
  },
});
