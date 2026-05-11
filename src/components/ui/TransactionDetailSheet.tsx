/**
 * TransactionDetailSheet — bottom sheet that slides up on long-press of a transaction.
 * Animates in with Animated.spring. Dark overlay backdrop closes on tap.
 */
import React, { useEffect, useRef } from 'react';
import {
  View,
  Modal,
  Pressable,
  StyleSheet,
  Animated,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '@/hooks/useTheme';
import { Text } from '@/components/ui/Text';
import { format } from '@/utils/dateUtils';
import type { Transaction, Category, Account } from '@/types';

// ── Color constants ────────────────────────────────────────────────────────────
const INCOME_COLOR   = '#FFBA00'; // gold
const EXPENSE_COLOR  = '#F5A49A'; // soft rose
const DARK_FOREST    = '#082D20';

// ── Props ─────────────────────────────────────────────────────────────────────
interface Props {
  transaction: Transaction | null;
  visible: boolean;
  onClose: () => void;
  onDelete: (tx: Transaction) => void;
  categories: Map<string, Category>;
  accounts: Account[];
}

// ── Detail row ────────────────────────────────────────────────────────────────
function DetailRow({
  label,
  value,
  valueStyle,
}: {
  label: string;
  value: string;
  valueStyle?: object;
}) {
  const { colors } = useTheme();
  return (
    <View style={styles.detailRow}>
      <Text style={[styles.detailLabel, { color: colors.textTertiary }]}>{label}</Text>
      <Text style={[styles.detailValue, { color: colors.textPrimary }, valueStyle]}>
        {value}
      </Text>
    </View>
  );
}

// ── Main component ─────────────────────────────────────────────────────────────
export function TransactionDetailSheet({
  transaction,
  visible,
  onClose,
  onDelete,
  categories,
  accounts,
}: Props) {
  const { colors, radius } = useTheme();
  const insets = useSafeAreaInsets();
  const translateY = useRef(new Animated.Value(400)).current;

  // Animate when visibility changes
  useEffect(() => {
    if (visible) {
      translateY.setValue(400);
      Animated.spring(translateY, {
        toValue: 0,
        useNativeDriver: true,
        damping: 22,
        stiffness: 200,
      }).start();
    }
  }, [visible]);

  function handleClose() {
    Animated.timing(translateY, {
      toValue: 400,
      duration: 220,
      useNativeDriver: true,
    }).start(onClose);
  }

  function handleDeletePress() {
    if (!transaction) return;
    Alert.alert(
      'Delete Transaction',
      'Delete this transaction? This cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => onDelete(transaction),
        },
      ]
    );
  }

  if (!transaction) return null;

  // ── Derived values ─────────────────────────────────────────────────────────
  const typeColor =
    transaction.type === 'income'
      ? INCOME_COLOR
      : transaction.type === 'expense'
      ? EXPENSE_COLOR
      : colors.accent;

  const iconName: React.ComponentProps<typeof Ionicons>['name'] =
    transaction.type === 'income'
      ? 'arrow-up'
      : transaction.type === 'expense'
      ? 'arrow-down'
      : 'swap-horizontal';

  const amountPrefix =
    transaction.type === 'income' ? '+' : transaction.type === 'expense' ? '-' : '';

  const formattedAmount =
    amountPrefix +
    '₱' +
    transaction.amount.toLocaleString('en-PH', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });

  const cat = categories.get(transaction.categoryId);
  const headerLabel = transaction.note ?? cat?.name ?? transaction.categoryId;

  const dateObj = new Date(transaction.date + 'T00:00:00');
  const formattedDate = format(dateObj, 'EEEE, MMMM d, yyyy');

  const account = accounts.find((a) => a.id === transaction.accountId);
  const accountName = account?.name ?? transaction.accountId;

  return (
    <Modal
      transparent
      visible={visible}
      animationType="none"
      onRequestClose={handleClose}
      statusBarTranslucent
    >
      {/* ── Backdrop ── */}
      <Pressable style={styles.backdrop} onPress={handleClose}>
        {/* ── Sheet ── */}
        <Animated.View
          style={[
            styles.sheet,
            {
              backgroundColor: colors.surface,
              paddingBottom: insets.bottom + 16,
              transform: [{ translateY }],
            },
          ]}
          // Prevent backdrop press from bubbling through the sheet
          onStartShouldSetResponder={() => true}
        >
          <Pressable onPress={(e) => e.stopPropagation()}>
            {/* Drag handle */}
            <View style={[styles.dragHandle, { backgroundColor: colors.border }]} />

            {/* ── Header row ── */}
            <View style={styles.headerRow}>
              {/* Icon circle */}
              <View
                style={[
                  styles.iconCircle,
                  { backgroundColor: typeColor + '22' },
                ]}
              >
                <Ionicons name={iconName} size={20} color={typeColor} />
              </View>

              {/* Note / category */}
              <Text
                style={[styles.headerLabel, { color: colors.textPrimary }]}
              >
                {headerLabel}
              </Text>

              {/* Amount */}
              <Text style={[styles.headerAmount, { color: typeColor }]}>
                {formattedAmount}
              </Text>
            </View>

            {/* ── Divider ── */}
            <View style={[styles.divider, { backgroundColor: colors.border }]} />

            {/* ── Details section ── */}
            <View style={styles.detailsSection}>
              <DetailRow label="Date" value={formattedDate} />
              <DetailRow label="Category" value={cat?.name ?? transaction.categoryId} />
              <DetailRow label="Account" value={accountName} />
              {transaction.note ? (
                <View style={styles.detailRow}>
                  <Text style={[styles.detailLabel, { color: colors.textTertiary }]}>Note</Text>
                  <Text
                    style={[
                      styles.detailValue,
                      { color: colors.textSecondary, fontStyle: 'italic' },
                    ]}
                  >
                    {transaction.note}
                  </Text>
                </View>
              ) : null}
            </View>

            {/* ── Delete button ── */}
            <Pressable
              onPress={handleDeletePress}
              style={({ pressed }) => [
                styles.deleteBtn,
                {
                  backgroundColor: DARK_FOREST,
                  borderRadius: radius.lg,
                  opacity: pressed ? 0.8 : 1,
                },
              ]}
            >
              <Ionicons name="trash-outline" size={17} color={EXPENSE_COLOR} />
              <Text style={styles.deleteBtnText}>Delete Transaction</Text>
            </Pressable>
          </Pressable>
        </Animated.View>
      </Pressable>
    </Modal>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  sheet: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 20,
    // Shadow
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.10,
    shadowRadius: 16,
    elevation: 12,
  },
  dragHandle: {
    alignSelf: 'center',
    width: 36,
    height: 4,
    borderRadius: 2,
    marginTop: 10,
    marginBottom: 18,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 16,
  },
  iconCircle: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  headerLabel: {
    flex: 1,
    fontSize: 16,
    fontWeight: '600',
    letterSpacing: -0.3,
    lineHeight: 22,
  },
  headerAmount: {
    fontSize: 17,
    fontWeight: '700',
    letterSpacing: -0.4,
    flexShrink: 0,
  },
  divider: {
    height: 1,
    marginBottom: 16,
  },
  detailsSection: {
    gap: 14,
    marginBottom: 24,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 16,
  },
  detailLabel: {
    fontSize: 13,
    fontWeight: '500',
    letterSpacing: 0.1,
    flexShrink: 0,
    minWidth: 80,
  },
  detailValue: {
    fontSize: 13,
    fontWeight: '500',
    textAlign: 'right',
    flex: 1,
    flexWrap: 'wrap',
  },
  deleteBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
  },
  deleteBtnText: {
    color: '#F5A49A',
    fontSize: 15,
    fontWeight: '600',
    letterSpacing: -0.2,
  },
});

export default TransactionDetailSheet;
