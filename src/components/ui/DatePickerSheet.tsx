import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Modal,
  Pressable,
  StyleSheet,
  Animated,
  Dimensions,
  ScrollView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { format, getDay, getDaysInMonth, startOfMonth } from '@/utils/dateUtils';
import { useTheme } from '@/hooks/useTheme';
import { Text } from '@/components/ui/Text';

const SCREEN_HEIGHT = Dimensions.get('window').height;
const DAY_CELL_SIZE = 38;
const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTH_NAMES = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
];

interface DatePickerSheetProps {
  label: string;
  value: string | undefined;
  onChange: (date: string | undefined) => void;
  optional?: boolean;
  placeholder?: string;
  minDate?: string;
}

interface ParsedDate {
  year: number;
  month: number;
  day: number;
}

function parseDate(dateStr: string): ParsedDate {
  const [year, month, day] = dateStr.split('-').map(Number);
  return { year, month: month - 1, day };
}

function toDateString(year: number, month: number, day: number): string {
  const mm = String(month + 1).padStart(2, '0');
  const dd = String(day).padStart(2, '0');
  return `${year}-${mm}-${dd}`;
}

interface CalendarDay {
  day: number;
  month: number;
  year: number;
  isCurrentMonth: boolean;
}

function buildCalendarGrid(year: number, month: number): CalendarDay[][] {
  const firstDay = getDay(startOfMonth(new Date(year, month, 1)));
  const daysInMonth = getDaysInMonth(new Date(year, month, 1));

  const prevMonth = month === 0 ? 11 : month - 1;
  const prevYear = month === 0 ? year - 1 : year;
  const daysInPrevMonth = getDaysInMonth(new Date(prevYear, prevMonth, 1));

  const nextMonth = month === 11 ? 0 : month + 1;
  const nextYear = month === 11 ? year + 1 : year;

  const cells: CalendarDay[] = [];

  for (let i = firstDay - 1; i >= 0; i--) {
    cells.push({
      day: daysInPrevMonth - i,
      month: prevMonth,
      year: prevYear,
      isCurrentMonth: false,
    });
  }

  for (let d = 1; d <= daysInMonth; d++) {
    cells.push({ day: d, month, year, isCurrentMonth: true });
  }

  let nextDay = 1;
  while (cells.length % 7 !== 0) {
    cells.push({
      day: nextDay++,
      month: nextMonth,
      year: nextYear,
      isCurrentMonth: false,
    });
  }

  const rows: CalendarDay[][] = [];
  for (let i = 0; i < cells.length; i += 7) {
    rows.push(cells.slice(i, i + 7));
  }

  return rows;
}

export function DatePickerSheet({
  label,
  value,
  onChange,
  optional = false,
  placeholder = 'Select date',
  minDate,
}: DatePickerSheetProps) {
  const { colors, radius } = useTheme();
  const [visible, setVisible] = useState(false);

  const today = new Date();
  const todayYear = today.getFullYear();
  const todayMonth = today.getMonth();
  const todayDay = today.getDate();

  const getInitialView = () => {
    if (value) {
      const parsed = parseDate(value);
      return { year: parsed.year, month: parsed.month };
    }
    return { year: todayYear, month: todayMonth };
  };

  const [viewYear, setViewYear] = useState(getInitialView().year);
  const [viewMonth, setViewMonth] = useState(getInitialView().month);
  const [pendingValue, setPendingValue] = useState<string | undefined>(value);
  // When true, show the month/year quick-picker instead of the calendar grid
  const [pickerMode, setPickerMode] = useState(false);
  // pickerYear is the year shown inside the month/year picker panel
  const [pickerYear, setPickerYear] = useState(getInitialView().year);

  const slideAnim = useRef(new Animated.Value(400)).current;

  useEffect(() => {
    if (visible) {
      const init = getInitialView();
      setViewYear(init.year);
      setViewMonth(init.month);
      setPickerYear(init.year);
      setPendingValue(value);
      setPickerMode(false);
      Animated.spring(slideAnim, {
        toValue: 0,
        useNativeDriver: true,
        damping: 20,
        stiffness: 150,
      }).start();
    } else {
      slideAnim.setValue(400);
    }
  }, [visible]);

  const handleOpen = () => setVisible(true);

  const handleClose = () => {
    Animated.timing(slideAnim, {
      toValue: 400,
      duration: 220,
      useNativeDriver: true,
    }).start(() => setVisible(false));
  };

  const handleDone = () => {
    onChange(pendingValue);
    handleClose();
  };

  const handleClear = () => {
    setPendingValue(undefined);
    onChange(undefined);
    handleClose();
  };

  const handlePrevMonth = () => {
    if (viewMonth === 0) {
      setViewMonth(11);
      setViewYear((y) => y - 1);
    } else {
      setViewMonth((m) => m - 1);
    }
  };

  const handleNextMonth = () => {
    if (viewMonth === 11) {
      setViewMonth(0);
      setViewYear((y) => y + 1);
    } else {
      setViewMonth((m) => m + 1);
    }
  };

  const isDisabled = (year: number, month: number, day: number): boolean => {
    if (!minDate) return false;
    const cellStr = toDateString(year, month, day);
    return cellStr < minDate;
  };

  const isToday = (year: number, month: number, day: number) =>
    year === todayYear && month === todayMonth && day === todayDay;

  const isSelected = (year: number, month: number, day: number) => {
    if (!pendingValue) return false;
    const parsed = parseDate(pendingValue);
    return parsed.year === year && parsed.month === month && parsed.day === day;
  };

  const handleDayPress = (cell: CalendarDay) => {
    if (isDisabled(cell.year, cell.month, cell.day)) return;
    const dateStr = toDateString(cell.year, cell.month, cell.day);
    setPendingValue(dateStr);
    if (!cell.isCurrentMonth) {
      setViewYear(cell.year);
      setViewMonth(cell.month);
    }
  };

  // Tap a month chip in the picker panel → jump calendar there
  const handlePickerMonthSelect = (monthIndex: number) => {
    setViewYear(pickerYear);
    setViewMonth(monthIndex);
    setPickerMode(false);
  };

  const displayValue = value
    ? (() => {
        const parsed = parseDate(value);
        return format(new Date(parsed.year, parsed.month, parsed.day), 'MMMM d, yyyy');
      })()
    : null;

  const monthLabel = format(new Date(viewYear, viewMonth, 1), 'MMMM yyyy');
  const grid = buildCalendarGrid(viewYear, viewMonth);

  const styles = StyleSheet.create({
    fieldRow: {
      flexDirection: 'row',
      alignItems: 'center',
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: radius.md,
      paddingHorizontal: 14,
      paddingVertical: 13,
      backgroundColor: colors.surface,
      gap: 10,
    },
    fieldLabel: {
      marginBottom: 6,
    },
    fieldText: {
      flex: 1,
    },
    backdrop: {
      flex: 1,
      backgroundColor: 'rgba(0,0,0,0.55)',
      justifyContent: 'flex-end',
    },
    sheet: {
      backgroundColor: colors.surface,
      borderTopLeftRadius: 20,
      borderTopRightRadius: 20,
      maxHeight: SCREEN_HEIGHT * 0.72,
      paddingBottom: 32,
    },
    dragHandle: {
      alignSelf: 'center',
      marginTop: 10,
      marginBottom: 6,
      width: 36,
      height: 4,
      borderRadius: 2,
      backgroundColor: colors.border,
    },
    sheetHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: 20,
      paddingVertical: 12,
    },
    navButton: {
      width: 36,
      height: 36,
      alignItems: 'center',
      justifyContent: 'center',
      borderRadius: 18,
    },
    // Month/year picker panel
    pickerPanel: {
      paddingHorizontal: 16,
      paddingBottom: 8,
    },
    pickerYearRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 20,
      marginBottom: 16,
    },
    pickerYearBtn: {
      width: 36,
      height: 36,
      alignItems: 'center',
      justifyContent: 'center',
      borderRadius: 18,
      backgroundColor: colors.surfaceElevated,
    },
    monthGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 8,
    },
    monthChip: {
      width: '22%',
      flexGrow: 1,
      paddingVertical: 10,
      alignItems: 'center',
      borderRadius: radius.md,
      borderWidth: 1,
    },
    dayNamesRow: {
      flexDirection: 'row',
      paddingHorizontal: 16,
      marginBottom: 4,
    },
    dayNameCell: {
      width: DAY_CELL_SIZE,
      alignItems: 'center',
      flex: 1,
    },
    gridRow: {
      flexDirection: 'row',
      paddingHorizontal: 16,
      marginBottom: 2,
    },
    dayCell: {
      flex: 1,
      height: DAY_CELL_SIZE,
      alignItems: 'center',
      justifyContent: 'center',
    },
    dayCellInner: {
      width: DAY_CELL_SIZE,
      height: DAY_CELL_SIZE,
      alignItems: 'center',
      justifyContent: 'center',
      borderRadius: DAY_CELL_SIZE / 2,
    },
    todayDot: {
      width: 4,
      height: 4,
      borderRadius: 2,
      backgroundColor: colors.accent,
      marginTop: 1,
      position: 'absolute',
      bottom: 3,
    },
    footer: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: 20,
      paddingTop: 16,
    },
    doneButton: {
      backgroundColor: colors.accent,
      paddingHorizontal: 24,
      paddingVertical: 10,
      borderRadius: radius.md,
    },
  });

  return (
    <View>
      <View style={[styles.fieldLabel, { flexDirection: 'row', alignItems: 'center', gap: 6 }]}>
        <Text style={{ color: colors.textSecondary, fontSize: 13, fontWeight: '600' }}>
          {label}
        </Text>
        {optional && (
          <Text style={{ color: colors.textTertiary, fontSize: 10, fontWeight: '600' }}>(optional)</Text>
        )}
      </View>
      <Pressable onPress={handleOpen} style={({ pressed }) => [styles.fieldRow, { opacity: pressed ? 0.7 : 1 }]}>
        <Ionicons name="calendar-outline" size={18} color={colors.textTertiary} />
        <Text
          style={[
            styles.fieldText,
            { color: displayValue ? colors.textPrimary : colors.textTertiary, fontSize: 15 },
          ]}
        >
          {displayValue ?? placeholder}
        </Text>
        <Ionicons name="chevron-down" size={16} color={colors.textTertiary} style={{ opacity: 0.4 }} />
      </Pressable>

      <Modal transparent visible={visible} animationType="none" onRequestClose={handleClose}>
        <Pressable style={styles.backdrop} onPress={handleClose}>
          <Animated.View
            style={[styles.sheet, { transform: [{ translateY: slideAnim }] }]}
            onStartShouldSetResponder={() => true}
          >
            <Pressable onPress={(e) => e.stopPropagation()}>
              <View style={styles.dragHandle} />

              {/* ── Header: prev / "Month Year ▾" / next ── */}
              <View style={styles.sheetHeader}>
                {pickerMode ? (
                  // In picker mode the arrows jump years; centre shows current picker year
                  <>
                    <Pressable
                      style={({ pressed }) => [styles.navButton, { opacity: pressed ? 0.5 : 1 }]}
                      onPress={() => setPickerYear((y) => y - 1)}
                    >
                      <Ionicons name="chevron-back" size={20} color={colors.textPrimary} />
                    </Pressable>
                    <Pressable
                      onPress={() => setPickerMode(false)}
                      style={({ pressed }) => ({
                        flexDirection: 'row', alignItems: 'center', gap: 4,
                        opacity: pressed ? 0.6 : 1,
                      })}
                    >
                      <Text style={{ color: colors.textPrimary, fontSize: 16, fontWeight: '600', letterSpacing: -0.3 }}>
                        {pickerYear}
                      </Text>
                      <Ionicons name="chevron-up" size={14} color={colors.textSecondary} />
                    </Pressable>
                    <Pressable
                      style={({ pressed }) => [styles.navButton, { opacity: pressed ? 0.5 : 1 }]}
                      onPress={() => setPickerYear((y) => y + 1)}
                    >
                      <Ionicons name="chevron-forward" size={20} color={colors.textPrimary} />
                    </Pressable>
                  </>
                ) : (
                  // Normal mode: arrows navigate months; tapping label opens picker
                  <>
                    <Pressable
                      style={({ pressed }) => [styles.navButton, { opacity: pressed ? 0.5 : 1 }]}
                      onPress={handlePrevMonth}
                    >
                      <Ionicons name="chevron-back" size={20} color={colors.textPrimary} />
                    </Pressable>
                    <Pressable
                      onPress={() => { setPickerYear(viewYear); setPickerMode(true); }}
                      style={({ pressed }) => ({
                        flexDirection: 'row', alignItems: 'center', gap: 4,
                        opacity: pressed ? 0.6 : 1,
                      })}
                    >
                      <Text style={{ color: colors.textPrimary, fontSize: 16, fontWeight: '600', letterSpacing: -0.3 }}>
                        {monthLabel}
                      </Text>
                      <Ionicons name="chevron-down" size={14} color={colors.textSecondary} />
                    </Pressable>
                    <Pressable
                      style={({ pressed }) => [styles.navButton, { opacity: pressed ? 0.5 : 1 }]}
                      onPress={handleNextMonth}
                    >
                      <Ionicons name="chevron-forward" size={20} color={colors.textPrimary} />
                    </Pressable>
                  </>
                )}
              </View>

              {pickerMode ? (
                /* ── Month/Year quick-picker ── */
                <View style={styles.pickerPanel}>
                  <View style={styles.monthGrid}>
                    {MONTH_NAMES.map((name, idx) => {
                      const isCurrentViewMonth = idx === viewMonth && pickerYear === viewYear;
                      return (
                        <Pressable
                          key={name}
                          onPress={() => handlePickerMonthSelect(idx)}
                          style={({ pressed }) => [
                            styles.monthChip,
                            {
                              backgroundColor: isCurrentViewMonth
                                ? colors.primary
                                : pressed
                                ? colors.surfaceElevated
                                : colors.background,
                              borderColor: isCurrentViewMonth ? colors.primary : colors.border,
                            },
                          ]}
                        >
                          <Text style={{
                            fontSize: 13,
                            fontWeight: isCurrentViewMonth ? '700' : '500',
                            color: isCurrentViewMonth ? colors.primaryFg : colors.textPrimary,
                          }}>
                            {name}
                          </Text>
                        </Pressable>
                      );
                    })}
                  </View>
                </View>
              ) : (
                /* ── Calendar grid ── */
                <>
                  {/* Day names header */}
                  <View style={styles.dayNamesRow}>
                    {DAY_NAMES.map((name) => (
                      <View key={name} style={styles.dayNameCell}>
                        <Text style={{ color: colors.textTertiary, fontSize: 11, fontWeight: '600' }}>
                          {name}
                        </Text>
                      </View>
                    ))}
                  </View>

                  {grid.map((row, rowIdx) => (
                    <View key={rowIdx} style={styles.gridRow}>
                      {row.map((cell, colIdx) => {
                        const selected = isSelected(cell.year, cell.month, cell.day);
                        const todayCell = isToday(cell.year, cell.month, cell.day);
                        const disabled = isDisabled(cell.year, cell.month, cell.day);

                        let bgColor: string | undefined;
                        if (selected) bgColor = colors.accent;
                        else if (todayCell) bgColor = colors.surfaceElevated;

                        let textColor = colors.textPrimary;
                        if (selected) textColor = '#FFFFFF';
                        else if (!cell.isCurrentMonth) textColor = colors.textTertiary;
                        else if (disabled) textColor = colors.textTertiary;

                        return (
                          <Pressable
                            key={colIdx}
                            style={styles.dayCell}
                            onPress={() => handleDayPress(cell)}
                            disabled={disabled}
                          >
                            <View
                              style={[
                                styles.dayCellInner,
                                bgColor ? { backgroundColor: bgColor } : undefined,
                              ]}
                            >
                              <Text
                                style={{
                                  fontSize: 14,
                                  color: textColor,
                                  fontWeight: selected ? '700' : '400',
                                  opacity: !cell.isCurrentMonth ? 0.4 : disabled ? 0.3 : 1,
                                }}
                              >
                                {cell.day}
                              </Text>
                              {todayCell && !selected && <View style={styles.todayDot} />}
                            </View>
                          </Pressable>
                        );
                      })}
                    </View>
                  ))}
                </>
              )}

              {/* Footer */}
              <View style={styles.footer}>
                <Pressable onPress={handleClear} style={({ pressed }) => ({ opacity: pressed ? 0.5 : 1 })}>
                  <Text style={{ color: colors.textTertiary, fontSize: 14, fontWeight: '500' }}>
                    Clear
                  </Text>
                </Pressable>
                <Pressable
                  style={({ pressed }) => [styles.doneButton, { opacity: pressed ? 0.8 : 1 }]}
                  onPress={handleDone}
                >
                  <Text style={{ color: '#FFFFFF', fontWeight: '600', fontSize: 15 }}>
                    Done
                  </Text>
                </Pressable>
              </View>
            </Pressable>
          </Animated.View>
        </Pressable>
      </Modal>
    </View>
  );
}

export default DatePickerSheet;
