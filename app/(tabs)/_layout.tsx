import { Tabs } from 'expo-router';
import { StatusBar } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '@/hooks/useTheme';
import { FloatingTabBar } from '@/components/FloatingTabBar';
import { Ionicons } from '@expo/vector-icons';

const TAB_HEIGHT = 60;
const TAB_MARGIN = 20;

export default function TabLayout() {
  const { colors, isDark } = useTheme();
  const insets = useSafeAreaInsets();

  const sceneBottomPad = TAB_HEIGHT + TAB_MARGIN + insets.bottom;

  return (
    <>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} />
      <Tabs
        tabBar={(props) => <FloatingTabBar {...props} />}
        screenOptions={{
          lazy: false,
          headerShown: false,
          animation: 'none',
          sceneStyle: { backgroundColor: colors.background, paddingBottom: sceneBottomPad },
        }}
      >
        <Tabs.Screen
          name="index"
          options={{
            tabBarIcon: ({ color, focused }) => (
              <Ionicons name={focused ? 'home' : 'home-outline'} size={22} color={color} />
            ),
          }}
        />
        <Tabs.Screen
          name="transactions"
          options={{
            tabBarIcon: ({ color, focused }) => (
              <Ionicons name={focused ? 'swap-vertical' : 'swap-vertical-outline'} size={22} color={color} />
            ),
          }}
        />
        <Tabs.Screen
          name="budgets"
          options={{
            tabBarIcon: ({ color, focused }) => (
              <Ionicons name={focused ? 'pie-chart' : 'pie-chart-outline'} size={22} color={color} />
            ),
          }}
        />
        <Tabs.Screen
          name="goals"
          options={{
            tabBarIcon: ({ color, focused }) => (
              <Ionicons name={focused ? 'trophy' : 'trophy-outline'} size={22} color={color} />
            ),
          }}
        />
        <Tabs.Screen
          name="loans"
          options={{
            tabBarIcon: ({ color, focused }) => (
              <Ionicons name={focused ? 'document-text' : 'document-text-outline'} size={22} color={color} />
            ),
          }}
        />
        <Tabs.Screen
          name="settings"
          options={{
            tabBarIcon: ({ color, focused }) => (
              <Ionicons name={focused ? 'settings' : 'settings-outline'} size={22} color={color} />
            ),
          }}
        />
        <Tabs.Screen
          name="analytics"
          options={{
            href: null,
            tabBarIcon: ({ color }) => (
              <Ionicons name="bar-chart-outline" size={22} color={color} />
            ),
          }}
        />
      </Tabs>
    </>
  );
}
