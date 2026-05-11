/**
 * In-app animated splash screen.
 * Sits on top of all content. Fades out smoothly once `ready` is true.
 *
 * No text — logo only. Background matches the native splash exactly (#FAFAFA / #09090B)
 * so there is zero blink when the native splash hands off to this view.
 */
import { useEffect, useRef, useState } from 'react';
import { Animated, StyleSheet, Appearance } from 'react-native';
import * as ExpoSplash from 'expo-splash-screen';

interface Props {
  ready: boolean;
}

export function AppSplash({ ready }: Props) {
  const opacity   = useRef(new Animated.Value(1)).current;
  const logoScale = useRef(new Animated.Value(0.92)).current;
  const [hidden, setHidden] = useState(false);

  // Follow system dark/light mode — dark: deep purple, light: white
  const isDarkSystem = Appearance.getColorScheme() === 'dark';
  const bgColor = isDarkSystem ? '#2E2947' : '#FAFAFA';

  useEffect(() => {
    // Gentle scale-up on mount — starts slightly small, eases to full size
    Animated.spring(logoScale, {
      toValue: 1,
      useNativeDriver: true,
      damping: 18,
      stiffness: 120,
      delay: 40,
    }).start();
  }, []);

  useEffect(() => {
    if (!ready) return;
    // Hide native splash only after JS overlay is already visible and painted —
    // this prevents any gap between the two layers.
    ExpoSplash.hideAsync().catch(() => {});
    // Short hold so the user sees the logo, then smooth fade out
    Animated.timing(opacity, {
      toValue: 0,
      duration: 500,
      delay: 300,
      useNativeDriver: true,
    }).start(() => setHidden(true));
  }, [ready]);

  if (hidden) return null;

  return (
    <Animated.View style={[styles.container, { opacity, backgroundColor: bgColor }]}>
      <Animated.Image
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        source={require('../../assets/images/splash-logo.png')}
        style={[styles.logo, { transform: [{ scale: logoScale }] }]}
        resizeMode="contain"
      />
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 9999,
  },
  logo: {
    width: 160,
    height: 160,
  },
});
