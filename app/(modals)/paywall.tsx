/**
 * Paywall modal — Chiki Premium upsell screen.
 * One-time purchase at ₱199. No subscription plans.
 * Purchases handled by RevenueCat → Google Play Billing / App Store.
 */
import { View, ScrollView, Pressable, Alert, Image } from 'react-native';
import { Text } from '@/components/ui/Text';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useTheme } from '@/hooks/useTheme';
import { useSubscriptionStore } from '@/stores/subscriptionStore';

const FEATURES = [
  { icon: 'card',                label: 'Unlimited Accounts'   },
  { icon: 'pie-chart',           label: 'Unlimited Budgets'    },
  { icon: 'trophy',              label: 'Savings Goals'        },
  { icon: 'document-text',       label: 'Unlimited Loans'      },
  { icon: 'bulb',                label: "Chiki's Insights"     },
  { icon: 'bar-chart',           label: 'Analytics & Charts'   },
  { icon: 'download',            label: 'Export Data'          },
  { icon: 'cloud-upload',        label: 'Backup & Restore'     },
  { icon: 'chatbubble-ellipses', label: 'Chat with Chiki'      },
  { icon: 'headset',             label: 'Priority Support'     },
] as const;

const COMPARISONS = [
  { label: 'One milk tea',       price: '₱180',  recur: 'gone in 5 min'    },
  { label: 'Chiki Premium',      price: '₱199',  recur: 'yours forever ✓'  },
  { label: 'Monthly budgeting app', price: '₱350/mo', recur: '₱4,200/year' },
] as const;

export default function PaywallScreen() {
  const { colors, radius, isDark } = useTheme();
  const insets = useSafeAreaInsets();
  const { subscribe, restore } = useSubscriptionStore();

  async function handleBuy() {
    await subscribe();
    router.back();
  }

  async function handleRestore() {
    await restore();
    Alert.alert('Purchase restored!', 'Your Premium access has been restored.', [
      { text: 'OK', onPress: () => router.back() },
    ]);
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>

      {/* ── Header ── */}
      <View style={{
        paddingTop: insets.top + 12,
        paddingHorizontal: 20,
        paddingBottom: 8,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
      }}>
        <Text style={{ color: colors.textPrimary, fontSize: 17, fontWeight: '700', letterSpacing: -0.3 }}>
          Chiki Premium
        </Text>
        <Pressable
          onPress={() => router.back()}
          hitSlop={8}
          style={({ pressed }) => ({
            width: 32, height: 32, borderRadius: 16,
            backgroundColor: colors.surfaceElevated,
            alignItems: 'center', justifyContent: 'center',
            opacity: pressed ? 0.6 : 1,
          })}
        >
          <Ionicons name="close" size={18} color={colors.textSecondary} />
        </Pressable>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: insets.bottom + 32 }}
      >
        {/* ── Hero ── */}
        <View style={{ alignItems: 'center', paddingTop: 20, paddingBottom: 24 }}>
          <Image
            source={require('../../assets/images/premium-icon.png')}
            style={{ width: 110, height: 110, marginBottom: 16 }}
            resizeMode="contain"
          />
          <Text style={{
            color: colors.textPrimary, fontSize: 24, fontWeight: '700',
            letterSpacing: -0.6, textAlign: 'center', marginBottom: 8, lineHeight: 30,
          }}>
            Take full control of{'\n'}your money
          </Text>
          <Text style={{ color: colors.textSecondary, fontSize: 14, textAlign: 'center', lineHeight: 21 }}>
            One payment. No monthly fees.{'\n'}Built for Filipinos who want full control of their pera.
          </Text>
        </View>

        {/* ── Features grid ── */}
        <View style={{
          backgroundColor: colors.surface,
          borderRadius: radius.lg,
          borderWidth: 1,
          borderColor: colors.border,
          padding: 16,
          marginBottom: 16,
        }}>
          <Text style={{ color: colors.textTertiary, fontSize: 11, fontWeight: '700', letterSpacing: 0.6, textTransform: 'uppercase', marginBottom: 14 }}>
            Everything included
          </Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 14 }}>
            {FEATURES.map((f) => (
              <View key={f.label} style={{ flexDirection: 'row', alignItems: 'center', gap: 8, width: '46%' }}>
                <View style={{
                  width: 28, height: 28, borderRadius: 8,
                  backgroundColor: colors.accent + '20',
                  alignItems: 'center', justifyContent: 'center',
                }}>
                  <Ionicons name={f.icon as any} size={14} color={colors.accent} />
                </View>
                <Text style={{ color: colors.textPrimary, fontSize: 12, fontWeight: '500', flex: 1 }} numberOfLines={1}>
                  {f.label}
                </Text>
              </View>
            ))}
          </View>
        </View>

        {/* ── Value anchor comparison ── */}
        <View style={{
          backgroundColor: colors.surface,
          borderRadius: radius.lg,
          borderWidth: 1,
          borderColor: colors.border,
          padding: 16,
          marginBottom: 20,
        }}>
          <Text style={{ color: colors.textTertiary, fontSize: 11, fontWeight: '700', letterSpacing: 0.6, textTransform: 'uppercase', marginBottom: 14 }}>
            Put it in perspective
          </Text>
          {COMPARISONS.map((item, i) => {
            const isChiki = item.label === 'Chiki Premium';
            return (
              <View
                key={item.label}
                style={{
                  flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
                  paddingVertical: 10,
                  paddingHorizontal: isChiki ? 12 : 0,
                  borderRadius: isChiki ? radius.md : 0,
                  backgroundColor: isChiki ? colors.accent + '18' : 'transparent',
                  marginHorizontal: isChiki ? -12 : 0,
                  borderBottomWidth: i < COMPARISONS.length - 1 && !isChiki ? 1 : 0,
                  borderBottomColor: colors.border,
                }}
              >
                <Text style={{ color: isChiki ? colors.accent : colors.textSecondary, fontSize: 13, fontWeight: isChiki ? '700' : '400', flex: 1 }}>
                  {item.label}
                </Text>
                <View style={{ alignItems: 'flex-end' }}>
                  <Text style={{ color: isChiki ? colors.accent : colors.textPrimary, fontSize: 13, fontWeight: '700' }}>
                    {item.price}
                  </Text>
                  <Text style={{ color: isChiki ? colors.accent : colors.textTertiary, fontSize: 11 }}>
                    {item.recur}
                  </Text>
                </View>
              </View>
            );
          })}
        </View>

        {/* ── Price card ── */}
        <View style={{
          backgroundColor: colors.surface,
          borderRadius: radius.lg,
          borderWidth: 2,
          borderColor: colors.accent,
          padding: 20,
          marginBottom: 16,
          alignItems: 'center',
          ...(isDark ? {} : {
            shadowColor: '#000',
            shadowOffset: { width: 0, height: 4 },
            shadowOpacity: 0.08,
            shadowRadius: 16,
            elevation: 4,
          }),
        }}>
          <View style={{
            backgroundColor: colors.income + '18',
            borderRadius: 9999,
            paddingHorizontal: 12,
            paddingVertical: 4,
            marginBottom: 12,
          }}>
            <Text style={{ color: colors.income, fontSize: 11, fontWeight: '700', letterSpacing: 0.4 }}>
              ONE-TIME · NO RENEWAL
            </Text>
          </View>

          <Text style={{ color: colors.textPrimary, fontSize: 48, fontWeight: '700', letterSpacing: -2 }}>
            ₱199
          </Text>
          <Text style={{ color: colors.textTertiary, fontSize: 13, marginTop: 2, marginBottom: 6 }}>
            Less than ₱1 per day for a year
          </Text>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 4 }}>
            {['Lifetime access', 'All features', 'Future updates'].map((tag) => (
              <View key={tag} style={{
                backgroundColor: colors.surfaceElevated,
                borderRadius: 9999,
                paddingHorizontal: 8, paddingVertical: 3,
              }}>
                <Text style={{ color: colors.textSecondary, fontSize: 10, fontWeight: '500' }}>
                  ✓ {tag}
                </Text>
              </View>
            ))}
          </View>
        </View>

        {/* ── Buy button ── */}
        <Pressable
          onPress={handleBuy}
          style={({ pressed }) => ({
            backgroundColor: '#082D20',
            borderRadius: radius.lg,
            paddingVertical: 17,
            alignItems: 'center',
            opacity: pressed ? 0.85 : 1,
            marginBottom: 12,
            flexDirection: 'row',
            justifyContent: 'center',
            gap: 8,
          })}
        >
          <Ionicons name="lock-open" size={18} color="#FFBA00" />
          <Text style={{ color: '#FFBA00', fontWeight: '700', fontSize: 16, letterSpacing: -0.2 }}>
            Unlock Premium — ₱199
          </Text>
        </Pressable>

        {/* ── Restore link ── */}
        <Pressable
          onPress={handleRestore}
          style={({ pressed }) => ({ alignItems: 'center', opacity: pressed ? 0.6 : 1, marginBottom: 16 })}
        >
          <Text style={{ color: colors.textSecondary, fontSize: 13 }}>
            Already purchased? Restore access
          </Text>
        </Pressable>

        {/* ── Footer ── */}
        <Text style={{ color: colors.textTertiary, fontSize: 11, textAlign: 'center', lineHeight: 17 }}>
          One-time purchase via App Store or Google Play.{'\n'}No recurring charges. No hidden fees.
        </Text>
      </ScrollView>
    </View>
  );
}
