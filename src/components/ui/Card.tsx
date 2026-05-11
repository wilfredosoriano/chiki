import { View, ViewStyle } from 'react-native';
import { useTheme } from '@/hooks/useTheme';

interface CardProps {
  children: React.ReactNode;
  style?: ViewStyle;
  padding?: number;
}

export function Card({ children, style, padding }: CardProps) {
  const { colors, radius, shadow, isDark } = useTheme();
  return (
    <View
      style={[
        {
          backgroundColor: colors.surface,
          borderRadius: radius.lg,
          borderWidth: 1,
          borderColor: isDark ? colors.borderSubtle : colors.border,
          padding: padding ?? 16,
          // Shadows in light mode only
          ...(isDark ? {} : { shadowColor: '#000', ...shadow.sm }),
        },
        style,
      ]}
    >
      {children}
    </View>
  );
}
