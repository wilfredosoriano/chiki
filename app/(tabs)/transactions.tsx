/**
 * Transactions screen — monthly list grouped by date.
 * Design: flat list rows with border separators, no card-per-item.
 * Undo: trash deletes immediately, bottom toast appears for 4s with Undo button.
 */
import { useState, useMemo, useCallback, useRef, useEffect } from 'react';
import {
  View, ScrollView, Pressable, StyleSheet, Animated,
} from 'react-native';
import { Text } from '@/components/ui/Text';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { router, useFocusEffect } from 'expo-router';
import { format, addMonths, subMonths } from '@/utils/dateUtils';
import { useTheme } from '@/hooks/useTheme';
import { useTransactionStore } from '@/stores/transactionStore';
import { useAccountStore } from '@/stores/accountStore';
import { getDatabase } from '@/db/database';
import { getTransactionsByMonth, deleteTransaction, insertTransaction } from '@/db/transactionQueries';
import { updateAccountBalance } from '@/db/accountQueries';
import { getAllCategories } from '@/db/categoryQueries';
import type { Category, Transaction } from '@/types';

function formatCurrency(amount: number) {
  return '₱' + amount.toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

// ─── Undo state ───────────────────────────────────────────────────────────────
interface BalanceSnapshot { accountId: string; before: number; after: number }
interface UndoEntry { tx: Transaction; snapshots: BalanceSnapshot[] }

// ─── Toast component ──────────────────────────────────────────────────────────
function UndoToast({
  entry,
  onUndo,
  onDismiss,
  bottomOffset,
}: {
  entry: UndoEntry;
  onUndo: () => void;
  onDismiss: () => void;
  bottomOffset: number;
}) {
  const { colors, radius } = useTheme();
  const translateY = useRef(new Animated.Value(80)).current;
  const opacity    = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    // Slide in
    Animated.parallel([
      Animated.spring(translateY, { toValue: 0, useNativeDriver: true, speed: 20, bounciness: 4 }),
      Animated.timing(opacity, { toValue: 1, duration: 180, useNativeDriver: true }),
    ]).start();

    // Auto-dismiss after 4 s
    const timer = setTimeout(() => slideOut(onDismiss), 4000);
    return () => clearTimeout(timer);
  }, []);

  function slideOut(cb: () => void) {
    Animated.parallel([
      Animated.timing(translateY, { toValue: 80, duration: 200, useNativeDriver: true }),
      Animated.timing(opacity, { toValue: 0, duration: 180, useNativeDriver: true }),
    ]).start(cb);
  }

  const label = entry.tx.note ?? '';
  const amountStr =
    (entry.tx.type === 'income' ? '+' : entry.tx.type === 'expense' ? '-' : '') +
    formatCurrency(entry.tx.amount);

  return (
    <Animated.View
      style={[
        styles.toast,
        {
          bottom: bottomOffset,
          backgroundColor: colors.textPrimary,
          borderRadius: radius.lg,
          transform: [{ translateY }],
          opacity,
        },
      ]}
    >
      <View style={{ flex: 1, gap: 2 }}>
        <Text style={{ color: colors.background, fontSize: 13, fontWeight: '500' }} numberOfLines={1}>
          {label ? `"${label}" deleted` : 'Transaction deleted'}
        </Text>
        <Text style={{ color: colors.background, fontSize: 11, opacity: 0.6 }}>
          {amountStr}
        </Text>
      </View>
      <Pressable
        onPress={() => slideOut(onUndo)}
        hitSlop={8}
        style={({ pressed }) => [styles.undoBtn, { opacity: pressed ? 0.7 : 1 }]}
      >
        <Text style={{ color: colors.background, fontSize: 13, fontWeight: '700' }}>Undo</Text>
      </Pressable>
    </Animated.View>
  );
}

// ─── Main Screen ──────────────────────────────────────────────────────────────
export default function TransactionsScreen() {
  const { colors, spacing, radius, isDark } = useTheme();
  const insets = useSafeAreaInsets();
  const { transactions: storeTransactions, deleteTransaction: deleteFromStore, addTransaction } = useTransactionStore();
  const { accounts, updateAccount } = useAccountStore();

  const [currentDate, setCurrentDate]   = useState(new Date());
  const [monthlyTx, setMonthlyTx]       = useState<Transaction[]>([]);
  const [categories, setCategories]     = useState<Map<string, Category>>(new Map());
  const [undoEntry, setUndoEntry]       = useState<UndoEntry | null>(null);

  // timer ref so we can clear on unmount / new deletion
  const dismissTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const year  = currentDate.getFullYear();
  const month = currentDate.getMonth() + 1;
  const monthLabel = format(currentDate, 'MMMM yyyy');

  useFocusEffect(
    useCallback(() => {
      let active = true;
      (async () => {
        const db = await getDatabase();
        const [txs, cats] = await Promise.all([
          getTransactionsByMonth(db, year, month),
          getAllCategories(db),
        ]);
        if (!active) return;
        setMonthlyTx(txs);
        const map = new Map<string, Category>();
        cats.forEach((c) => map.set(c.id, c));
        setCategories(map);
      })();
      return () => { active = false; };
    }, [year, month, storeTransactions])
  );

  // Clean up timer on unmount
  useEffect(() => {
    return () => { if (dismissTimer.current) clearTimeout(dismissTimer.current); };
  }, []);

  const totalIncome   = useMemo(() => monthlyTx.filter((t) => t.type === 'income').reduce((s, t) => s + t.amount, 0), [monthlyTx]);
  const totalExpenses = useMemo(() => monthlyTx.filter((t) => t.type === 'expense').reduce((s, t) => s + t.amount, 0), [monthlyTx]);

  const grouped = useMemo(() => {
    const map = new Map<string, Transaction[]>();
    for (const tx of monthlyTx) {
      const list = map.get(tx.date) ?? [];
      list.push(tx);
      map.set(tx.date, list);
    }
    return Array.from(map.entries()).sort((a, b) => b[0].localeCompare(a[0]));
  }, [monthlyTx]);

  function txColor(type: Transaction['type']) {
    if (type === 'income')  return colors.income;
    if (type === 'expense') return colors.expense;
    return colors.accent;
  }

  // ── Delete: immediate + undo toast ────────────────────────────────────────
  async function handleDelete(tx: Transaction) {
    try {
      const db = await getDatabase();

      // Build balance snapshots before changing anything
      const snapshots: BalanceSnapshot[] = [];

      const srcAcct = accounts.find((a) => a.id === tx.accountId);
      if (srcAcct) {
        let newBal = srcAcct.balance;
        if (tx.type === 'expense')  newBal += tx.amount;
        else if (tx.type === 'income')  newBal -= tx.amount;
        else if (tx.type === 'transfer') newBal += tx.amount;
        snapshots.push({ accountId: srcAcct.id, before: srcAcct.balance, after: newBal });
        await updateAccountBalance(db, srcAcct.id, newBal);
        updateAccount(srcAcct.id, { balance: newBal });
      }

      if (tx.type === 'transfer' && tx.toAccountId) {
        const toAcct = accounts.find((a) => a.id === tx.toAccountId);
        if (toAcct) {
          const newBal = toAcct.balance - tx.amount;
          snapshots.push({ accountId: toAcct.id, before: toAcct.balance, after: newBal });
          await updateAccountBalance(db, toAcct.id, newBal);
          updateAccount(toAcct.id, { balance: newBal });
        }
      }

      await deleteTransaction(db, tx.id);
      deleteFromStore(tx.id);
      setMonthlyTx((prev) => prev.filter((t) => t.id !== tx.id));

      // Show undo toast — dismiss any previous one first
      if (dismissTimer.current) clearTimeout(dismissTimer.current);
      setUndoEntry({ tx, snapshots });

    } catch (e: unknown) {
      const { Alert } = require('react-native');
      Alert.alert('Error', e instanceof Error ? e.message : String(e));
    }
  }

  // ── Undo: re-insert the transaction and restore balances ──────────────────
  async function handleUndo() {
    if (!undoEntry) return;
    const { tx, snapshots } = undoEntry;
    setUndoEntry(null);

    try {
      const db = await getDatabase();

      // Restore balances (use "before" value from snapshot)
      for (const snap of snapshots) {
        await updateAccountBalance(db, snap.accountId, snap.before);
        updateAccount(snap.accountId, { balance: snap.before });
      }

      // Re-insert transaction
      await insertTransaction(db, tx);
      addTransaction(tx);
      setMonthlyTx((prev) => {
        // Re-insert in the correct position (by date desc)
        const next = [...prev, tx].sort((a, b) => {
          if (b.date !== a.date) return b.date.localeCompare(a.date);
          return b.createdAt.localeCompare(a.createdAt);
        });
        return next;
      });

    } catch (e: unknown) {
      const { Alert } = require('react-native');
      Alert.alert('Undo Failed', e instanceof Error ? e.message : String(e));
    }
  }

  // Toast bottom position: above the floating tab bar
  const toastBottom = insets.bottom + 80 + 12;

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>

      {/* ── Sticky header ── */}
      <View style={[styles.header, {
        paddingTop: insets.top + 12,
        paddingHorizontal: 20,
        paddingBottom: 12,
        backgroundColor: colors.background,
        borderBottomWidth: 1,
        borderBottomColor: colors.border,
      }]}>
        {/* Title + Add */}
        <View style={styles.headerRow}>
          <Text style={{ color: colors.textPrimary, fontSize: 22, fontWeight: '600', letterSpacing: -0.4 }}>
            Transactions
          </Text>
          <Pressable
            onPress={() => router.push('/(modals)/add-transaction')}
            style={({ pressed }) => [styles.addBtn, { backgroundColor: colors.accent, borderRadius: radius.lg, opacity: pressed ? 0.8 : 1 }]}
          >
            <Ionicons name="add" size={18} color={'#FFFFFF'} />
            <Text style={{ color: '#FFFFFF', fontSize: 13, fontWeight: '600' }}>Add</Text>
          </Pressable>
        </View>

        {/* Month navigator */}
        <View style={[styles.monthNav, {
          backgroundColor: colors.surfaceElevated,
          borderRadius: radius.lg,
          marginTop: 12,
        }]}>
          <Pressable
            onPress={() => setCurrentDate((d) => subMonths(d, 1))}
            style={({ pressed }) => ({ opacity: pressed ? 0.5 : 1, padding: 10 })}
          >
            <Ionicons name="chevron-back" size={18} color={colors.textSecondary} />
          </Pressable>
          <Text style={{ color: colors.textPrimary, fontSize: 15, fontWeight: '500' }}>
            {monthLabel}
          </Text>
          <Pressable
            onPress={() => setCurrentDate((d) => addMonths(d, 1))}
            style={({ pressed }) => ({ opacity: pressed ? 0.5 : 1, padding: 10 })}
          >
            <Ionicons name="chevron-forward" size={18} color={colors.textSecondary} />
          </Pressable>
        </View>

        {/* Summary row */}
        <View style={styles.summaryRow}>
          <View style={styles.summaryItem}>
            <Text style={{ color: colors.textTertiary, fontSize: 11, fontWeight: '500', letterSpacing: 0.3, textTransform: 'uppercase' }}>
              Income
            </Text>
            <Text style={{ color: colors.income, fontSize: 15, fontWeight: '600', marginTop: 2 }}>
              +{formatCurrency(totalIncome)}
            </Text>
          </View>
          <View style={{ width: 1, height: 32, backgroundColor: colors.border }} />
          <View style={styles.summaryItem}>
            <Text style={{ color: colors.textTertiary, fontSize: 11, fontWeight: '500', letterSpacing: 0.3, textTransform: 'uppercase' }}>
              Expenses
            </Text>
            <Text style={{ color: colors.expense, fontSize: 15, fontWeight: '600', marginTop: 2 }}>
              -{formatCurrency(totalExpenses)}
            </Text>
          </View>
        </View>
      </View>

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingBottom: insets.bottom + 80 }}
        showsVerticalScrollIndicator={false}
      >
        {grouped.length === 0 ? (
          <View style={{ alignItems: 'center', paddingTop: 64, gap: 12 }}>
            <View style={[styles.emptyIcon, { backgroundColor: colors.surfaceElevated }]}>
              <Ionicons name="receipt-outline" size={26} color={colors.textTertiary} />
            </View>
            <Text style={{ color: colors.textTertiary, fontSize: 14 }}>
              No transactions in {monthLabel}
            </Text>
            <Pressable
              style={({ pressed }) => [styles.addBtn, { backgroundColor: colors.accent, borderRadius: radius.lg, opacity: pressed ? 0.8 : 1, marginTop: 4 }]}
              onPress={() => router.push('/(modals)/add-transaction')}
            >
              <Ionicons name="add" size={16} color={'#FFFFFF'} />
              <Text style={{ color: '#FFFFFF', fontSize: 13, fontWeight: '600' }}>Add Transaction</Text>
            </Pressable>
          </View>
        ) : (
          grouped.map(([dateStr, txs]) => (
            <View key={dateStr}>
              {/* Date section header */}
              <View style={{ paddingHorizontal: 20, paddingTop: 20, paddingBottom: 8 }}>
                <Text style={{ color: colors.textTertiary, fontSize: 11, fontWeight: '500', letterSpacing: 0.5, textTransform: 'uppercase' }}>
                  {format(new Date(dateStr + 'T00:00:00'), 'EEEE, MMMM d')}
                </Text>
              </View>

              {/* Transaction list — grouped card */}
              <View style={[styles.txGroup, {
                marginHorizontal: 20,
                backgroundColor: colors.surface,
                borderRadius: radius.lg,
                borderWidth: 1,
                borderColor: colors.border,
                overflow: 'hidden',
                ...(isDark ? {} : {
                  shadowColor: '#000',
                  shadowOffset: { width: 0, height: 1 },
                  shadowOpacity: 0.04,
                  shadowRadius: 2,
                  elevation: 1,
                }),
              }]}>
                {txs.map((tx, idx) => {
                  const cat = categories.get(tx.categoryId);
                  const label = tx.note ?? cat?.name ?? tx.categoryId;
                  const isLast = idx === txs.length - 1;
                  const color = txColor(tx.type);
                  return (
                    <View
                      key={tx.id}
                      style={[
                        styles.txRow,
                        !isLast && { borderBottomWidth: 1, borderBottomColor: colors.border },
                      ]}
                    >
                      {/* Icon circle */}
                      <View style={[styles.txIcon, { backgroundColor: colors.surfaceElevated }]}>
                        <Ionicons
                          name={tx.type === 'income' ? 'arrow-up' : tx.type === 'expense' ? 'arrow-down' : 'swap-horizontal'}
                          size={15}
                          color={color}
                        />
                      </View>

                      {/* Label + category */}
                      <View style={{ flex: 1 }}>
                        <Text style={{ color: colors.textPrimary, fontSize: 15, fontWeight: '500' }} numberOfLines={1} ellipsizeMode="tail">
                          {label}
                        </Text>
                        {cat && tx.note && (
                          <Text style={{ color: colors.textTertiary, fontSize: 12, letterSpacing: 0.2, marginTop: 1 }}>
                            {cat.name}
                          </Text>
                        )}
                      </View>

                      {/* Amount + undo (trash) */}
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                        <Text style={{ color, fontSize: 15, fontWeight: '600', letterSpacing: -0.2 }}>
                          {tx.type === 'income' ? '+' : tx.type === 'expense' ? '-' : ''}
                          {formatCurrency(tx.amount)}
                        </Text>
                        <Pressable
                          onPress={() => handleDelete(tx)}
                          hitSlop={8}
                          style={({ pressed }) => ({ opacity: pressed ? 0.4 : 1 })}
                        >
                          <Ionicons name="trash-outline" size={16} color={colors.textTertiary} />
                        </Pressable>
                      </View>
                    </View>
                  );
                })}
              </View>
            </View>
          ))
        )}

        {/* Bottom breathing room */}
        <View style={{ height: 16 }} />
      </ScrollView>

      {/* ── Undo toast ── */}
      {undoEntry && (
        <UndoToast
          entry={undoEntry}
          onUndo={handleUndo}
          onDismiss={() => setUndoEntry(null)}
          bottomOffset={toastBottom}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  header: {},
  headerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  addBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 14, paddingVertical: 8 },
  monthNav: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  summaryRow: { flexDirection: 'row', alignItems: 'center', marginTop: 14, gap: 16 },
  summaryItem: { flex: 1 },
  emptyIcon: { width: 52, height: 52, borderRadius: 9999, alignItems: 'center', justifyContent: 'center' },
  txGroup: {},
  txRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingVertical: 13 },
  txIcon: { width: 32, height: 32, borderRadius: 9999, alignItems: 'center', justifyContent: 'center' },
  // Undo toast
  toast: {
    position: 'absolute',
    left: 16,
    right: 16,
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 16,
    gap: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.18,
    shadowRadius: 12,
    elevation: 10,
  },
  undoBtn: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 6,
    backgroundColor: 'rgba(255,255,255,0.15)',
  },
});
