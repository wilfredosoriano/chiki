/**
 * NotificationPanel — slide-down overlay showing in-app alerts.
 * Triggered from the dashboard bell icon.
 */
import React, { useEffect, useRef } from 'react';
import {
  Modal,
  View,
  Pressable,
  ScrollView,
  Animated,
  StyleSheet,
  Dimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Text } from '@/components/ui/Text';
import { useTheme } from '@/hooks/useTheme';
import { useAlertStore } from '@/stores/alertStore';
import type { AppAlert } from '@/stores/alertStore';

const { height: SCREEN_HEIGHT } = Dimensions.get('window');
const PANEL_MAX_HEIGHT = SCREEN_HEIGHT * 0.65;
const PANEL_TRANSLATE_HIDDEN = -PANEL_MAX_HEIGHT - 80;

interface Props {
  visible: boolean;
  onClose: () => void;
}

export function NotificationPanel({ visible, onClose }: Props) {
  const { colors, radius, isDark } = useTheme();
  const insets = useSafeAreaInsets();
  const { alerts, markRead, markAllRead, clearAll, getUnreadCount } = useAlertStore();
  const unreadCount = getUnreadCount();

  // Animation values
  const translateY = useRef(new Animated.Value(PANEL_TRANSLATE_HIDDEN)).current;
  const backdropOpacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible) {
      Animated.parallel([
        Animated.spring(translateY, {
          toValue: 0,
          useNativeDriver: true,
          damping: 22,
          stiffness: 200,
          mass: 0.8,
        }),
        Animated.timing(backdropOpacity, {
          toValue: 1,
          duration: 200,
          useNativeDriver: true,
        }),
      ]).start();
    } else {
      Animated.parallel([
        Animated.spring(translateY, {
          toValue: PANEL_TRANSLATE_HIDDEN,
          useNativeDriver: true,
          damping: 22,
          stiffness: 200,
          mass: 0.8,
        }),
        Animated.timing(backdropOpacity, {
          toValue: 0,
          duration: 180,
          useNativeDriver: true,
        }),
      ]).start();
    }
  }, [visible]);

  function handleClearAll() {
    clearAll();
    onClose();
  }

  return (
    <Modal
      visible={visible}
      transparent
      animationType="none"
      onRequestClose={onClose}
      statusBarTranslucent
    >
      {/* Backdrop */}
      <Animated.View
        style={[styles.backdrop, { opacity: backdropOpacity }]}
        pointerEvents={visible ? 'auto' : 'none'}
      >
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
      </Animated.View>

      {/* Panel */}
      <Animated.View
        style={[
          styles.panel,
          {
            transform: [{ translateY }],
            backgroundColor: colors.surface,
            borderColor: colors.border,
            paddingTop: insets.top + 8,
            maxHeight: PANEL_MAX_HEIGHT + insets.top,
          },
          isDark ? {} : styles.panelShadow,
        ]}
        pointerEvents={visible ? 'auto' : 'none'}
      >
        {/* Header row */}
        <View style={[styles.headerRow, { paddingHorizontal: 20, paddingBottom: 12, borderBottomColor: colors.border }]}>
          <Text style={{ color: colors.textPrimary, fontSize: 17, fontWeight: '600', letterSpacing: -0.2 }}>
            Notifications
          </Text>
          <View style={styles.headerActions}>
            {unreadCount > 0 && (
              <Pressable
                onPress={markAllRead}
                style={({ pressed }) => ({ opacity: pressed ? 0.6 : 1 })}
              >
                <Text style={{ color: colors.accent, fontSize: 13, fontWeight: '500' }}>
                  Mark all read
                </Text>
              </Pressable>
            )}
            <Pressable
              onPress={onClose}
              hitSlop={8}
              style={({ pressed }) => [
                styles.closeBtn,
                {
                  backgroundColor: colors.surfaceElevated,
                  opacity: pressed ? 0.7 : 1,
                },
              ]}
            >
              <Ionicons name="close" size={16} color={colors.textSecondary} />
            </Pressable>
          </View>
        </View>

        {/* Content */}
        {alerts.length === 0 ? (
          <View style={styles.emptyState}>
            <View style={[styles.emptyIcon, { backgroundColor: colors.surfaceElevated }]}>
              <Ionicons name="notifications-off-outline" size={26} color={colors.textTertiary} />
            </View>
            <Text style={{ color: colors.textPrimary, fontSize: 15, fontWeight: '500', marginTop: 14, letterSpacing: -0.2 }}>
              You're all caught up
            </Text>
            <Text style={{ color: colors.textTertiary, fontSize: 13, marginTop: 4, textAlign: 'center', lineHeight: 19 }}>
              No alerts right now.{'\n'}Check back after adding transactions.
            </Text>
          </View>
        ) : (
          <>
            <ScrollView
              style={{ flex: 1 }}
              showsVerticalScrollIndicator={false}
              contentContainerStyle={{ paddingBottom: 8 }}
            >
              {alerts.map((alert, idx) => (
                <AlertRow
                  key={alert.id}
                  alert={alert}
                  isLast={idx === alerts.length - 1}
                  onPress={() => markRead(alert.id)}
                  colors={colors}
                  radius={radius}
                />
              ))}
            </ScrollView>

            {/* Clear all footer */}
            <View style={[styles.footer, { borderTopColor: colors.border, paddingBottom: insets.bottom > 0 ? insets.bottom : 12 }]}>
              <Pressable
                onPress={handleClearAll}
                style={({ pressed }) => [
                  styles.clearBtn,
                  {
                    backgroundColor: colors.surfaceElevated,
                    borderColor: colors.border,
                    borderRadius: radius.lg,
                    opacity: pressed ? 0.7 : 1,
                  },
                ]}
              >
                <Ionicons name="trash-outline" size={15} color={colors.textTertiary} />
                <Text style={{ color: colors.textTertiary, fontSize: 13, fontWeight: '500' }}>
                  Clear all
                </Text>
              </Pressable>
            </View>
          </>
        )}
      </Animated.View>
    </Modal>
  );
}

// ── Alert row ─────────────────────────────────────────────────────────────────

interface AlertRowProps {
  alert: AppAlert;
  isLast: boolean;
  onPress: () => void;
  colors: ReturnType<typeof useTheme>['colors'];
  radius: ReturnType<typeof useTheme>['radius'];
}

function AlertRow({ alert, isLast, onPress, colors, radius }: AlertRowProps) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.alertRow,
        !isLast && { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border },
        { backgroundColor: pressed ? colors.surfaceElevated : 'transparent' },
        !alert.isRead && { backgroundColor: alert.iconColor + '08' },
      ]}
    >
      {/* Icon circle */}
      <View
        style={[
          styles.iconCircle,
          {
            backgroundColor: alert.iconColor + '26',
            borderRadius: radius.full,
          },
        ]}
      >
        <Ionicons
          name={alert.icon as any}
          size={18}
          color={alert.iconColor}
        />
      </View>

      {/* Text block */}
      <View style={{ flex: 1, gap: 2 }}>
        <Text
          style={{
            color: colors.textPrimary,
            fontSize: 14,
            fontWeight: alert.isRead ? '400' : '600',
            letterSpacing: -0.1,
          }}
          numberOfLines={1}
        >
          {alert.title}
        </Text>
        <Text
          style={{ color: colors.textSecondary, fontSize: 13, lineHeight: 18 }}
          numberOfLines={2}
        >
          {alert.body}
        </Text>
      </View>

      {/* Unread dot */}
      {!alert.isRead && (
        <View style={[styles.unreadDot, { backgroundColor: colors.expense }]} />
      )}
    </Pressable>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.4)',
  },
  panel: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    borderBottomLeftRadius: 20,
    borderBottomRightRadius: 20,
    borderWidth: 1,
    borderTopWidth: 0,
    overflow: 'hidden',
  },
  panelShadow: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.10,
    shadowRadius: 24,
    elevation: 10,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  closeBtn: {
    width: 28,
    height: 28,
    borderRadius: 9999,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 40,
    paddingHorizontal: 32,
  },
  emptyIcon: {
    width: 52,
    height: 52,
    borderRadius: 9999,
    alignItems: 'center',
    justifyContent: 'center',
  },
  alertRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 20,
    paddingVertical: 13,
  },
  iconCircle: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  unreadDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    flexShrink: 0,
  },
  footer: {
    paddingTop: 10,
    paddingHorizontal: 20,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  clearBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 11,
    borderWidth: 1,
  },
});
