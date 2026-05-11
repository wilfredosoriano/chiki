/**
 * Themed Text — maps fontWeight → correct Montserrat variant automatically.
 * Drop-in replacement for `import { Text } from 'react-native'`.
 *
 * Key design rule:
 *  - fontFamily is injected LAST in the style array so it always wins over
 *    any value (including undefined) that comes from StyleSheet.create objects.
 *  - StyleSheet.flatten handles arrays, registered IDs, and plain objects
 *    natively — we rely on it for a single reliable extraction pass.
 *  - fontWeight is deliberately NOT stripped so layout/a11y still see it,
 *    but fontFamily takes precedence for actual rendering on both iOS and Android.
 *  - letterSpacing: -0.2 compensates for Montserrat being wider than SF Pro /
 *    Roboto. Callers can override with their own letterSpacing in their style.
 */
import React from 'react';
import { Text as RNText, TextProps, StyleSheet } from 'react-native';

const FONT_MAP: Record<string, string> = {
  '100': 'Montserrat_100Thin',
  '200': 'Montserrat_200ExtraLight',
  '300': 'Montserrat_300Light',
  '400': 'Montserrat_400Regular',
  'normal': 'Montserrat_400Regular',
  '500': 'Montserrat_500Medium',
  '600': 'Montserrat_600SemiBold',
  '700': 'Montserrat_700Bold',
  'bold': 'Montserrat_700Bold',
  '800': 'Montserrat_800ExtraBold',
  '900': 'Montserrat_900Black',
};

export function Text({ style, ...props }: TextProps) {
  // StyleSheet.flatten handles arrays, registered IDs, and plain objects.
  const flat = StyleSheet.flatten(style);
  const weight = String(flat?.fontWeight ?? '400');
  // Use caller's fontFamily if explicitly provided, otherwise map from weight.
  const fontFamily = (flat?.fontFamily as string | undefined) ?? FONT_MAP[weight] ?? 'Montserrat_400Regular';

  // CRITICAL for Android (Fabric / New Architecture):
  // On Android, if fontWeight is set alongside a custom fontFamily, the native
  // text renderer tries to resolve fontWeight through the system font stack,
  // often overriding the custom font entirely with synthetic bold.
  // Solution: always override fontWeight to 'normal' — the correct visual
  // weight is already encoded in the font file itself (e.g. Montserrat_700Bold).
  //
  // Style order:
  //   1. { letterSpacing: -0.2 }           — our default, overridable by caller
  //   2. style                             — all caller styles
  //   3. { fontFamily, fontWeight:'normal'} — LAST: font wins, weight cleared
  return (
    <RNText
      style={[{ letterSpacing: -0.2 }, style, { fontFamily, fontWeight: 'normal' }]}
      {...props}
    />
  );
}
