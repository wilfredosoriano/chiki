/**
 * PhysicalCard — realistic bank card, aspect ratio 1.586:1.
 *
 * Design: single dark gradient, subtle radial highlight, flat gold EMV chip,
 * no decorative circles. Clean and minimal.
 */
import { View, StyleSheet, Pressable, Animated } from 'react-native';
import { Text } from '@/components/ui/Text';
import { useRef } from 'react';
import { Ionicons } from '@expo/vector-icons';
import type { Account } from '@/types';
import { getBankById } from '@/constants/philippineBanks';
import { getCardTheme } from '@/constants/bankCardThemes';

function formatCurrency(amount: number) {
  const abs = Math.abs(amount);
  const formatted = abs.toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return (amount < 0 ? '-' : '') + '₱' + formatted;
}

interface PhysicalCardProps {
  account: Account;
  onPress?: () => void;
}

export function PhysicalCard({ account, onPress }: PhysicalCardProps) {
  const bank = account.bankId ? getBankById(account.bankId) : undefined;
  const rawTheme = getCardTheme(account.bankId);

  // Dark slate gradient for all cards — use bank accent only for chip tint
  const cardBg   = rawTheme.gradientPrimary ?? '#1A1D2E';
  const cardMid  = rawTheme.gradientSecondary ?? '#0F1117';
  const chipGold = '#C8A85E';

  const typeLabel =
    account.type === 'debit'      ? 'DEBIT'      :
    account.type === 'savings'    ? 'SAVINGS'    :
    account.type === 'investment' ? 'INVESTMENT' : 'CASH';

  // Press animation
  const scale = useRef(new Animated.Value(1)).current;
  function onPressIn() {
    Animated.spring(scale, { toValue: 0.97, useNativeDriver: true, speed: 50, bounciness: 0 }).start();
  }
  function onPressOut() {
    Animated.spring(scale, { toValue: 1, useNativeDriver: true, speed: 50, bounciness: 4 }).start();
  }

  return (
    <Pressable onPress={onPress} onPressIn={onPressIn} onPressOut={onPressOut}>
      <Animated.View style={[styles.wrapper, { transform: [{ scale }] }]}>
        {/* Card body */}
        <View style={styles.card}>

          {/* Base color */}
          <View style={[StyleSheet.absoluteFill, styles.cardBg, { backgroundColor: cardBg }]} />
          {/* Gradient overlay — darkens toward bottom */}
          <View style={[StyleSheet.absoluteFill, styles.gradientBottom, { backgroundColor: cardMid }]} />
          {/* Subtle radial white highlight top-left */}
          <View style={styles.radialHighlight} />

          {/* ── Top row: bank name + type badge ── */}
          <View style={styles.topRow}>
            <Text style={styles.bankName} numberOfLines={1} ellipsizeMode="tail">
              {bank ? bank.shortName : account.name}
            </Text>
            <View style={styles.typeBadge}>
              <Text style={styles.typeLabel}>{typeLabel}</Text>
            </View>
          </View>

          {/* ── EMV Chip ── */}
          <View style={styles.chipRow}>
            <View style={styles.chip}>
              <View style={[styles.chipBody, { backgroundColor: chipGold }]}>
                <View style={styles.chipLine1} />
                <View style={styles.chipLine2} />
              </View>
            </View>
            {(account.type === 'debit' || account.type === 'savings') && (
              <Ionicons name="wifi-outline" size={18} color="rgba(255,255,255,0.55)"
                style={{ transform: [{ rotate: '90deg' }] }} />
            )}
          </View>

          {/* ── Bottom: name + balance ── */}
          <View style={styles.bottomRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.cardholderLabel}>
                {bank ? bank.name.toUpperCase() : typeLabel}
              </Text>
              <Text style={styles.cardholderName} numberOfLines={1} ellipsizeMode="tail">
                {account.name.toUpperCase()}
              </Text>
            </View>
            <View style={{ alignItems: 'flex-end' }}>
              <Text style={styles.balanceLabel}>Balance</Text>
              <Text style={styles.balance}>{formatCurrency(account.balance)}</Text>
            </View>
          </View>
        </View>
      </Animated.View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    width: '100%',
    // Shadow in light mode — consumers should conditionally apply
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.18,
    shadowRadius: 16,
    elevation: 8,
  },
  card: {
    // Aspect ratio 1.586:1 — standard card
    aspectRatio: 1.586,
    borderRadius: 16,
    padding: 20,
    overflow: 'hidden',
    justifyContent: 'space-between',
  },
  cardBg: { borderRadius: 16 },
  gradientBottom: {
    borderRadius: 16,
    top: '45%',
    opacity: 0.6,
  },
  radialHighlight: {
    position: 'absolute',
    width: 200,
    height: 200,
    borderRadius: 100,
    backgroundColor: 'rgba(255,255,255,0.07)',
    top: -60,
    left: -40,
  },

  // Top row
  topRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  bankName: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: 0.3,
    flex: 1,
    marginRight: 8,
  },
  typeBadge: {
    backgroundColor: 'rgba(255,255,255,0.12)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 4,
  },
  typeLabel: {
    color: 'rgba(255,255,255,0.8)',
    fontSize: 9,
    fontWeight: '600',
    letterSpacing: 1,
  },

  // EMV chip
  chipRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  chip: { width: 28, height: 22 },
  chipBody: {
    width: 28,
    height: 22,
    borderRadius: 4,
    overflow: 'hidden',
    justifyContent: 'center',
    alignItems: 'center',
  },
  chipLine1: {
    position: 'absolute',
    width: '100%',
    height: 1,
    backgroundColor: 'rgba(0,0,0,0.25)',
    top: '33%',
  },
  chipLine2: {
    position: 'absolute',
    width: '100%',
    height: 1,
    backgroundColor: 'rgba(0,0,0,0.25)',
    top: '66%',
  },
  maskedNumber: {
    color: 'rgba(255,255,255,0.75)',
    fontSize: 13,
    fontWeight: '500',
    letterSpacing: 2,
  },

  // Bottom row
  bottomRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end' },
  cardholderLabel: {
    color: 'rgba(255,255,255,0.5)',
    fontSize: 9,
    letterSpacing: 0.5,
    marginBottom: 2,
  },
  cardholderName: {
    color: 'rgba(255,255,255,0.8)',
    fontSize: 12,
    fontWeight: '500',
    letterSpacing: 1,
  },
  balanceLabel: {
    color: 'rgba(255,255,255,0.5)',
    fontSize: 9,
    letterSpacing: 0.5,
    marginBottom: 2,
    textAlign: 'right',
  },
  balance: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '700',
    letterSpacing: -0.5,
  },
});
