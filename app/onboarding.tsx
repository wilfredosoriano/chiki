/**
 * First-time onboarding tutorial — shown once on fresh install, never again.
 * Swipeable slide deck with page dots, Skip, and Next / Get Started buttons.
 */
import { useRef, useState } from 'react';
import {
  Dimensions,
  FlatList,
  Image,
  Pressable,
  StyleSheet,
  View,
  ViewToken,
} from 'react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Text } from '@/components/ui/Text';
import { secureSet } from '@/utils/secureStorage';
import { STORAGE_KEYS } from '@/constants';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

const BRAND = '#082D20';
const BRAND_FADED = 'rgba(8,45,32,0.18)';
const BRAND_SKIP = 'rgba(8,45,32,0.45)';
const GOLD = '#FFBA00';

interface Slide {
  key: string;
  mascot: ReturnType<typeof require>;
  title: string;
  body: string;
}

const SLIDES: Slide[] = [
  {
    key: 'welcome',
    mascot: require('../assets/images/mood/happy.png'),
    title: 'Welcome to Chiki!',
    body: 'Your personal finance buddy. Track money, loans, and savings — 100% offline. Your data never leaves your phone.',
  },
  {
    key: 'accounts',
    mascot: require('../assets/images/mood/motivation.png'),
    title: 'First, add your accounts',
    body: 'Add GCash, BDO, Maya, cash — anything you use. Chiki tracks your balance across all of them and shows your total net worth.',
  },
  {
    key: 'transactions',
    mascot: require('../assets/images/mood/neutral.png'),
    title: 'Record every peso',
    body: 'Log income, expenses, and transfers in seconds. Long-press any transaction to see the full details or delete it.',
  },
  {
    key: 'loans',
    mascot: require('../assets/images/mood/thinking.png'),
    title: 'Loans under control',
    body: 'Add any loan — Coop, 5-6, SSS, bank mortgage. Chiki shows your remaining balance, due date, and monthly payment. Pay directly from the app.',
  },
  {
    key: 'savings',
    mascot: require('../assets/images/mood/success.png'),
    title: 'Save with a purpose',
    body: 'Set a savings goal like Emergency Fund ₱50,000. When you add money, it deducts from your account so you always know your real spendable balance.',
  },
  {
    key: 'ai',
    mascot: require('../assets/images/mood/idle.png'),
    title: 'Just ask Chiki',
    body: '"How much did I spend this month?", "Pay SSS loan from GCash", "Show my goals" — Chiki understands plain commands. Available on Premium.',
  },
  {
    key: 'ready',
    mascot: require('../assets/images/mood/shock.png'),
    title: "You're all set, pre!",
    body: 'Chiki is ready to help you take control of your pera. Tara na!',
  },
];

async function finish() {
  await secureSet(STORAGE_KEYS.ONBOARDING_COMPLETE, 'true');
  router.replace('/(tabs)');
}

export default function OnboardingScreen() {
  const insets = useSafeAreaInsets();
  const [activeIndex, setActiveIndex] = useState(0);
  const flatListRef = useRef<FlatList<Slide>>(null);

  const isLast = activeIndex === SLIDES.length - 1;

  const onViewableItemsChanged = useRef(
    ({ viewableItems }: { viewableItems: ViewToken[] }) => {
      if (viewableItems.length > 0 && viewableItems[0].index != null) {
        setActiveIndex(viewableItems[0].index);
      }
    },
  ).current;

  const viewabilityConfig = useRef({ viewAreaCoveragePercentThreshold: 50 }).current;

  function goNext() {
    if (isLast) {
      finish();
      return;
    }
    flatListRef.current?.scrollToIndex({ index: activeIndex + 1, animated: true });
  }

  const bottomOffset = insets.bottom + 32;

  return (
    <View style={styles.container}>
      {/* Skip button — hidden on last slide */}
      {!isLast && (
        <Pressable
          onPress={finish}
          style={[styles.skipButton, { top: insets.top + 16 }]}
          hitSlop={12}
        >
          <Text style={styles.skipText}>Skip</Text>
        </Pressable>
      )}

      {/* Slides */}
      <FlatList
        ref={flatListRef}
        data={SLIDES}
        keyExtractor={(item) => item.key}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onViewableItemsChanged={onViewableItemsChanged}
        viewabilityConfig={viewabilityConfig}
        renderItem={({ item }) => (
          <View style={styles.slide}>
            <Image source={item.mascot} style={styles.mascot} resizeMode="contain" />
            <Text style={styles.title}>{item.title}</Text>
            <Text style={styles.body}>{item.body}</Text>
          </View>
        )}
      />

      {/* Bottom controls: dots + Next/Get Started */}
      <View style={[styles.controls, { bottom: bottomOffset }]}>
        {/* Page dots */}
        <View style={styles.dots}>
          {SLIDES.map((_, i) => (
            <View
              key={i}
              style={[
                styles.dot,
                i === activeIndex ? styles.dotActive : styles.dotInactive,
              ]}
            />
          ))}
        </View>

        {/* Next / Get Started pill */}
        <Pressable
          onPress={goNext}
          style={[styles.nextButton, isLast && styles.nextButtonLast]}
        >
          <Text style={[styles.nextText, isLast && styles.nextTextLast]}>
            {isLast ? 'Get Started' : 'Next'}
          </Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },

  // ── Skip ────────────────────────────────────────────────────────────────────
  skipButton: {
    position: 'absolute',
    right: 24,
    zIndex: 10,
  },
  skipText: {
    fontSize: 15,
    fontWeight: '500',
    color: BRAND_SKIP,
  },

  // ── Slide ───────────────────────────────────────────────────────────────────
  slide: {
    width: SCREEN_WIDTH,
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
    gap: 20,
    // leave room at the bottom for controls overlay
    paddingBottom: 140,
  },
  mascot: {
    width: 200,
    height: 200,
  },
  title: {
    fontSize: 26,
    fontWeight: '700',
    color: BRAND,
    textAlign: 'center',
    letterSpacing: -0.6,
  },
  body: {
    fontSize: 15,
    color: 'rgba(8,45,32,0.65)',
    textAlign: 'center',
    lineHeight: 22,
  },

  // ── Controls ─────────────────────────────────────────────────────────────────
  controls: {
    position: 'absolute',
    left: 0,
    right: 0,
    paddingHorizontal: 24,
    alignItems: 'center',
    gap: 20,
  },
  dots: {
    flexDirection: 'row',
    gap: 7,
    alignItems: 'center',
  },
  dot: {
    borderRadius: 99,
  },
  dotActive: {
    width: 22,
    height: 7,
    backgroundColor: BRAND,
  },
  dotInactive: {
    width: 7,
    height: 7,
    backgroundColor: BRAND_FADED,
  },
  nextButton: {
    alignSelf: 'stretch',
    backgroundColor: BRAND,
    borderRadius: 99,
    paddingVertical: 15,
    alignItems: 'center',
  },
  nextButtonLast: {
    backgroundColor: BRAND,
  },
  nextText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFFFFF',
    letterSpacing: -0.3,
  },
  nextTextLast: {
    color: GOLD,
  },
});
