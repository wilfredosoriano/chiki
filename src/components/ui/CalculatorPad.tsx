/**
 * CalculatorPad — a numeric keypad with basic math operations (+, −, ×, ÷).
 * Controlled component: parent owns the display value string.
 * The parent receives the computed numeric string on every change.
 * The DB never sees an expression — only the resolved number.
 */
import { useState } from 'react';
import { View, TouchableOpacity, StyleSheet } from 'react-native';
import { Text } from '@/components/ui/Text';
import { useTheme } from '@/hooks/useTheme';

export interface CalculatorPadProps {
  /** Current display value — controlled by parent (e.g. '0', '1200', '400.5') */
  value: string;
  /** Called on every digit/operation change with the new display string */
  onChange: (v: string) => void;
  /** Tint color for operator buttons and the = key (defaults to theme primary) */
  accentColor?: string;
}

type Op = '+' | '-' | '×' | '÷';

const BTN_H = 54;

// ── internal button ────────────────────────────────────────────────────────────
interface BtnProps {
  label: string;
  onPress: () => void;
  variant?: 'number' | 'op' | 'equals' | 'action';
  flex?: number;
  accent: string;
  surface: string;
  surfaceSecondary: string;
  textPrimary: string;
  textSecondary: string;
  expense: string;
  borderRadius: number;
}

function CalcBtn({
  label, onPress, variant = 'number', flex = 1,
  accent, surface, surfaceSecondary, textPrimary, textSecondary, expense, borderRadius,
}: BtnProps) {
  const bg =
    variant === 'equals'  ? accent :
    variant === 'op'      ? accent + '22' :
    variant === 'action'  ? surfaceSecondary :
                            surface;

  const fg =
    variant === 'equals'  ? '#fff' :
    variant === 'op'      ? accent :
    variant === 'action'  ? (label === 'AC' ? expense : textSecondary) :
                            textPrimary;

  return (
    <TouchableOpacity
      activeOpacity={0.65}
      onPress={onPress}
      style={[styles.btn, { flex, backgroundColor: bg, borderRadius }]}
    >
      <Text style={[styles.btnTxt, { color: fg, fontWeight: variant === 'number' ? '500' : '700' }]}>
        {label}
      </Text>
    </TouchableOpacity>
  );
}

// ── main pad ───────────────────────────────────────────────────────────────────
export function CalculatorPad({ value, onChange, accentColor }: CalculatorPadProps) {
  const { colors, radius } = useTheme();
  const accent = accentColor ?? colors.primary;

  // Internal calculator state — not exposed to parent
  const [storedValue, setStoredValue]           = useState<number | null>(null);
  const [pendingOp, setPendingOp]               = useState<Op | null>(null);
  const [waitingForOperand, setWaitingForOperand] = useState(false);
  const [expression, setExpression]             = useState('');

  // ── maths ──────────────────────────────────────────────────────────────────
  function compute(a: number, b: number, op: Op): number {
    if (op === '+') return a + b;
    if (op === '-') return a - b;
    if (op === '×') return a * b;
    if (op === '÷') return b === 0 ? 0 : a / b;
    return b;
  }

  function fmt(n: number): string {
    const rounded = Math.round(n * 100) / 100;
    return Number.isInteger(rounded) ? String(rounded) : String(rounded);
  }

  // ── handlers ───────────────────────────────────────────────────────────────
  function handleDigit(d: string) {
    // Prevent duplicate decimal point
    if (d === '.' && !waitingForOperand && value.includes('.')) return;

    if (waitingForOperand) {
      onChange(d === '.' ? '0.' : d === '0' ? '0' : d);
      setWaitingForOperand(false);
      return;
    }

    if (value === '0' || value === '') {
      onChange(d === '.' ? '0.' : d);
    } else {
      if (value.replace('.', '').length >= 10) return; // cap at 10 significant digits
      onChange(value + d);
    }
  }

  function handleDoubleZero() {
    if (waitingForOperand) { onChange('0'); setWaitingForOperand(false); return; }
    if (value === '0' || value === '') return;
    if (value.replace('.', '').length >= 10) return;
    onChange(value + '00');
  }

  function handleOperator(op: Op) {
    const cur = parseFloat(value) || 0;

    if (storedValue !== null && pendingOp && !waitingForOperand) {
      // Chain operations: resolve pending first
      const result = compute(storedValue, cur, pendingOp);
      const s = fmt(result);
      onChange(s);
      setStoredValue(result);
      setExpression(`${s} ${op}`);
    } else {
      setStoredValue(cur);
      setExpression(`${value} ${op}`);
    }

    setPendingOp(op);
    setWaitingForOperand(true);
  }

  function handleEquals() {
    if (storedValue === null || pendingOp === null) return;
    const cur = parseFloat(value) || 0;
    const result = compute(storedValue, cur, pendingOp);
    onChange(fmt(result));
    setStoredValue(null);
    setPendingOp(null);
    setWaitingForOperand(false);
    setExpression('');
  }

  function handleClear() {
    onChange('0');
    setStoredValue(null);
    setPendingOp(null);
    setWaitingForOperand(false);
    setExpression('');
  }

  function handleBackspace() {
    if (waitingForOperand) return;
    onChange(value.length <= 1 ? '0' : value.slice(0, -1));
  }

  // ── shared props for CalcBtn ───────────────────────────────────────────────
  const btnProps = {
    accent,
    surface: colors.surface,
    surfaceSecondary: colors.surfaceSecondary,
    textPrimary: colors.textPrimary,
    textSecondary: colors.textSecondary,
    expense: colors.expense,
    borderRadius: radius.md,
  };

  return (
    <View style={[styles.pad, { backgroundColor: colors.background, borderTopColor: colors.border }]}>
      {/* Small expression hint above the pad, e.g. "1200 ÷" */}
      {!!expression && (
        <Text style={[styles.expr, { color: colors.textTertiary }]}>{expression}</Text>
      )}

      {/* Row 1 */}
      <View style={styles.row}>
        <CalcBtn label="AC" onPress={handleClear}               variant="action" {...btnProps} />
        <CalcBtn label="⌫"  onPress={handleBackspace}           variant="action" {...btnProps} />
        <CalcBtn label="÷"  onPress={() => handleOperator('÷')} variant="op"     {...btnProps} />
        <CalcBtn label="×"  onPress={() => handleOperator('×')} variant="op"     {...btnProps} />
      </View>

      {/* Row 2 */}
      <View style={styles.row}>
        <CalcBtn label="7" onPress={() => handleDigit('7')} {...btnProps} />
        <CalcBtn label="8" onPress={() => handleDigit('8')} {...btnProps} />
        <CalcBtn label="9" onPress={() => handleDigit('9')} {...btnProps} />
        <CalcBtn label="−" onPress={() => handleOperator('-')} variant="op" {...btnProps} />
      </View>

      {/* Row 3 */}
      <View style={styles.row}>
        <CalcBtn label="4" onPress={() => handleDigit('4')} {...btnProps} />
        <CalcBtn label="5" onPress={() => handleDigit('5')} {...btnProps} />
        <CalcBtn label="6" onPress={() => handleDigit('6')} {...btnProps} />
        <CalcBtn label="+" onPress={() => handleOperator('+')} variant="op" {...btnProps} />
      </View>

      {/* Row 4 */}
      <View style={styles.row}>
        <CalcBtn label="1" onPress={() => handleDigit('1')} {...btnProps} />
        <CalcBtn label="2" onPress={() => handleDigit('2')} {...btnProps} />
        <CalcBtn label="3" onPress={() => handleDigit('3')} {...btnProps} />
        <CalcBtn label="=" onPress={handleEquals} variant="equals" {...btnProps} />
      </View>

      {/* Row 5 — 0 is double-wide */}
      <View style={styles.row}>
        <CalcBtn label="."  onPress={() => handleDigit('.')} {...btnProps} />
        <CalcBtn label="0"  onPress={() => handleDigit('0')} flex={2}     {...btnProps} />
        <CalcBtn label="00" onPress={handleDoubleZero}                     {...btnProps} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  pad: {
    borderTopWidth: 1,
    paddingHorizontal: 8,
    paddingTop: 6,
    paddingBottom: 8,
  },
  expr: {
    fontSize: 12,
    textAlign: 'right',
    paddingRight: 4,
    marginBottom: 2,
  },
  row: {
    flexDirection: 'row',
    gap: 6,
    marginBottom: 6,
  },
  btn: {
    height: BTN_H,
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnTxt: {
    fontSize: 20,
  },
});
