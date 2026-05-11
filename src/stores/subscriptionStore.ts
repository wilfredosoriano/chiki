/**
 * Subscription store — powered by RevenueCat.
 * One-time purchase: Chiki Premium (com.chiki.app.premium)
 * Entitlement ID: "premium"
 */
import { create } from 'zustand';
import { Platform, Alert } from 'react-native';
import Purchases, { LOG_LEVEL, type CustomerInfo } from 'react-native-purchases';
import Constants from 'expo-constants';

const ENTITLEMENT_ID  = 'premium';
const IOS_KEY         = (Constants.expoConfig?.extra?.revenueCatApiKeyIos     as string | undefined) ?? '';
const ANDROID_KEY     = (Constants.expoConfig?.extra?.revenueCatApiKeyAndroid  as string | undefined) ?? '';

function isPremiumFromInfo(info: CustomerInfo): boolean {
  return info.entitlements.active[ENTITLEMENT_ID] !== undefined;
}

interface SubscriptionState {
  isPremium: boolean;
  isLoading: boolean;
  initialize: () => Promise<void>;
  subscribe: () => Promise<void>;
  restore: () => Promise<void>;
  reset: () => Promise<void>;
}

export const useSubscriptionStore = create<SubscriptionState>((set) => ({
  isPremium: false,
  isLoading: true,

  initialize: async () => {
    try {
      const apiKey = Platform.OS === 'ios' ? IOS_KEY : ANDROID_KEY;
      if (!apiKey) {
        // No key yet (dev build without .env) — stay free
        set({ isLoading: false });
        return;
      }

      if (__DEV__) Purchases.setLogLevel(LOG_LEVEL.DEBUG);
      Purchases.configure({ apiKey });

      const info = await Purchases.getCustomerInfo();
      set({ isPremium: isPremiumFromInfo(info), isLoading: false });
    } catch {
      set({ isLoading: false });
    }
  },

  subscribe: async () => {
    try {
      set({ isLoading: true });

      const offerings = await Purchases.getOfferings();
      const current   = offerings.current;
      if (!current || current.availablePackages.length === 0) {
        Alert.alert('Not available', 'No packages found. Please try again later.');
        set({ isLoading: false });
        return;
      }

      // Grab the first (and only) package — the one-time premium purchase
      const pkg = current.availablePackages[0];
      const { customerInfo } = await Purchases.purchasePackage(pkg);
      const premium = isPremiumFromInfo(customerInfo);
      set({ isPremium: premium, isLoading: false });

      if (!premium) {
        Alert.alert('Purchase incomplete', 'Premium entitlement not found. Contact support if charged.');
      }
    } catch (e: unknown) {
      set({ isLoading: false });
      const msg = e instanceof Error ? e.message : String(e);
      // PurchaseCancelledError — user cancelled, don't show error
      if (!msg.includes('cancel') && !msg.includes('Cancel')) {
        Alert.alert('Purchase failed', msg);
      }
    }
  },

  restore: async () => {
    try {
      set({ isLoading: true });
      const info    = await Purchases.restorePurchases();
      const premium = isPremiumFromInfo(info);
      set({ isPremium: premium, isLoading: false });

      if (premium) {
        Alert.alert('Restored ✓', 'Your Chiki Premium has been restored!');
      } else {
        Alert.alert('No purchase found', 'No previous purchase was found for this account.');
      }
    } catch (e: unknown) {
      set({ isLoading: false });
      Alert.alert('Restore failed', e instanceof Error ? e.message : String(e));
    }
  },

  // Dev only — resets local premium flag for testing
  reset: async () => {
    set({ isPremium: false });
  },
}));
