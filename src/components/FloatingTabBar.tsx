import React from 'react';
import { View, Pressable, StyleSheet } from 'react-native';
import type { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '@/hooks/useTheme';

// Layout
const PILL_HEIGHT   = 60;
const BTN_SIZE      = 60;
const BTN_RADIUS    = 20;
const GAP           = 8;
const BOTTOM_MARGIN = 20;

type IconName = keyof typeof Ionicons.glyphMap;
const ICONS: Record<string, [IconName, IconName]> = {
  index:        ['home',          'home-outline'],
  transactions: ['swap-vertical', 'swap-vertical-outline'],
  budgets:      ['pie-chart',     'pie-chart-outline'],
  goals:        ['trophy',        'trophy-outline'],
  loans:        ['document-text', 'document-text-outline'],
  settings:     ['settings',      'settings-outline'],
};

// The last route is the detached button; the rest live in the pill
const PILL_ROUTES   = ['index', 'transactions', 'budgets', 'goals', 'loans'];
const DETACH_ROUTE  = 'settings';

export function FloatingTabBar({ state, navigation }: BottomTabBarProps) {
  const { colors, isDark } = useTheme();
  const insets = useSafeAreaInsets();

  const pillBg = isDark
    ? colors.surfaceElevated + 'F5'
    : colors.surface + 'F8';

  const pillBorder = isDark ? colors.border : colors.border;

  const activeIconColor  = isDark ? colors.textPrimary : '#1A1A1E';
  const inactiveIconColor = isDark ? '#6B6E72' : '#B0B3B8';

  function navigate(routeName: string, routeKey: string, focused: boolean) {
    const event = navigation.emit({
      type: 'tabPress',
      target: routeKey,
      canPreventDefault: true,
    });
    if (!focused && !event.defaultPrevented) {
      navigation.navigate(routeName);
    }
  }

  return (
    <View
      pointerEvents="box-none"
      style={[styles.wrapper, { bottom: BOTTOM_MARGIN + insets.bottom }]}
    >
      {/* ── Pill ─────────────────────────────────────────────────── */}
      <View
        style={[
          styles.pill,
          {
            backgroundColor: pillBg,
            borderColor: pillBorder,
            ...(isDark
              ? {}
              : {
                  shadowColor: '#000',
                  shadowOffset: { width: 0, height: 6 },
                  shadowOpacity: 0.09,
                  shadowRadius: 20,
                  elevation: 10,
                }),
          },
        ]}
      >
        {state.routes
          .filter((r) => PILL_ROUTES.includes(r.name))
          .map((route) => {
            const focused = state.routes[state.index]?.name === route.name;
            const [on, off] = ICONS[route.name] ?? ['ellipse', 'ellipse-outline'];
            const iconColor = focused ? activeIconColor : inactiveIconColor;

            return (
              <Pressable
                key={route.key}
                onPress={() => navigate(route.name, route.key, focused)}
                style={styles.pillTab}
                android_ripple={{ color: '#00000010', borderless: true, radius: 24 }}
              >
                {/* Active bg highlight */}
                {focused && (
                  <View
                    style={[
                      styles.activeHighlight,
                      { backgroundColor: isDark ? '#FFFFFF10' : '#00000009' },
                    ]}
                  />
                )}
                <Ionicons
                  name={focused ? on : off}
                  size={22}
                  color={iconColor}
                />
              </Pressable>
            );
          })}
      </View>

      {/* ── Detached settings button ──────────────────────────────── */}
      {state.routes
        .filter((r) => r.name === DETACH_ROUTE)
        .map((route) => {
          const focused = state.routes[state.index]?.name === route.name;
          const [on, off] = ICONS[route.name] ?? ['ellipse', 'ellipse-outline'];

          return (
            <Pressable
              key={route.key}
              onPress={() => navigate(route.name, route.key, focused)}
              style={[
                styles.detachBtn,
                {
                  backgroundColor: focused
                    ? colors.accent
                    : isDark ? colors.surfaceElevated : colors.accent,
                  borderColor: isDark ? colors.border : 'transparent',
                  ...(isDark
                    ? {}
                    : {
                        shadowColor: colors.accent,
                        shadowOffset: { width: 0, height: 4 },
                        shadowOpacity: 0.30,
                        shadowRadius: 12,
                        elevation: 8,
                      }),
                },
              ]}
              android_ripple={{ color: '#FFFFFF30', borderless: false, radius: BTN_RADIUS }}
            >
              <Ionicons
                name={focused ? on : off}
                size={22}
                color={focused || !isDark ? '#FFFFFF' : inactiveIconColor}
              />
            </Pressable>
          );
        })}
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    position: 'absolute',
    left: 16,
    right: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: GAP,
  },
  pill: {
    flex: 1,
    height: PILL_HEIGHT,
    borderRadius: PILL_HEIGHT / 2,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: StyleSheet.hairlineWidth,
    overflow: 'hidden',
  },
  pillTab: {
    flex: 1,
    height: PILL_HEIGHT,
    alignItems: 'center',
    justifyContent: 'center',
  },
  activeHighlight: {
    position: 'absolute',
    width: 42,
    height: 42,
    borderRadius: 21,
  },
  detachBtn: {
    width: BTN_SIZE,
    height: BTN_SIZE,
    borderRadius: BTN_RADIUS,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: StyleSheet.hairlineWidth,
  },
});
