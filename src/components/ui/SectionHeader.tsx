import { View, Pressable } from 'react-native';
import { Text } from '@/components/ui/Text';
import { useTheme } from '@/hooks/useTheme';

interface SectionHeaderProps {
  title: string;
  actionLabel?: string;
  onAction?: () => void;
}

export function SectionHeader({ title, actionLabel, onAction }: SectionHeaderProps) {
  const { colors } = useTheme();
  return (
    <View style={{
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 16,
      marginTop: 24,
    }}>
      <Text style={{
        color: colors.textTertiary,
        fontSize: 11,
        fontWeight: '500',
        letterSpacing: 0.5,
        textTransform: 'uppercase',
      }}>
        {title}
      </Text>
      {actionLabel && (
        <Pressable
          onPress={onAction}
          style={({ pressed }) => ({ opacity: pressed ? 0.6 : 1 })}
        >
          <Text style={{
            color: colors.accent,
            fontSize: 12,
            fontWeight: '500',
            letterSpacing: 0.2,
          }}>
            {actionLabel}
          </Text>
        </Pressable>
      )}
    </View>
  );
}
