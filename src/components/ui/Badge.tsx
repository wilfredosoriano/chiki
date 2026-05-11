import { View } from 'react-native';
import { Text } from '@/components/ui/Text';
import { useTheme } from '@/hooks/useTheme';

type BadgeVariant = 'default' | 'accent' | 'danger';

interface BadgeProps {
  label: string;
  variant?: BadgeVariant;
  // Legacy props — kept for backward compat
  color?: string;
  background?: string;
}

export function Badge({ label, variant = 'default', color, background }: BadgeProps) {
  const { colors } = useTheme();

  // If legacy color/background props provided, use them directly
  if (color || background) {
    return (
      <View style={{
        backgroundColor: background ?? colors.surfaceElevated,
        paddingHorizontal: 10,
        paddingVertical: 4,
        borderRadius: 9999,
      }}>
        <Text style={{
          color: color ?? colors.textSecondary,
          fontSize: 11,
          fontWeight: '500',
          letterSpacing: 0.5,
          textTransform: 'uppercase',
        }}>
          {label}
        </Text>
      </View>
    );
  }

  const variantStyles: Record<BadgeVariant, { bg: string; text: string }> = {
    default: { bg: colors.surfaceElevated,                  text: colors.textSecondary },
    accent:  { bg: colors.accent + '1A',                    text: colors.accent },
    danger:  { bg: colors.expense + '1A',                   text: colors.expense },
  };
  const { bg, text } = variantStyles[variant];

  return (
    <View style={{
      backgroundColor: bg,
      paddingHorizontal: 10,
      paddingVertical: 4,
      borderRadius: 9999,
    }}>
      <Text style={{
        color: text,
        fontSize: 11,
        fontWeight: '500',
        letterSpacing: 0.5,
        textTransform: 'uppercase',
      }}>
        {label}
      </Text>
    </View>
  );
}
