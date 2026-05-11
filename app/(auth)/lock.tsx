/**
 * Biometric lock screen.
 * Design: full-screen background color only, centered content, circular biometric button.
 */
import { useEffect } from 'react';
import { View, Pressable, ActivityIndicator, StyleSheet, StatusBar } from 'react-native';
import { Text } from '@/components/ui/Text';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuthStore } from '@/stores/authStore';
import { useTheme } from '@/hooks/useTheme';

export default function LockScreen() {
  const { colors, isDark } = useTheme();
  const { isLocked, isBiometricEnabled, isLoading, unlock } = useAuthStore();

  useEffect(() => {
    if (!isLoading && (!isBiometricEnabled || !isLocked)) {
      router.replace('/(tabs)');
    }
  }, [isLoading, isBiometricEnabled, isLocked]);

  async function handleUnlock() {
    const success = await unlock();
    if (success) router.replace('/(tabs)');
  }

  if (isLoading) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <ActivityIndicator size="large" color={colors.accent} />
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} />

      {/* App mark */}
      <View style={{ alignItems: 'center', marginBottom: 48 }}>
        <View style={[styles.appMark, {
          backgroundColor: colors.surfaceElevated,
          borderWidth: 1,
          borderColor: colors.border,
        }]}>
          <Ionicons name="wallet" size={32} color={colors.accent} />
        </View>
      </View>

      {/* Headline */}
      <Text style={{
        color: colors.textPrimary,
        fontSize: 28,
        fontWeight: '700',
        letterSpacing: -0.8,
        textAlign: 'center',
      }}>
        Unlock Chiki
      </Text>
      <Text style={{
        color: colors.textTertiary,
        fontSize: 12,
        letterSpacing: 0.2,
        textAlign: 'center',
        marginTop: 8,
      }}>
        Your finances, secured.
      </Text>

      {/* Biometric button */}
      <Pressable
        onPress={handleUnlock}
        style={({ pressed }) => [
          styles.biometricBtn,
          {
            backgroundColor: colors.surfaceElevated,
            borderWidth: 1,
            borderColor: colors.border,
            marginTop: 48,
            opacity: pressed ? 0.7 : 1,
            // Light mode shadow
            ...(isDark ? {} : {
              shadowColor: '#000',
              shadowOffset: { width: 0, height: 2 },
              shadowOpacity: 0.06,
              shadowRadius: 8,
              elevation: 3,
            }),
          },
        ]}
      >
        <Ionicons name="finger-print-outline" size={30} color={colors.accent} />
      </Pressable>

      <Text style={{ color: colors.textTertiary, fontSize: 12, marginTop: 16, letterSpacing: 0.2 }}>
        Tap to authenticate
      </Text>

      {/* Passcode fallback */}
      <Pressable
        onPress={handleUnlock}
        style={({ pressed }) => ({ opacity: pressed ? 0.6 : 1, marginTop: 24 })}
      >
        <Text style={{ color: colors.accent, fontSize: 12, fontWeight: '500', letterSpacing: 0.2 }}>
          Use passcode instead
        </Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 40,
  },
  appMark: {
    width: 72,
    height: 72,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  biometricBtn: {
    width: 72,
    height: 72,
    borderRadius: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
