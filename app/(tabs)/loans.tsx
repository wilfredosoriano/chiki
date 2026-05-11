/**
 * Loans screen — track outstanding loans and record monthly payments.
 * Design: two-col stats header, progress bars, clean payment input.
 */
import { useState, useCallback, useRef } from 'react';
import { View, ScrollView, Pressable, TextInput, StyleSheet, Alert } from 'react-native';
import { Text } from '@/components/ui/Text';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { router, useFocusEffect } from 'expo-router';
import { format, differenceInCalendarDays } from '@/utils/dateUtils';
import { useTheme } from '@/hooks/useTheme';
import { getDatabase } from '@/db/database';
import { getAllLoans, updateLoanBalance, deleteLoan } from '@/db/loanQueries';
import { updateAccountBalance } from '@/db/accountQueries';
import { insertTransaction } from '@/db/transactionQueries';
import { useAccountStore } from '@/stores/accountStore';
import { useTransactionStore } from '@/stores/transactionStore';
import type { Loan, Transaction } from '@/types';

function formatCurrency(amount: number) {
  return '₱' + amount.toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function ordinal(n: number): string {
  const s = ['th', 'st', 'nd', 'rd'];
  const v = n % 100;
  return n + (s[(v - 20) % 10] ?? s[v] ?? s[0]);
}

/** Returns days until next due date + the weekday name. */
function getNextDueInfo(dueDayOfMonth: number): { daysLeft: number; dayName: string } {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  // Build due date for this month; if already passed, roll to next month
  let nextDue = new Date(today.getFullYear(), today.getMonth(), dueDayOfMonth);
  if (nextDue <= today) {
    nextDue = new Date(today.getFullYear(), today.getMonth() + 1, dueDayOfMonth);
  }

  return {
    daysLeft: differenceInCalendarDays(nextDue, today),
    dayName:  format(nextDue, 'EEEE'),   // e.g. "Saturday"
  };
}

export default function LoansScreen() {
  const { colors, radius, isDark } = useTheme();
  const insets = useSafeAreaInsets();

  const { accounts, updateAccount } = useAccountStore();
  const { addTransaction } = useTransactionStore();

  const [loans,      setLoans]      = useState<Loan[]>([]);
  const [loading,    setLoading]    = useState(true);
  const [payingId,   setPayingId]   = useState<string | null>(null);
  const [payAmount,  setPayAmount]  = useState('');
  const [selectedAccountId, setSelectedAccountId] = useState<string | null>(null);
  const hasLoaded = useRef(false);

  useFocusEffect(
    useCallback(() => {
      let active = true;
      (async () => {
        if (!hasLoaded.current) setLoading(true);
        const db   = await getDatabase();
        const list = await getAllLoans(db);
        if (!active) return;

        // Auto-fix any loans that have remainingBalance ≤ 0 but are still marked active
        // (can happen due to floating-point residuals from previous payments)
        const stuckLoans = list.filter((l) => l.isActive && l.remainingBalance <= 0);
        if (stuckLoans.length > 0) {
          await Promise.all(stuckLoans.map((l) => updateLoanBalance(db, l.id, 0)));
          stuckLoans.forEach((l) => { l.remainingBalance = 0; l.isActive = false; });
        }

        setLoans(list);
        setLoading(false);
        hasLoaded.current = true;
      })();
      return () => { active = false; };
    }, [])
  );

  async function handlePayment(loan: Loan) {
    const parsed = parseFloat(payAmount.replace(/,/g, ''));
    if (isNaN(parsed) || parsed <= 0) {
      Alert.alert('Invalid amount', 'Enter a valid payment amount.');
      return;
    }
    if (!selectedAccountId) {
      Alert.alert('No account selected', 'Please choose which account to pay from.');
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
        `${account.name} only has ${formatCurrency(account.balance)}. Not enough to pay ${formatCurrency(parsed)}.`,
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Pay Anyway', style: 'destructive', onPress: () => commitPayment(loan, account, parsed) },
        ]
      );
      return;
    }
    await commitPayment(loan, account, parsed);
  }

  async function commitPayment(loan: Loan, account: ReturnType<typeof useAccountStore.getState>['accounts'][0], parsed: number) {
    try {
      const db  = await getDatabase();
      const now = new Date().toISOString();
      const d   = new Date();
      const localDate = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

      // 1. Reduce loan balance — round to 2 dp to avoid floating-point residuals
      //    (e.g. 3026.32 - 756.58 * 4 = 0.0000001 instead of 0, keeping loan "active")
      const rawBalance = Math.round((loan.remainingBalance - parsed) * 100) / 100;
      const newLoanBalance = Math.max(0, rawBalance);
      await updateLoanBalance(db, loan.id, newLoanBalance);

      // 2. Deduct from account
      const newAccountBalance = account.balance - parsed;
      await updateAccountBalance(db, account.id, newAccountBalance);
      updateAccount(account.id, { balance: newAccountBalance });

      // 3. Record transaction
      const tx: Transaction = {
        id: Date.now().toString(36) + Math.random().toString(36).slice(2, 7),
        accountId: account.id,
        type: 'expense',
        amount: parsed,
        categoryId: 'cat_loan_payment',
        note: `Loan Payment: ${loan.name}`,
        date: localDate,
        isRecurring: false,
        createdAt: now,
        updatedAt: now,
      };
      await insertTransaction(db, tx);
      addTransaction(tx);

      // 4. Update local loan state
      setLoans((prev) =>
        prev.map((l) => l.id === loan.id
          ? { ...l, remainingBalance: newLoanBalance, isActive: newLoanBalance > 0 }
          : l
        )
      );
      setPayingId(null);
      setPayAmount('');
      setSelectedAccountId(null);

      if (newLoanBalance === 0) {
        Alert.alert('🎉 Paid Off!', `${loan.name} has been fully paid off. Congratulations!`);
      } else {
        Alert.alert(
          'Payment Recorded',
          `${formatCurrency(parsed)} paid from ${account.name}.\nRemaining: ${formatCurrency(newLoanBalance)}`
        );
      }
    } catch (e: unknown) {
      Alert.alert('Error', e instanceof Error ? e.message : String(e));
    }
  }

  function confirmDeleteLoan(loan: Loan) {
    Alert.alert(
      'Delete Loan',
      `Delete "${loan.name}"? This will remove all payment history.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              const db = await getDatabase();
              await deleteLoan(db, loan.id);
              setLoans((prev) => prev.filter((l) => l.id !== loan.id));
            } catch (e: unknown) {
              Alert.alert('Error', e instanceof Error ? e.message : String(e));
            }
          },
        },
      ]
    );
  }

  const activeLoans  = loans.filter((l) => l.isActive);
  const paidLoans    = loans.filter((l) => !l.isActive);
  const totalDebt    = activeLoans.reduce((s, l) => s + l.remainingBalance, 0);
  const totalMonthly = activeLoans.reduce((s, l) => s + l.monthlyPayment, 0);

  const cardStyle = (isDark: boolean) => ({
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    ...(isDark ? {} : { shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.04, shadowRadius: 2, elevation: 1 }),
  });

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
          Loans
        </Text>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <Pressable
            onPress={() => router.push('/(modals)/add-loan')}
            style={({ pressed }) => [styles.addBtn, { backgroundColor: colors.accent, borderRadius: radius.lg, opacity: pressed ? 0.8 : 1 }]}
          >
            <Ionicons name="add" size={18} color={'#FFFFFF'} />
            <Text style={{ color: '#FFFFFF', fontSize: 13, fontWeight: '600' }}>Add</Text>
          </Pressable>
        </View>
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
        ) : loans.length === 0 ? (

          <View style={{ alignItems: 'center', paddingTop: 64, gap: 12 }}>
            <View style={[styles.emptyIcon, { backgroundColor: colors.surfaceElevated }]}>
              <Ionicons name="document-text-outline" size={26} color={colors.textTertiary} />
            </View>
            <Text style={{ color: colors.textPrimary, fontSize: 16, fontWeight: '600', letterSpacing: -0.2 }}>
              No loans tracked
            </Text>
            <Text style={{ color: colors.textTertiary, fontSize: 13, textAlign: 'center', lineHeight: 20 }}>
              Add a loan to track your balance{'\n'}and monthly payments.
            </Text>
            <Pressable
              style={({ pressed }) => [styles.addBtn, { backgroundColor: colors.accent, borderRadius: radius.lg, opacity: pressed ? 0.8 : 1, marginTop: 4 }]}
              onPress={() => router.push('/(modals)/add-loan')}
            >
              <Ionicons name="add" size={16} color={'#FFFFFF'} />
              <Text style={{ color: '#FFFFFF', fontSize: 13, fontWeight: '600' }}>Add Loan</Text>
            </Pressable>
          </View>

        ) : (
          <>
            {/* ── Stats row ── */}
            {activeLoans.length > 0 && (
              <View style={{ borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border, overflow: 'hidden', backgroundColor: colors.surface, marginTop: 20 }}>
                {/* Top section — Total Outstanding */}
                <View style={{ backgroundColor: colors.expense + '10', paddingHorizontal: 18, paddingVertical: 16, borderBottomWidth: 1, borderBottomColor: colors.border }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 6 }}>
                    <Ionicons name="alert-circle" size={16} color={colors.expense} />
                    <Text style={{ color: colors.textTertiary, fontSize: 11, fontWeight: '500', letterSpacing: 0.3, textTransform: 'uppercase' }}>
                      Total Outstanding
                    </Text>
                  </View>
                  <Text style={{ color: colors.expense, fontSize: 28, fontWeight: '700', letterSpacing: -0.6 }}>
                    {formatCurrency(totalDebt)}
                  </Text>
                </View>
                {/* Bottom row — Monthly Due + Active */}
                <View style={{ flexDirection: 'row' }}>
                  <View style={{ flex: 1, padding: 16, alignItems: 'flex-start', justifyContent: 'center' }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5, marginBottom: 4 }}>
                      <Ionicons name="cash-outline" size={13} color={colors.textTertiary} />
                      <Text style={{ color: colors.textTertiary, fontSize: 11, fontWeight: '500', letterSpacing: 0.3, textTransform: 'uppercase' }}>
                        Monthly Due
                      </Text>
                    </View>
                    <Text style={{ color: colors.textPrimary, fontSize: 17, fontWeight: '600', letterSpacing: -0.3 }}>
                      {formatCurrency(totalMonthly)}
                    </Text>
                  </View>
                  <View style={{ width: 1, backgroundColor: colors.border }} />
                  <View style={{ flex: 1, padding: 16, alignItems: 'flex-start', justifyContent: 'center' }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5, marginBottom: 4 }}>
                      <Ionicons name="layers-outline" size={13} color={colors.textTertiary} />
                      <Text style={{ color: colors.textTertiary, fontSize: 11, fontWeight: '500', letterSpacing: 0.3, textTransform: 'uppercase' }}>
                        Active
                      </Text>
                    </View>
                    <Text style={{ color: colors.textPrimary, fontSize: 17, fontWeight: '600', letterSpacing: -0.3 }}>
                      {activeLoans.length} {activeLoans.length === 1 ? 'loan' : 'loans'}
                    </Text>
                  </View>
                </View>
              </View>
            )}

            {/* ── Active loans ── */}
            <View style={{ gap: 12, marginTop: 16 }}>
              {activeLoans.map((loan) => {
                // Use totalPayable as denominator when available (add-on loans where remaining
                // includes pre-loaded interest). Falls back to principalAmount for standard loans.
                const progressBase = loan.totalPayable ?? loan.principalAmount;
                const paidRatio = progressBase > 0
                  ? Math.max(0, Math.min(1, 1 - loan.remainingBalance / progressBase))
                  : 0;
                const isPaying = payingId === loan.id;

                const { daysLeft, dayName } = getNextDueInfo(loan.dueDayOfMonth);

                // Urgency colours
                const urgencyColor = daysLeft <= 0
                  ? colors.expense
                  : daysLeft <= 3
                    ? colors.expense
                    : daysLeft <= 7
                      ? colors.warning
                      : colors.textTertiary;
                const urgencyBg = daysLeft <= 0
                  ? colors.expense   + '18'
                  : daysLeft <= 3
                    ? colors.expense + '15'
                    : daysLeft <= 7
                      ? colors.warning + '15'
                      : colors.surfaceElevated;

                // Label text
                const dueLabel = daysLeft <= 0
                  ? `Due today · ${dayName}`
                  : daysLeft === 1
                    ? `Tomorrow · ${dayName}`
                    : `${daysLeft} days left · ${dayName}`;

                return (
                  <View key={loan.id} style={[styles.loanCard, cardStyle(isDark)]}>
                    {/* Loan header */}
                    <View style={styles.loanHeader}>
                      <View style={[styles.loanIcon, { backgroundColor: loan.color + '22', borderRadius: radius.md }]}>
                        <Ionicons name="document-text-outline" size={18} color={loan.color} />
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={{ color: colors.textPrimary, fontSize: 17, fontWeight: '600', letterSpacing: -0.2 }}>
                          {loan.name}
                        </Text>
                        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 4 }}>
                          {loan.lender ? (
                            <Text style={{ color: colors.textTertiary, fontSize: 12 }}>
                              {loan.lender}
                            </Text>
                          ) : null}
                          <View style={[styles.pill, { backgroundColor: colors.surfaceElevated }]}>
                            <Text style={{ color: colors.textTertiary, fontSize: 11, fontWeight: '500' }}>
                              Due {ordinal(loan.dueDayOfMonth)} monthly
                            </Text>
                          </View>
                          {loan.endDate ? (
                            <View style={[styles.pill, { backgroundColor: colors.accent + '15' }]}>
                              <Text style={{ color: colors.accent, fontSize: 11, fontWeight: '500' }}>
                                Ends {format(new Date(loan.endDate + 'T00:00:00'), 'MMM yyyy')}
                              </Text>
                            </View>
                          ) : null}
                        </View>

                        {/* ── Due-date countdown ── */}
                        <View style={[styles.duePill, { backgroundColor: urgencyBg, marginTop: 8 }]}>
                          <Ionicons
                            name={daysLeft <= 3 ? 'alert-circle-outline' : 'time-outline'}
                            size={12}
                            color={urgencyColor}
                          />
                          <Text style={{ color: urgencyColor, fontSize: 12, fontWeight: '600' }}>
                            {dueLabel}
                          </Text>
                        </View>
                      </View>
                      <View style={{ gap: 10, alignItems: 'center' }}>
                        <Pressable
                          onPress={() => router.push({ pathname: '/(modals)/edit-loan', params: { id: loan.id } })}
                          hitSlop={8}
                          style={({ pressed }) => ({ opacity: pressed ? 0.5 : 1 })}
                        >
                          <Ionicons name="pencil-outline" size={16} color={colors.textTertiary} />
                        </Pressable>
                        <Pressable
                          onPress={() => confirmDeleteLoan(loan)}
                          hitSlop={8}
                          style={({ pressed }) => ({ opacity: pressed ? 0.5 : 1 })}
                        >
                          <Ionicons name="trash-outline" size={16} color={colors.textTertiary} />
                        </Pressable>
                      </View>
                    </View>

                    {/* Amounts */}
                    <View style={styles.amountRow}>
                      <View>
                        <Text style={{ color: colors.textTertiary, fontSize: 11, fontWeight: '500', letterSpacing: 0.3, textTransform: 'uppercase', marginBottom: 2 }}>
                          Remaining
                        </Text>
                        <Text style={{ color: colors.expense, fontSize: 20, fontWeight: '700', letterSpacing: -0.4 }}>
                          {formatCurrency(loan.remainingBalance)}
                        </Text>
                      </View>
                      <View style={{ alignItems: 'flex-end' }}>
                        <Text style={{ color: colors.textTertiary, fontSize: 11, fontWeight: '500', letterSpacing: 0.3, textTransform: 'uppercase', marginBottom: 2 }}>
                          Monthly
                        </Text>
                        <Text style={{ color: colors.textPrimary, fontSize: 17, fontWeight: '600', letterSpacing: -0.2 }}>
                          {formatCurrency(loan.monthlyPayment)}
                        </Text>
                        {loan.interestRatePA ? (
                          <Text style={{ color: colors.textTertiary, fontSize: 11, marginTop: 2 }}>
                            {loan.interestRatePA}% p.a.
                          </Text>
                        ) : null}
                      </View>
                    </View>

                    {/* Progress bar — paid vs remaining */}
                    <View style={[styles.progressTrack, { backgroundColor: colors.surfaceElevated, marginTop: 12 }]}>
                      <View style={[styles.progressFill, {
                        width: `${paidRatio * 100}%`,
                        backgroundColor: colors.income,
                      }]} />
                    </View>
                    <Text style={{ color: colors.textTertiary, fontSize: 11, marginTop: 6 }}>
                      {Math.round(paidRatio * 100)}% paid · {formatCurrency(loan.principalAmount)} borrowed
                    </Text>

                    {/* Payment section */}
                    <View style={{ marginTop: 14 }}>
                      {isPaying ? (
                        <View style={{ gap: 10 }}>
                          {/* Amount input */}
                          <View style={[styles.inputRow, {
                            backgroundColor: colors.surfaceElevated,
                            borderRadius: radius.md,
                            borderWidth: 1,
                            borderColor: colors.accent,
                          }]}>
                            <Text style={{ color: loan.color, fontWeight: '600', fontSize: 17 }}>₱</Text>
                            <TextInput
                              value={payAmount}
                              onChangeText={setPayAmount}
                              placeholder={loan.monthlyPayment.toFixed(2)}
                              placeholderTextColor={colors.textTertiary}
                              keyboardType="decimal-pad"
                              autoFocus
                              style={{ flex: 1, color: colors.textPrimary, fontSize: 17, marginLeft: 8, fontFamily: 'Montserrat_400Regular' }}
                            />
                          </View>

                          {/* Account picker */}
                          <Text style={{ color: colors.textTertiary, fontSize: 11, fontWeight: '500', letterSpacing: 0.3, textTransform: 'uppercase' }}>
                            Pay from
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
                                    borderColor: isSelected ? loan.color : colors.border,
                                    backgroundColor: isSelected ? loan.color + '15' : colors.surfaceElevated,
                                    opacity: pressed ? 0.75 : 1,
                                    gap: 2,
                                  })}
                                >
                                  <Text style={{ color: isSelected ? loan.color : colors.textPrimary, fontSize: 12, fontWeight: '700' }}>
                                    {acct.name}
                                  </Text>
                                  <Text style={{ color: isSelected ? loan.color : colors.textTertiary, fontSize: 11 }}>
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
                              onPress={() => { setPayingId(null); setPayAmount(''); setSelectedAccountId(null); }}
                            >
                              <Text style={{ color: colors.textSecondary, fontWeight: '500', fontSize: 14 }}>Cancel</Text>
                            </Pressable>
                            <Pressable
                              style={({ pressed }) => [styles.actionBtn, { flex: 2, backgroundColor: selectedAccountId ? loan.color : colors.border, borderRadius: radius.md, opacity: pressed ? 0.8 : 1 }]}
                              onPress={() => handlePayment(loan)}
                            >
                              <Ionicons name="checkmark-circle-outline" size={15} color="#fff" />
                              <Text style={{ color: '#fff', fontWeight: '600', fontSize: 14 }}>Record Payment</Text>
                            </Pressable>
                          </View>
                        </View>
                      ) : (
                        <Pressable
                          style={({ pressed }) => [styles.actionBtn, {
                            backgroundColor: loan.color + '15',
                            borderRadius: radius.md,
                            borderColor: loan.color + '40',
                            borderWidth: 1,
                            opacity: pressed ? 0.7 : 1,
                          }]}
                          onPress={() => { setPayingId(loan.id); setPayAmount(loan.monthlyPayment.toFixed(2)); }}
                        >
                          <Ionicons name="cash-outline" size={15} color={loan.color} />
                          <Text style={{ color: loan.color, fontWeight: '500', fontSize: 14 }}>Record Payment</Text>
                        </Pressable>
                      )}
                    </View>
                  </View>
                );
              })}
            </View>

            {/* ── Paid off loans ── */}
            {paidLoans.length > 0 && (
              <>
                <Text style={{ color: colors.textTertiary, fontSize: 11, fontWeight: '500', letterSpacing: 0.5, textTransform: 'uppercase', marginTop: 24, marginBottom: 10 }}>
                  Paid Off
                </Text>
                <View style={[cardStyle(isDark), { overflow: 'hidden' }]}>
                  {paidLoans.map((loan, idx) => {
                    const isLast = idx === paidLoans.length - 1;
                    return (
                      <View key={loan.id} style={[styles.paidRow, !isLast && { borderBottomWidth: 1, borderBottomColor: colors.border }]}>
                        <View style={[styles.loanIcon, { backgroundColor: colors.income + '18', borderRadius: radius.md }]}>
                          <Ionicons name="checkmark-circle-outline" size={18} color={colors.income} />
                        </View>
                        <View style={{ flex: 1 }}>
                          <Text style={{ color: colors.textSecondary, fontSize: 15, fontWeight: '500' }}>
                            {loan.name}
                          </Text>
                          <Text style={{ color: colors.textTertiary, fontSize: 12, marginTop: 1 }}>
                            {formatCurrency(loan.principalAmount)} · Fully paid
                          </Text>
                        </View>
                        <View style={[styles.pill, { backgroundColor: colors.income + '18', marginRight: 6 }]}>
                          <Text style={{ color: colors.income, fontSize: 11, fontWeight: '600' }}>PAID</Text>
                        </View>
                        <Pressable
                          onPress={() => router.push({ pathname: '/(modals)/edit-loan', params: { id: loan.id } })}
                          hitSlop={8}
                          style={({ pressed }) => ({ opacity: pressed ? 0.5 : 1, marginRight: 8 })}
                        >
                          <Ionicons name="pencil-outline" size={16} color={colors.textTertiary} />
                        </Pressable>
                        <Pressable
                          onPress={() => confirmDeleteLoan(loan)}
                          hitSlop={8}
                          style={({ pressed }) => ({ opacity: pressed ? 0.5 : 1 })}
                        >
                          <Ionicons name="trash-outline" size={16} color={colors.textTertiary} />
                        </Pressable>
                      </View>
                    );
                  })}
                </View>
              </>
            )}
          </>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  addBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 14, paddingVertical: 8 },
  emptyIcon: { width: 52, height: 52, borderRadius: 9999, alignItems: 'center', justifyContent: 'center' },
  loanCard: { padding: 16 },
  loanHeader: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, marginBottom: 14 },
  loanIcon: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  pill:    { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 9999 },
  duePill: { flexDirection: 'row', alignItems: 'center', gap: 5, alignSelf: 'flex-start', paddingHorizontal: 9, paddingVertical: 4, borderRadius: 9999 },
  amountRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end' },
  progressTrack: { height: 6, width: '100%', borderRadius: 9999, overflow: 'hidden' },
  progressFill: { height: '100%', borderRadius: 9999 },
  inputRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, paddingVertical: 12 },
  actionBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 11 },
  paidRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingVertical: 13 },
});
