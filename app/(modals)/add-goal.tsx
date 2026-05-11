/**
 * Add Goal modal — create a new savings goal.
 */
import { useState } from 'react';
import {
  View, ScrollView, TouchableOpacity, TextInput, StyleSheet,
  Alert, KeyboardAvoidingView, Platform,
} from 'react-native';
import { Text } from '@/components/ui/Text';
import { DatePickerSheet } from '@/components/ui/DatePickerSheet';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@/hooks/useTheme';
import { getDatabase } from '@/db/database';
import { insertGoal } from '@/db/goalQueries';
import type { SavingsGoal } from '@/types';

function generateId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

const PRESET_COLORS = ['#374151', '#064E3B', '#78350F', '#991B1B', '#881337', '#1E3A5F'];

const PRESET_EMOJIS = [
  '🌱', '💰', '🏠', '🚗', '✈️', '💻',
  '📱', '🎓', '💍', '👶', '🏥', '🏋️',
  '🎮', '🛒', '🎉', '🐷', '⭐', '🎸',
];

export default function AddGoalScreen() {
  const { colors, typography, spacing, radius } = useTheme();
  const insets = useSafeAreaInsets();

  const [name, setName] = useState('');
  const [targetAmount, setTargetAmount] = useState('');
  const [startingAmount, setStartingAmount] = useState('');
  const [targetDate, setTargetDate] = useState('');
  const [selectedColor, setSelectedColor] = useState(PRESET_COLORS[0]);
  const [selectedEmoji, setSelectedEmoji] = useState(PRESET_EMOJIS[0]);
  const [saving, setSaving] = useState(false);

  async function handleSave() {
    if (!name.trim()) {
      Alert.alert('Missing name', 'Please enter a goal name.');
      return;
    }
    const parsedTarget = parseFloat(targetAmount.replace(/,/g, ''));
    if (isNaN(parsedTarget) || parsedTarget <= 0) {
      Alert.alert('Invalid amount', 'Please enter a valid target amount.');
      return;
    }
    const parsedStart = parseFloat(startingAmount.replace(/,/g, '')) || 0;

    setSaving(true);
    try {
      const db = await getDatabase();
      const now = new Date().toISOString();
      const goal: SavingsGoal = {
        id: generateId(),
        name: name.trim(),
        targetAmount: parsedTarget,
        currentAmount: parsedStart,
        targetDate: targetDate.trim() || undefined,
        color: selectedColor,
        icon: selectedEmoji,
        createdAt: now,
        updatedAt: now,
      };
      await insertGoal(db, goal);
      router.back();
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      Alert.alert('Error saving goal', msg);
    } finally {
      setSaving(false);
    }
  }

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: colors.background }}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >

      {/* Header */}
      <View style={[styles.header, {
        paddingTop: insets.top + spacing.sm,
        paddingHorizontal: spacing.lg,
        borderBottomColor: colors.border,
        backgroundColor: colors.surface,
      }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="chevron-back" size={24} color={colors.textPrimary} />
        </TouchableOpacity>
        <Text style={{ color: colors.textPrimary, fontSize: typography.sizes.md, fontWeight: '700' }}>
          Add Savings Goal
        </Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ padding: spacing.lg, gap: spacing.lg, paddingBottom: insets.bottom + 32 }}
        keyboardShouldPersistTaps="handled"
      >
        {/* Goal name */}
        <View style={{ gap: spacing.xs }}>
          <Text style={{ color: colors.textSecondary, fontSize: typography.sizes.sm, fontWeight: '600' }}>
            Goal Name
          </Text>
          <TextInput
            value={name}
            onChangeText={setName}
            placeholder="e.g. Emergency Fund, New Laptop"
            placeholderTextColor={colors.textTertiary}
            style={[styles.input, {
              backgroundColor: colors.surface,
              borderColor: colors.border,
              color: colors.textPrimary,
              borderRadius: radius.md,
              fontSize: typography.sizes.base,
              fontFamily: 'Montserrat_400Regular',
            }]}
          />
        </View>

        {/* Target amount */}
        <View style={{ gap: spacing.xs }}>
          <Text style={{ color: colors.textSecondary, fontSize: typography.sizes.sm, fontWeight: '600' }}>
            Target Amount (₱)
          </Text>
          <View style={[styles.amountRow, {
            backgroundColor: colors.surface,
            borderColor: colors.border,
            borderRadius: radius.md,
          }]}>
            <Text style={{ color: selectedColor, fontSize: 28, fontWeight: '800' }}>₱</Text>
            <TextInput
              value={targetAmount}
              onChangeText={setTargetAmount}
              placeholder="0.00"
              placeholderTextColor={colors.textTertiary}
              keyboardType="decimal-pad"
              style={{
                flex: 1,
                color: colors.textPrimary,
                fontSize: 28,
                fontWeight: '800',
                fontFamily: 'Montserrat_800ExtraBold',
                marginLeft: spacing.sm,
              }}
            />
          </View>
        </View>

        {/* Starting amount */}
        <View style={{ gap: spacing.xs }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.xs }}>
            <Text style={{ color: colors.textSecondary, fontSize: typography.sizes.sm, fontWeight: '600' }}>
              Starting Amount (₱)
            </Text>
            <View style={[styles.optionalBadge, { backgroundColor: colors.surfaceSecondary }]}>
              <Text style={{ color: colors.textTertiary, fontSize: 10, fontWeight: '600' }}>OPTIONAL</Text>
            </View>
          </View>
          <TextInput
            value={startingAmount}
            onChangeText={setStartingAmount}
            placeholder="0.00"
            placeholderTextColor={colors.textTertiary}
            keyboardType="decimal-pad"
            style={[styles.input, {
              backgroundColor: colors.surface,
              borderColor: colors.border,
              color: colors.textPrimary,
              borderRadius: radius.md,
              fontSize: typography.sizes.base,
              fontFamily: 'Montserrat_400Regular',
            }]}
          />
        </View>

        {/* Target date */}
        <DatePickerSheet
          label="Target Date"
          value={targetDate || undefined}
          onChange={(d) => setTargetDate(d ?? '')}
          optional
        />

        {/* Emoji picker */}
        <View style={{ gap: spacing.sm }}>
          <Text style={{ color: colors.textSecondary, fontSize: typography.sizes.sm, fontWeight: '600' }}>
            Icon
          </Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs }}>
            {PRESET_EMOJIS.map((emoji) => {
              const selected = emoji === selectedEmoji;
              return (
                <TouchableOpacity
                  key={emoji}
                  onPress={() => setSelectedEmoji(emoji)}
                  style={{
                    width: 44,
                    height: 44,
                    borderRadius: radius.md,
                    alignItems: 'center',
                    justifyContent: 'center',
                    backgroundColor: selected ? '#082D20' : colors.surface,
                    borderWidth: 1.5,
                    borderColor: selected ? '#082D20' : colors.border,
                  }}
                >
                  <Text style={{ fontSize: 22 }}>{emoji}</Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        {/* Color picker */}
        <View style={{ gap: spacing.sm }}>
          <Text style={{ color: colors.textSecondary, fontSize: typography.sizes.sm, fontWeight: '600' }}>
            Color
          </Text>
          <View style={{ flexDirection: 'row', gap: spacing.md, flexWrap: 'wrap' }}>
            {PRESET_COLORS.map((color) => (
              <TouchableOpacity
                key={color}
                onPress={() => setSelectedColor(color)}
                style={[styles.colorDot, {
                  backgroundColor: color,
                  borderWidth: selectedColor === color ? 3 : 0,
                  borderColor: '#fff',
                  shadowColor: color,
                  shadowOpacity: selectedColor === color ? 0.5 : 0,
                  shadowRadius: 6,
                  elevation: selectedColor === color ? 4 : 0,
                }]}
              >
                {selectedColor === color && (
                  <Ionicons name="checkmark" size={16} color="#fff" />
                )}
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Save */}
        <TouchableOpacity
          style={[styles.saveBtn, {
            backgroundColor: saving ? colors.border : selectedColor,
            borderRadius: radius.lg,
            marginTop: spacing.sm,
          }]}
          onPress={handleSave}
          disabled={saving}
        >
          <Ionicons name="checkmark-circle-outline" size={20} color="#fff" />
          <Text style={{ color: '#fff', fontWeight: '700', fontSize: typography.sizes.base }}>
            {saving ? 'Saving...' : 'Save Goal'}
          </Text>
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingBottom: 12,
    borderBottomWidth: 1,
  },
  backBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  input: {
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 13,
  },
  amountRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  inputIconRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 13,
  },
  optionalBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  colorDot: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  saveBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 16,
  },
});
