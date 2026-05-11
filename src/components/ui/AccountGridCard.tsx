/**
 * AccountGridCard — compact portrait card for the 2-column accounts grid.
 * Same dark aesthetic as PhysicalCard but designed for small width.
 */
import { View, StyleSheet, Pressable, Animated } from 'react-native';
import { Text } from '@/components/ui/Text';
import { useRef } from 'react';
import { Ionicons } from '@expo/vector-icons';
import type { Account } from '@/types';
import { getBankById } from '@/constants/philippineBanks';
import { getCardTheme } from '@/constants/bankCardThemes';

function formatBalance(amount: number): string {
  const abs = Math.abs(amount);
  if (abs >= 1_000_000) {
    return (amount < 0 ? '-' : '') + '₱' + (abs / 1_000_000).toFixed(2) + 'M';
  }
  if (abs >= 100_000) {
    return (amount < 0 ? '-' : '') + '₱' + (abs / 1_000).toFixed(1) + 'K';
  }
  return (amount < 0 ? '-' : '') + '₱' + abs.toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

const TYPE_ICONS: Record<string, string> = {
  debit:      'card',
  savings:    'wallet',
  cash:       'cash',
  investment: 'trending-up',
};

const TYPE_LABEL: Record<string, string> = {
  debit:      'Debit',
  savings:    'Savings',
  cash:       'Cash',
  investment: 'Invest',
};

interface Props {
  account: Account;
  onPress?: () => void;
  onLongPress?: () => void;
}

export function AccountGridCard({ account, onPress, onLongPress }: Props) {
  const bank  = account.bankId ? getBankById(account.bankId) : undefined;
  const theme = getCardTheme(account.bankId);

  const cardBg  = theme.gradientPrimary  ?? '#1A1D2E';
  const cardMid = theme.gradientSecondary ?? '#0F1117';

  const initials = (bank?.shortName ?? account.name)
    .split(' ')
    .map((w) => w[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();

  const scale = useRef(new Animated.Value(1)).current;
  function onPressIn() {
    Animated.spring(scale, { toValue: 0.96, useNativeDriver: true, speed: 50, bounciness: 0 }).start();
  }
  function onPressOut() {
    Animated.spring(scale, { toValue: 1, useNativeDriver: true, speed: 50, bounciness: 4 }).start();
  }

  return (
    <Pressable onPress={onPress} onLongPress={onLongPress} onPressIn={onPressIn} onPressOut={onPressOut}>
      <Animated.View style={[styles.shadow, { transform: [{ scale }] }]}>
        <View style={styles.card}>
          {/* Base color */}
          <View style={[StyleSheet.absoluteFill, styles.fill, { backgroundColor: cardBg }]} />
          {/* Bottom gradient darkening */}
          <View style={[StyleSheet.absoluteFill, styles.bottomGrad, { backgroundColor: cardMid }]} />
          {/* Radial glow top-right */}
          <View style={styles.glow} />

          {/* ── Top: initials circle + type badge ── */}
          <View style={styles.topRow}>
            <View style={[styles.initialsCircle, { backgroundColor: 'rgba(255,255,255,0.12)' }]}>
              <Text style={styles.initialsText}>{initials}</Text>
            </View>
            <View style={styles.typeBadge}>
              <Ionicons
                name={TYPE_ICONS[account.type] as any}
                size={10}
                color="rgba(255,255,255,0.75)"
              />
              <Text style={styles.typeText}>
                {TYPE_LABEL[account.type]}
              </Text>
            </View>
          </View>

          {/* ── Middle: balance ── */}
          <View style={styles.middle}>
            <Text style={styles.balanceLabel}>Balance</Text>
            <Text style={styles.balance} numberOfLines={1} adjustsFontSizeToFit>
              {formatBalance(account.balance)}
            </Text>
          </View>

          {/* ── Bottom: account name + last four ── */}
          <View style={styles.bottomRow}>
            <Text style={styles.accountName} numberOfLines={1}>
              {bank ? bank.shortName : account.name}
            </Text>
            {account.maskedCardNumber && (
              <Text style={styles.lastFour}>•• {account.maskedCardNumber}</Text>
            )}
          </View>
        </View>
      </Animated.View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  shadow: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.22,
    shadowRadius: 12,
    elevation: 8,
  },
  card: {
    borderRadius: 14,
    overflow: 'hidden',
    aspectRatio: 1.58,   // standard card ratio — landscape
    padding: 12,
    justifyContent: 'space-between',
  },
  fill:       { borderRadius: 16 },
  bottomGrad: { borderRadius: 16, top: '40%', opacity: 0.65 },
  glow: {
    position: 'absolute',
    width: 140,
    height: 140,
    borderRadius: 70,
    backgroundColor: 'rgba(255,255,255,0.06)',
    top: -40,
    right: -40,
  },

  topRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  initialsCircle: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  initialsText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: -0.3,
  },
  typeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: 'rgba(255,255,255,0.10)',
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: 5,
  },
  typeText: {
    color: 'rgba(255,255,255,0.75)',
    fontSize: 8,
    fontWeight: '600',
    letterSpacing: 0.3,
  },

  middle: {
    flex: 1,
    justifyContent: 'center',
  },
  balanceLabel: {
    color: 'rgba(255,255,255,0.45)',
    fontSize: 9,
    fontWeight: '500',
    letterSpacing: 0.4,
    marginBottom: 2,
  },
  balance: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: -0.6,
  },

  bottomRow: {
    gap: 1,
  },
  accountName: {
    color: 'rgba(255,255,255,0.85)',
    fontSize: 10,
    fontWeight: '600',
    letterSpacing: 0.2,
  },
  lastFour: {
    color: 'rgba(255,255,255,0.4)',
    fontSize: 9,
    letterSpacing: 1,
  },
});
