/**
 * All Accounts
 *
 * Normal mode  : 2-col grid, long-press → rename / delete
 * Reorder mode : drag ≡ handle to reorder (PanResponder, no Reanimated)
 */
import {
  View, ScrollView, Pressable, StyleSheet, Alert, Modal,
  TextInput, KeyboardAvoidingView, Platform, Animated, PanResponder,
} from 'react-native';
import { Text } from '@/components/ui/Text';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useTheme } from '@/hooks/useTheme';
import { useAccountStore } from '@/stores/accountStore';
import { useTransactionStore } from '@/stores/transactionStore';
import { AccountGridCard } from '@/components/ui/AccountGridCard';
import { getDatabase } from '@/db/database';
import {
  deleteAccount as dbDeleteAccount,
  updateAccount as dbUpdateAccount,
  updateAccountSortOrders,
} from '@/db/accountQueries';
import { useState, useRef, useEffect } from 'react';
import type { Account } from '@/types';

const H_PAD   = 20;
const COL_GAP = 12;
const ROW_H   = 72;   // fixed row height in reorder mode
const ROW_GAP = 10;   // gap between rows
const STEP    = ROW_H + ROW_GAP;

function formatCurrency(amount: number) {
  const abs = Math.abs(amount);
  return (amount < 0 ? '-' : '') +
    '₱' + abs.toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export default function AllAccountsScreen() {
  const { colors, radius, shadow, isDark } = useTheme();
  const insets = useSafeAreaInsets();
  const { accounts, getNetWorth, deleteAccount, updateAccount, reorderAccounts } = useAccountStore();
  const purgeByAccount = useTransactionStore((s) => s.purgeByAccount);
  const netWorth = getNetWorth();

  // ── Reorder ────────────────────────────────────────────────────────────────
  const [isReordering,     setIsReordering]     = useState(false);
  const [orderedAccounts,  setOrderedAccounts]  = useState<Account[]>([]);
  const [saving,           setSaving]           = useState(false);

  // Drag state
  const [activeIndex, setActiveIndex] = useState<number | null>(null);
  const [targetIndex, setTargetIndex] = useState<number | null>(null);
  const activeIdxRef    = useRef<number | null>(null);
  const targetIdxRef    = useRef<number | null>(null);
  const orderedRef      = useRef<Account[]>([]);
  const isReorderingRef = useRef(false);
  const dragY           = useRef(new Animated.Value(0)).current;

  // Track the container's absolute Y on screen so we can convert pageY → item index
  const containerRef      = useRef<View>(null);
  const containerPageYRef = useRef(0);

  function onContainerLayout() {
    containerRef.current?.measureInWindow((_, y) => {
      containerPageYRef.current = y;
    });
  }

  useEffect(() => { orderedRef.current      = orderedAccounts; }, [orderedAccounts]);
  useEffect(() => { isReorderingRef.current = isReordering;   }, [isReordering]);

  // PanResponder – created once, reads state via refs
  const panResponder = useRef(
    PanResponder.create({
      // Claim the touch at start; use pageY minus container top to find which row was touched
      onStartShouldSetPanResponder: (e) => {
        if (!isReorderingRef.current) return false;
        const relativeY = e.nativeEvent.pageY - containerPageYRef.current;
        const idx = Math.floor(relativeY / STEP);
        if (idx < 0 || idx >= orderedRef.current.length) return false;
        dragY.setValue(0);
        activeIdxRef.current = idx;
        targetIdxRef.current = idx;
        setActiveIndex(idx);
        setTargetIndex(idx);
        return true;
      },
      onPanResponderMove: (_, gs) => {
        dragY.setValue(gs.dy);
        const from = activeIdxRef.current;
        if (from === null) return;
        const newTarget = Math.max(
          0,
          Math.min(orderedRef.current.length - 1, Math.round(from + gs.dy / STEP))
        );
        if (newTarget !== targetIdxRef.current) {
          targetIdxRef.current = newTarget;
          setTargetIndex(newTarget);
        }
      },
      onPanResponderRelease: (_, gs) => {
        const from = activeIdxRef.current;
        dragY.setValue(0);
        activeIdxRef.current = null;
        targetIdxRef.current = null;
        setActiveIndex(null);
        setTargetIndex(null);
        if (from === null) return;
        const to = Math.max(
          0,
          Math.min(orderedRef.current.length - 1, Math.round(from + gs.dy / STEP))
        );
        if (from !== to) {
          setOrderedAccounts(prev => {
            const next = [...prev];
            const [moved] = next.splice(from, 1);
            next.splice(to, 0, moved);
            return next;
          });
        }
      },
      onPanResponderTerminate: () => {
        dragY.setValue(0);
        activeIdxRef.current = null;
        targetIdxRef.current = null;
        setActiveIndex(null);
        setTargetIndex(null);
      },
    })
  ).current;

  /** Visual Y-offset for non-active rows to show the drop slot */
  function getItemShift(index: number): number {
    if (activeIndex === null || targetIndex === null || index === activeIndex) return 0;
    const from = activeIndex, to = targetIndex;
    if (from < to && index > from && index <= to) return -STEP;
    if (from > to && index >= to && index < from) return  STEP;
    return 0;
  }

  function enterReorderMode() {
    setOrderedAccounts([...accounts]);
    setIsReordering(true);
  }

  async function commitReorder() {
    if (saving) return;
    setSaving(true);
    try {
      const ids = orderedAccounts.map(a => a.id);
      const db  = await getDatabase();
      await updateAccountSortOrders(db, ids);
      reorderAccounts(ids);
      setIsReordering(false);
    } catch (e) {
      Alert.alert('Error', e instanceof Error ? e.message : String(e));
    } finally {
      setSaving(false);
    }
  }

  // ── Rename / Delete ────────────────────────────────────────────────────────
  const [renamingAccount, setRenamingAccount] = useState<Account | null>(null);
  const [renameText,      setRenameText]      = useState('');

  function handleLongPress(account: Account) {
    Alert.alert(account.name, 'What would you like to do?', [
      { text: 'Rename',  onPress: () => { setRenameText(account.name); setRenamingAccount(account); } },
      { text: 'Delete',  style: 'destructive', onPress: () => confirmDelete(account) },
      { text: 'Cancel',  style: 'cancel' },
    ]);
  }

  function confirmDelete(account: Account) {
    Alert.alert(
      'Delete Account',
      `Delete "${account.name}"? Transactions will remain in history.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete', style: 'destructive',
          onPress: async () => {
            try {
              const db = await getDatabase();
              await dbDeleteAccount(db, account.id);
              deleteAccount(account.id);
              purgeByAccount(account.id);
            } catch (e) {
              Alert.alert('Error', e instanceof Error ? e.message : String(e));
            }
          },
        },
      ]
    );
  }

  async function handleRenameConfirm() {
    if (!renamingAccount) return;
    const newName = renameText.trim();
    if (!newName) { Alert.alert('Name required', 'Please enter a name.'); return; }
    try {
      const updated: Account = { ...renamingAccount, name: newName, updatedAt: new Date().toISOString() };
      const db = await getDatabase();
      await dbUpdateAccount(db, updated);
      updateAccount(renamingAccount.id, { name: newName });
      setRenamingAccount(null);
    } catch (e) {
      Alert.alert('Error', e instanceof Error ? e.message : String(e));
    }
  }

  // ── Layout helpers ─────────────────────────────────────────────────────────
  const left  = accounts.filter((_, i) => i % 2 === 0);
  const right = accounts.filter((_, i) => i % 2 === 1);
  const isDragging = activeIndex !== null;

  const cardSurface = {
    backgroundColor: colors.surface,
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: colors.border,
    ...(isDark ? {} : shadow.md),
  };

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <ScrollView
        contentContainerStyle={{ paddingTop: insets.top + 16, paddingBottom: insets.bottom + 32 }}
        showsVerticalScrollIndicator={false}
        scrollEnabled={!isDragging}
      >
        {/* Header */}
        <View style={[styles.header, { paddingHorizontal: H_PAD }]}>
          <Pressable
            onPress={isReordering ? () => setIsReordering(false) : () => router.back()}
            hitSlop={8}
            style={({ pressed }) => [styles.iconBtn, { backgroundColor: colors.surfaceElevated, opacity: pressed ? 0.7 : 1 }]}
          >
            <Ionicons name="chevron-back" size={20} color={colors.textPrimary} />
          </Pressable>

          <Text style={{ color: colors.textPrimary, fontSize: 17, fontWeight: '700', letterSpacing: -0.3 }}>
            {isReordering ? 'Reorder Accounts' : 'My Accounts'}
          </Text>

          {isReordering ? (
            <Pressable
              onPress={commitReorder}
              hitSlop={8}
              style={({ pressed }) => [styles.doneBtn, { backgroundColor: colors.primary, borderRadius: radius.md, opacity: pressed ? 0.8 : 1 }]}
            >
              <Text style={{ color: colors.primaryFg, fontSize: 13, fontWeight: '700' }}>
                {saving ? 'Saving…' : 'Done'}
              </Text>
            </Pressable>
          ) : (
            <View style={{ flexDirection: 'row', gap: 8 }}>
              {accounts.length > 1 && (
                <Pressable
                  onPress={enterReorderMode}
                  hitSlop={8}
                  style={({ pressed }) => [styles.iconBtn, { backgroundColor: colors.surfaceElevated, opacity: pressed ? 0.7 : 1 }]}
                >
                  <Ionicons name="swap-vertical-outline" size={18} color={colors.textPrimary} />
                </Pressable>
              )}
              <Pressable
                onPress={() => router.push('/(modals)/add-account')}
                hitSlop={8}
                style={({ pressed }) => [styles.iconBtn, { backgroundColor: colors.surfaceElevated, opacity: pressed ? 0.7 : 1 }]}
              >
                <Ionicons name="add" size={20} color={colors.textPrimary} />
              </Pressable>
            </View>
          )}
        </View>

        {/* Net Worth card */}
        <View style={{
          marginHorizontal: H_PAD, marginTop: 20, padding: 20,
          backgroundColor: '#082D20',
          borderRadius: radius.xl,
          shadowColor: '#000',
          shadowOffset: { width: 0, height: 6 },
          shadowOpacity: 0.18,
          shadowRadius: 20,
          elevation: 8,
        }}>
          <Text style={{ color: 'rgba(255,255,255,0.45)', fontSize: 11, fontWeight: '600', letterSpacing: 0.8, textTransform: 'uppercase' }}>
            Total Net Worth
          </Text>
          <Text style={{ color: '#FFBA00', fontSize: 34, fontWeight: '700', letterSpacing: -1.2, marginTop: 4 }}>
            {formatCurrency(netWorth)}
          </Text>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 10 }}>
            <View style={[styles.pill, { backgroundColor: 'rgba(255,255,255,0.08)' }]}>
              <Ionicons name="card-outline" size={12} color="rgba(255,255,255,0.55)" />
              <Text style={{ color: 'rgba(255,255,255,0.55)', fontSize: 12, fontWeight: '500' }}>
                {accounts.length} account{accounts.length !== 1 ? 's' : ''}
              </Text>
            </View>
          </View>
        </View>

        {/* ── Empty state ── */}
        {accounts.length === 0 ? (
          <View style={{ alignItems: 'center', paddingTop: 48, paddingHorizontal: H_PAD }}>
            <View style={[styles.iconBtn, { width: 56, height: 56, borderRadius: 9999, backgroundColor: colors.surfaceElevated }]}>
              <Ionicons name="card-outline" size={26} color={colors.textTertiary} />
            </View>
            <Text style={{ color: colors.textPrimary, fontSize: 15, fontWeight: '600', marginTop: 14 }}>No accounts yet</Text>
            <Text style={{ color: colors.textTertiary, fontSize: 13, marginTop: 4, textAlign: 'center' }}>
              Add your first account to get started.
            </Text>
            <Pressable
              onPress={() => router.push('/(modals)/add-account')}
              style={({ pressed }) => ({
                flexDirection: 'row', alignItems: 'center', gap: 6,
                backgroundColor: colors.primary, borderRadius: radius.lg,
                paddingHorizontal: 24, paddingVertical: 13, marginTop: 20,
                opacity: pressed ? 0.8 : 1,
              })}
            >
              <Ionicons name="add" size={18} color={colors.primaryFg} />
              <Text style={{ color: colors.primaryFg, fontWeight: '700', fontSize: 15 }}>Add Account</Text>
            </Pressable>
          </View>

        ) : isReordering ? (
          /* ── Reorder mode ── */
          <View style={{ paddingHorizontal: H_PAD, marginTop: 20 }}>
            <Text style={{ color: colors.textTertiary, fontSize: 11, textAlign: 'center', marginBottom: 14, letterSpacing: 0.2 }}>
              Hold ≡ and drag to reorder  •  Top card shows first on dashboard
            </Text>

            {/*
              Absolutely-positioned items inside a fixed-height container.
              The container carries the PanResponder; locationY tells us which item was grabbed.
            */}
            <View
              ref={containerRef}
              onLayout={onContainerLayout}
              style={{ height: orderedAccounts.length * STEP - ROW_GAP, position: 'relative' }}
              {...panResponder.panHandlers}
            >
              {orderedAccounts.map((account, index) => {
                const isActive   = index === activeIndex;
                const shift      = getItemShift(index);
                const displayPos = isActive && targetIndex !== null ? targetIndex + 1 : index + 1;

                return (
                  <Animated.View
                    key={account.id}
                    style={[
                      styles.reorderRow,
                      {
                        top: index * STEP,
                        backgroundColor: isActive ? colors.primaryLight : colors.surface,
                        borderRadius: radius.lg,
                        borderWidth: 1,
                        borderColor: isActive ? colors.primary : colors.border,
                        zIndex: isActive ? 10 : 1,
                        transform: isActive
                          ? [{ translateY: dragY }]
                          : [{ translateY: shift }],
                        // elevation for active item on Android
                        elevation: isActive ? 8 : 0,
                        ...(isActive ? {
                          shadowColor: '#000',
                          shadowOpacity: 0.18,
                          shadowRadius: 8,
                          shadowOffset: { width: 0, height: 4 },
                        } : {}),
                      },
                    ]}
                  >
                    {/* Drag handle — the left 48 px zone the PanResponder watches */}
                    <View style={styles.dragHandle}>
                      <Ionicons
                        name="reorder-three-outline"
                        size={22}
                        color={isActive ? colors.primary : colors.textTertiary}
                      />
                    </View>

                    {/* Position badge */}
                    <View style={[styles.posBadge, {
                      backgroundColor: isActive ? colors.primary : colors.surfaceElevated,
                    }]}>
                      <Text style={{ color: isActive ? colors.primaryFg : colors.textSecondary, fontSize: 12, fontWeight: '700' }}>
                        {displayPos}
                      </Text>
                    </View>

                    {/* Account info */}
                    <View style={{ flex: 1, gap: 2 }}>
                      <Text style={{ color: colors.textPrimary, fontSize: 14, fontWeight: '700', letterSpacing: -0.2 }} numberOfLines={1}>
                        {account.name}
                      </Text>
                      <Text style={{ color: colors.textSecondary, fontSize: 12 }}>
                        {formatCurrency(account.balance)}
                      </Text>
                    </View>
                  </Animated.View>
                );
              })}
            </View>
          </View>

        ) : (
          /* ── Normal 2-column grid ── */
          <>
            <Text style={{ color: colors.textTertiary, fontSize: 11, textAlign: 'center', marginTop: 14, letterSpacing: 0.1 }}>
              Long-press any card to rename or delete
            </Text>
            <View style={[styles.grid, { paddingHorizontal: H_PAD, marginTop: 16 }]}>
              <View style={[styles.column, { gap: COL_GAP }]}>
                {left.map(account => (
                  <AccountGridCard key={account.id} account={account} onLongPress={() => handleLongPress(account)} />
                ))}
              </View>
              <View style={[styles.column, { gap: COL_GAP }]}>
                {right.map(account => (
                  <AccountGridCard key={account.id} account={account} onLongPress={() => handleLongPress(account)} />
                ))}
              </View>
            </View>
          </>
        )}
      </ScrollView>

      {/* Rename modal */}
      <Modal
        visible={renamingAccount !== null}
        transparent
        animationType="fade"
        onRequestClose={() => setRenamingAccount(null)}
      >
        <KeyboardAvoidingView
          style={styles.modalOverlay}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        >
          <Pressable style={StyleSheet.absoluteFill} onPress={() => setRenamingAccount(null)} />
          <View style={[styles.renameSheet, {
            backgroundColor: colors.surface,
            borderRadius: radius.xl,
            borderWidth: 1,
            borderColor: colors.border,
          }]}>
            <Text style={{ color: colors.textPrimary, fontSize: 16, fontWeight: '700', letterSpacing: -0.3, marginBottom: 4 }}>
              Rename Account
            </Text>
            <Text style={{ color: colors.textTertiary, fontSize: 12, marginBottom: 16 }}>
              {renamingAccount?.name}
            </Text>
            <TextInput
              value={renameText}
              onChangeText={setRenameText}
              placeholder="New account name"
              placeholderTextColor={colors.textTertiary}
              autoFocus
              style={{
                backgroundColor: colors.surfaceElevated,
                borderWidth: 1,
                borderColor: colors.border,
                borderRadius: radius.md,
                paddingHorizontal: 14,
                paddingVertical: 12,
                color: colors.textPrimary,
                fontSize: 15,
                marginBottom: 16,
              }}
            />
            <View style={{ flexDirection: 'row', gap: 10 }}>
              <Pressable
                onPress={() => setRenamingAccount(null)}
                style={({ pressed }) => [{ flex: 1, paddingVertical: 13, borderRadius: radius.md, backgroundColor: colors.surfaceElevated, alignItems: 'center' as const, opacity: pressed ? 0.7 : 1 }]}
              >
                <Text style={{ color: colors.textSecondary, fontWeight: '600', fontSize: 14 }}>Cancel</Text>
              </Pressable>
              <Pressable
                onPress={handleRenameConfirm}
                style={({ pressed }) => [{ flex: 1, paddingVertical: 13, borderRadius: radius.md, backgroundColor: colors.primary, alignItems: 'center' as const, opacity: pressed ? 0.8 : 1 }]}
              >
                <Text style={{ color: colors.primaryFg, fontWeight: '700', fontSize: 14 }}>Save</Text>
              </Pressable>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  header:     { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  iconBtn:    { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  doneBtn:    { paddingHorizontal: 16, paddingVertical: 8, alignItems: 'center', justifyContent: 'center' },
  pill:       { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 9999 },
  grid:       { flexDirection: 'row', gap: COL_GAP, alignItems: 'flex-start' },
  column:     { flex: 1, flexDirection: 'column' },
  reorderRow: {
    position: 'absolute', left: 0, right: 0, height: ROW_H,
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 14, gap: 12,
  },
  dragHandle: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  posBadge:   { width: 26, height: 26, borderRadius: 13, alignItems: 'center', justifyContent: 'center' },
  modalOverlay: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end', paddingHorizontal: 16, paddingBottom: 32,
  },
  renameSheet: { padding: 20 },
});
