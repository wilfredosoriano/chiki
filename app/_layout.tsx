/**
 * Root layout — initializes app services (theme, auth, db, subscriptions).
 */
import { useEffect, useRef, useState } from 'react';
import { AppState, Alert, View } from 'react-native';
import { Stack } from 'expo-router';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useFonts } from 'expo-font';
import {
  Montserrat_400Regular,
  Montserrat_500Medium,
  Montserrat_600SemiBold,
  Montserrat_700Bold,
  Montserrat_800ExtraBold,
  Montserrat_900Black,
} from '@expo-google-fonts/montserrat';
import * as SplashScreen from 'expo-splash-screen';
import * as Linking from 'expo-linking';
import { router } from 'expo-router';
import { useAuthStore } from '@/stores/authStore';
import { useSubscriptionStore } from '@/stores/subscriptionStore';
import { useThemeStore } from '@/stores/themeStore';
import { useAccountStore } from '@/stores/accountStore';
import { useTransactionStore } from '@/stores/transactionStore';
import { useNotificationStore } from '@/stores/notificationStore';
import { useTheme } from '@/hooks/useTheme';
import { checkDeviceIntegrity } from '@/utils/deviceSecurity';
import { getDatabase } from '@/db/database';
import { runMigrations } from '@/db/migrations';
import { seedDefaultData } from '@/db/seed';
import { getAllAccounts } from '@/db/accountQueries';
import { getRecentTransactions } from '@/db/transactionQueries';
import { applyDailyInterest } from '@/utils/interestAccrual';
import { setupNotificationHandler } from '@/utils/notifications';
import { secureGet, secureSet } from '@/utils/secureStorage';
import { STORAGE_KEYS } from '@/constants';

// Keep the native splash visible until we're ready to fade it out ourselves
SplashScreen.preventAutoHideAsync().catch(() => {});

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { retry: 2, staleTime: 1000 * 60 * 5 },
  },
});

export default function RootLayout() {
  const { colors } = useTheme();
  const [bootComplete, setBootComplete] = useState(false);
  const bootRef = useRef(false);

  const [fontsLoaded] = useFonts({
    Montserrat_400Regular,
    Montserrat_500Medium,
    Montserrat_600SemiBold,
    Montserrat_700Bold,
    Montserrat_800ExtraBold,
    Montserrat_900Black,
  });

  const initializeAuth         = useAuthStore((s) => s.initialize);
  const initializeSubscription = useSubscriptionStore((s) => s.initialize);
  const initializeTheme        = useThemeStore((s) => s.initialize);
  const initializeNotifications = useNotificationStore((s) => s.initialize);
  const setAccounts            = useAccountStore((s) => s.setAccounts);

  useEffect(() => {
    setupNotificationHandler();

    async function boot() {
      const { safe, reason } = await checkDeviceIntegrity();
      if (!safe) {
        Alert.alert('Security Warning', `${reason}\n\nChiki cannot run securely on this device.`);
        return;
      }

      const db = await getDatabase();
      await runMigrations(db);
      await seedDefaultData(db);

      const savedAccounts = await getAllAccounts(db);
      setAccounts(savedAccounts);

      const setTransactions = useTransactionStore.getState().setTransactions;
      const recentTx = await getRecentTransactions(db, 50);
      setTransactions(recentTx);

      await applyDailyInterest(db, useAccountStore.getState().setAccounts);
      await Promise.all([
        initializeAuth(),
        initializeSubscription(),
        initializeTheme(),
        initializeNotifications(),
      ]);

      setBootComplete(true);
      bootRef.current = true;
      SplashScreen.hideAsync().catch(() => {});

      const onboardingDone = await secureGet(STORAGE_KEYS.ONBOARDING_COMPLETE);
      if (!onboardingDone) {
        setTimeout(() => router.replace('/onboarding'), 100);
        return; // skip auth lock check for first-timers
      }

      // Navigate to lock screen if the app was locked before this boot
      const { isLocked, isBiometricEnabled } = useAuthStore.getState();
      if (isLocked && isBiometricEnabled) {
        setTimeout(() => router.replace('/(auth)/lock'), 50);
      }
    }

    boot();

    const sub = Linking.addEventListener('url', () => {});

    // ── AppState auto-lock ──────────────────────────────────────────────────────
    const appStateSub = AppState.addEventListener('change', async (nextState) => {
      // Only act after boot is fully complete
      if (!bootRef.current) return;

      if (nextState === 'background' || nextState === 'inactive') {
        // Record the time the app left the foreground
        await secureSet(STORAGE_KEYS.LAST_ACTIVE_AT, Date.now().toString());
      } else if (nextState === 'active') {
        const {
          isLocked: locked,
          isBiometricEnabled: bioEnabled,
          lockTimeoutMinutes: timeout,
          lock,
        } = useAuthStore.getState();

        if (locked) {
          // Already locked — just navigate to the lock screen
          router.replace('/(auth)/lock');
          return;
        }

        if (bioEnabled) {
          const lastActiveAtStr = await secureGet(STORAGE_KEYS.LAST_ACTIVE_AT);
          if (lastActiveAtStr) {
            const elapsed = Date.now() - parseInt(lastActiveAtStr, 10);
            // timeout === 0 means lock immediately on any return to foreground
            if (timeout === 0 || elapsed >= timeout * 60 * 1000) {
              lock();
              router.replace('/(auth)/lock');
            }
          }
        }
      }
    });
    // ───────────────────────────────────────────────────────────────────────────

    return () => {
      sub.remove();
      appStateSub.remove();
    };
  }, []);

  if (!fontsLoaded) return null;

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <QueryClientProvider client={queryClient}>
        <Stack
          screenOptions={{
            headerShown: false,
            animation: 'none',
            contentStyle: { backgroundColor: colors.background },
          }}
        >
          <Stack.Screen name="onboarding" options={{ animation: 'fade' }} />
          <Stack.Screen name="(auth)" />
          <Stack.Screen name="(tabs)" />
          <Stack.Screen name="(modals)" options={{ presentation: 'transparentModal', animation: 'none' }} />
        </Stack>
      </QueryClientProvider>
    </View>
  );
}
