import { Stack } from 'expo-router';
import { StatusBar } from 'react-native';
import { useTheme } from '@/hooks/useTheme';

export default function ModalsLayout() {
  const { colors, isDark } = useTheme();
  return (
    <>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} />
    <Stack
      screenOptions={{
        headerShown: false,
        presentation: 'transparentModal',
        animation: 'none',
        contentStyle: { backgroundColor: colors.background },
      }}
    >
      <Stack.Screen name="add-account" />
      <Stack.Screen name="add-transaction" />
      <Stack.Screen name="add-budget" />
      <Stack.Screen name="add-goal" />
      <Stack.Screen name="add-loan" />
      <Stack.Screen name="chiki-chat" />
    </Stack>
    </>
  );
}
