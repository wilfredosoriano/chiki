/**
 * Edit Loan modal — update an existing loan's details.
 * Same form as Add Loan but pre-filled from the existing record.
 */
import { useState, useMemo, useEffect } from 'react';
import {
  View, ScrollView, TouchableOpacity, TextInput, StyleSheet,
  Alert, KeyboardAvoidingView, Platform, ActivityIndicator,
} from 'react-native';
import { Text } from '@/components/ui/Text';
import { DatePickerSheet } from '@/components/ui/DatePickerSheet';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { format } from '@/utils/dateUtils';
import { useTheme } from '@/hooks/useTheme';
import { getDatabase } from '@/db/database';
import { getLoanById, updateLoan } from '@/db/loanQueries';
import type { Loan } from '@/types';

const PRESET_COLORS = ['#991B1B', '#92400E', '#78350F', '#374151', '#4C1D95', '#881337'];
const DUE_DAYS = [1, 5, 10, 15, 20, 25, 28];

// ─── Amortization helpers (same as add-loan) ─────────────────────────────────

function calcMonthlyPayment(
  principal: number,
  ratePct: number,
  termMonths: number,
  isMonthly: boolean,
  addOn: boolean,
): number {
  if (termMonths <= 0) return 0;
  const r = isMonthly ? ratePct / 100 : ratePct / 100 / 12;
  if (r === 0) return principal / termMonths;
  if (addOn) return (principal + principal * r * termMonths) / termMonths;
  const factor = Math.pow(1 + r, termMonths);
  return (principal * r * factor) / (factor - 1);
}

function calcMonthsRemaining(
  remaining: number,
  monthly: number,
  ratePct: number,
  isMonthly: boolean,
  addOn: boolean,
): number | null {
  if (monthly <= 0 || remaining <= 0) return null;
  const r = isMonthly ? ratePct / 100 : ratePct / 100 / 12;
  if (r === 0 || addOn) return Math.ceil(remaining / monthly);
  const inner = 1 - (remaining * r) / monthly;
  if (inner <= 0) return null;
  return Math.ceil(-Math.log(inner) / Math.log(1 + r));
}

function calcRemainingAfterPayments(
  principal: number,
  ratePct: number,
  termMonths: number,
  monthsPaid: number,
  isMonthly: boolean,
  addOn: boolean,
): number {
  if (monthsPaid >= termMonths) return 0;
  if (monthsPaid <= 0) return principal;
  const r = isMonthly ? ratePct / 100 : ratePct / 100 / 12;
  const monthsLeft = termMonths - monthsPaid;
  if (addOn || r === 0) {
    // For add-on: total cash remaining = rounded_monthly × months_left
    const exactMonthly = r > 0
      ? (principal + principal * r * termMonths) / termMonths
      : principal / termMonths;
    return Math.max(0, Math.round(exactMonthly * 100) / 100 * monthsLeft);
  }
  // Reducing balance: remaining principal (interest accrues on outstanding balance only)
  const pow_n = Math.pow(1 + r, termMonths);
  const pow_k = Math.pow(1 + r, monthsPaid);
  return Math.max(0, principal * (pow_n - pow_k) / (pow_n - 1));
}

function fmt(n: number) {
  return n.toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export default function EditLoanScreen() {
  const { colors, typography, spacing, radius } = useTheme();
  const insets = useSafeAreaInsets();
  const { id } = useLocalSearchParams<{ id: string }>();

  const [loading, setLoading] = useState(true);
  const [originalLoan, setOriginalLoan] = useState<Loan | null>(null);

  // Form fields
  const [name, setName] = useState('');
  const [lender, setLender] = useState('');
  const [principal, setPrincipal] = useState('');
  const [remaining, setRemaining] = useState('');
  const [monthlyPayment, setMonthlyPayment] = useState('');
  const [interestRate, setInterestRate] = useState('');
  const [rateIsMonthly, setRateIsMonthly] = useState(true);
  const [addOn, setAddOn] = useState(true);
  const [dueDayOfMonth, setDueDayOfMonth] = useState(15);
  const [dueDayInput, setDueDayInput] = useState('');
  const [termMonths, setTermMonths] = useState('');
  const [monthsPaid, setMonthsPaid] = useState('');
  const [isRecurring, setIsRecurring] = useState(true);
  const [startDate, setStartDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [endDate, setEndDate] = useState('');
  const [selectedColor, setSelectedColor] = useState(PRESET_COLORS[0]);
  const [saving, setSaving] = useState(false);

  // Load existing loan and pre-fill
  useEffect(() => {
    if (!id) { router.back(); return; }
    (async () => {
      try {
        const db   = await getDatabase();
        const loan = await getLoanById(db, id);
        if (!loan) { Alert.alert('Not found', 'Loan not found.'); router.back(); return; }
        setOriginalLoan(loan);

        setName(loan.name);
        setLender(loan.lender ?? '');
        setPrincipal(String(loan.principalAmount));
        setRemaining(String(loan.remainingBalance));
        setMonthlyPayment(String(loan.monthlyPayment));
        setInterestRate(loan.interestRatePA != null ? String(loan.interestRatePA) : '');
        setDueDayOfMonth(loan.dueDayOfMonth);
        setIsRecurring(loan.isRecurring);
        setStartDate(loan.startDate);
        setEndDate(loan.endDate ?? '');
        setSelectedColor(PRESET_COLORS.includes(loan.color) ? loan.color : PRESET_COLORS[0]);
      } catch (e) {
        Alert.alert('Error', 'Could not load loan.');
        router.back();
      } finally {
        setLoading(false);
      }
    })();
  }, [id]);

  // ── Live amortization summary ────────────────────────────────────────────
  const amortSummary = useMemo(() => {
    const p   = parseFloat(principal.replace(/,/g, ''));
    const m   = parseFloat(monthlyPayment.replace(/,/g, ''));
    const r   = parseFloat(interestRate) || 0;
    const rem = remaining.trim() ? parseFloat(remaining.replace(/,/g, '')) : p;

    if (!p || p <= 0) return null;

    const n = parseInt(termMonths, 10);

    let months: number | null = null;
    if (n > 0) {
      months = n;
    } else if (m > 0) {
      months = calcMonthsRemaining(rem > 0 ? rem : p, m, r, rateIsMonthly, addOn);
    }

    const suggestedExact = n > 0 ? calcMonthlyPayment(p, r, n, rateIsMonthly, addOn) : null;
    const suggested = suggestedExact !== null
      ? Math.round(suggestedExact * 100) / 100
      : null;

    const effectiveMonthly = m > 0 ? Math.round(m * 100) / 100 : suggested;

    let lastPayment: number | null = null;
    let totalPaid: number | null = null;

    if (effectiveMonthly !== null && months !== null && months > 0) {
      const round2    = (x: number) => Math.round(x * 100) / 100;
      const sumFirst  = round2(round2(effectiveMonthly) * (months - 1));
      const totalBase = round2(round2(effectiveMonthly) * months);
      const last      = round2(totalBase - sumFirst);

      if (months > 1 && Math.abs(last - round2(effectiveMonthly)) >= 0.01) {
        lastPayment = last;
        totalPaid   = round2(sumFirst + last);
      } else {
        totalPaid = totalBase;
      }
    }

    const totalInterest = totalPaid !== null
      ? Math.round((totalPaid - p) * 100) / 100
      : null;

    // Suggested remaining balance based on months already paid
    const k = parseInt(monthsPaid, 10);
    const suggestedRemaining = (n > 0 && k > 0 && p > 0)
      ? Math.round(calcRemainingAfterPayments(p, r, n, k, rateIsMonthly, addOn) * 100) / 100
      : null;

    // totalPayable = rounded_monthly × term (for add-on loans with known term)
    // This is what the progress bar uses as denominator
    const suggestedTotalPayable = (n > 0 && addOn)
      ? (() => {
          const roundedMonthly = suggested ?? (m > 0 ? Math.round(m * 100) / 100 : null);
          return roundedMonthly != null ? Math.round(roundedMonthly * n * 100) / 100 : null;
        })()
      : null;

    return { months, totalPaid, totalInterest, suggested, lastPayment, hasRate: r > 0, suggestedRemaining, suggestedTotalPayable };
  }, [principal, monthlyPayment, interestRate, rateIsMonthly, addOn, remaining, termMonths, monthsPaid]);

  async function handleSave() {
    if (!originalLoan) return;

    if (!name.trim()) { Alert.alert('Missing name', 'Please enter a loan name.'); return; }

    const parsedPrincipal = parseFloat(principal.replace(/,/g, ''));
    if (isNaN(parsedPrincipal) || parsedPrincipal <= 0) {
      Alert.alert('Invalid amount', 'Please enter the original loan amount.'); return;
    }
    const parsedMonthly = parseFloat(monthlyPayment.replace(/,/g, ''));
    if (isNaN(parsedMonthly) || parsedMonthly <= 0) {
      Alert.alert('Invalid payment', 'Please enter the monthly payment amount.'); return;
    }
    const parsedRemaining = remaining.trim()
      ? parseFloat(remaining.replace(/,/g, ''))
      : parsedPrincipal;
    if (isNaN(parsedRemaining) || parsedRemaining < 0) {
      Alert.alert('Invalid balance', 'Remaining balance cannot be negative.'); return;
    }
    const parsedRate = interestRate.trim() ? parseFloat(interestRate) : undefined;

    // Store total_payable when we have enough info (add-on + term known)
    // This lets the progress bar use the correct denominator later
    const computedTotalPayable = amortSummary?.suggestedTotalPayable ?? undefined;

    setSaving(true);
    try {
      const db = await getDatabase();
      const updated: Loan = {
        ...originalLoan,
        name: name.trim(),
        lender: lender.trim() || undefined,
        principalAmount: parsedPrincipal,
        remainingBalance: parsedRemaining,
        totalPayable: computedTotalPayable,
        interestRatePA: parsedRate,
        monthlyPayment: parsedMonthly,
        dueDayOfMonth,
        isRecurring,
        startDate,
        endDate: endDate.trim() || undefined,
        color: selectedColor,
        isActive: parsedRemaining > 0,
      };
      await updateLoan(db, updated);
      router.back();
    } catch (e: unknown) {
      Alert.alert('Error saving changes', e instanceof Error ? e.message : String(e));
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.background, alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
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
          Edit Loan
        </Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ padding: spacing.lg, gap: spacing.lg, paddingBottom: insets.bottom + 32 }}
        keyboardShouldPersistTaps="handled"
      >
        {/* Loan name */}
        <View style={{ gap: spacing.xs }}>
          <Text style={[styles.label, { color: colors.textSecondary }]}>Loan Name *</Text>
          <TextInput
            value={name}
            onChangeText={setName}
            placeholder="e.g. BDO Personal Loan, Car Loan"
            placeholderTextColor={colors.textTertiary}
            style={[styles.input, {
              backgroundColor: colors.surface, borderColor: colors.border,
              color: colors.textPrimary, borderRadius: radius.md, fontSize: typography.sizes.base,
              fontFamily: 'Montserrat_400Regular',
            }]}
          />
        </View>

        {/* Lender */}
        <View style={{ gap: spacing.xs }}>
          <View style={styles.labelRow}>
            <Text style={[styles.label, { color: colors.textSecondary }]}>Lender / Bank</Text>
            <View style={[styles.optionalBadge, { backgroundColor: colors.surfaceSecondary }]}>
              <Text style={{ color: colors.textTertiary, fontSize: 10, fontWeight: '600' }}>OPTIONAL</Text>
            </View>
          </View>
          <TextInput
            value={lender}
            onChangeText={setLender}
            placeholder="e.g. BDO, Metrobank, SSS"
            placeholderTextColor={colors.textTertiary}
            style={[styles.input, {
              backgroundColor: colors.surface, borderColor: colors.border,
              color: colors.textPrimary, borderRadius: radius.md, fontSize: typography.sizes.base,
              fontFamily: 'Montserrat_400Regular',
            }]}
          />
        </View>

        {/* Principal */}
        <View style={{ gap: spacing.xs }}>
          <Text style={[styles.label, { color: colors.textSecondary }]}>Original Loan Amount *</Text>
          <View style={[styles.amountRow, {
            backgroundColor: colors.surface, borderColor: colors.border, borderRadius: radius.md,
          }]}>
            <Text style={{ color: selectedColor, fontSize: 24, fontWeight: '800' }}>₱</Text>
            <TextInput
              value={principal}
              onChangeText={setPrincipal}
              placeholder="0.00"
              placeholderTextColor={colors.textTertiary}
              keyboardType="decimal-pad"
              style={{ flex: 1, color: colors.textPrimary, fontSize: 24, fontWeight: '800', fontFamily: 'Montserrat_800ExtraBold', marginLeft: spacing.sm }}
            />
          </View>
        </View>

        {/* Remaining balance */}
        <View style={{ gap: spacing.xs }}>
          <View style={styles.labelRow}>
            <Text style={[styles.label, { color: colors.textSecondary }]}>Remaining Balance</Text>
            <View style={[styles.optionalBadge, { backgroundColor: colors.surfaceSecondary }]}>
              <Text style={{ color: colors.textTertiary, fontSize: 10, fontWeight: '600' }}>CURRENT OUTSTANDING AMOUNT</Text>
            </View>
          </View>
          <View style={[styles.amountRow, {
            backgroundColor: colors.surface, borderColor: colors.border, borderRadius: radius.md,
          }]}>
            <Text style={{ color: colors.textTertiary, fontSize: 20, fontWeight: '700' }}>₱</Text>
            <TextInput
              value={remaining}
              onChangeText={setRemaining}
              placeholder={principal || '0.00'}
              placeholderTextColor={colors.textTertiary}
              keyboardType="decimal-pad"
              style={{ flex: 1, color: colors.textPrimary, fontSize: 20, fontWeight: '700', fontFamily: 'Montserrat_700Bold', marginLeft: spacing.sm }}
            />
          </View>

          {/* ── Months-paid helper ── */}
          <View style={[styles.monthsPaidRow, {
            backgroundColor: colors.surfaceElevated,
            borderRadius: radius.md,
            borderColor: colors.border,
          }]}>
            <Ionicons name="time-outline" size={15} color={colors.textTertiary} style={{ marginTop: 1 }} />
            <Text style={{ color: colors.textSecondary, fontSize: 13, flex: 1 }}>Already paid</Text>
            <View style={[styles.monthsPaidInput, {
              backgroundColor: colors.surface, borderColor: colors.border, borderRadius: radius.sm,
            }]}>
              <TextInput
                value={monthsPaid}
                onChangeText={(v) => setMonthsPaid(v.replace(/[^0-9]/g, ''))}
                placeholder="0"
                placeholderTextColor={colors.textTertiary}
                keyboardType="number-pad"
                style={{ color: colors.textPrimary, fontSize: 13, fontWeight: '600', minWidth: 32, textAlign: 'center', fontFamily: 'Montserrat_600SemiBold' }}
              />
            </View>
            <Text style={{ color: colors.textSecondary, fontSize: 13 }}>months</Text>
          </View>

          {amortSummary?.suggestedRemaining != null && (
            <TouchableOpacity
              onPress={() => setRemaining(fmt(amortSummary.suggestedRemaining!))}
              style={[styles.useRemainingBtn, {
                backgroundColor: colors.primary,
                borderRadius: radius.md,
                flexDirection: 'row',
                alignItems: 'center',
                gap: 6,
                paddingVertical: 10,
                paddingHorizontal: 14,
              }]}
            >
              <Ionicons name="checkmark-circle-outline" size={14} color={colors.primaryFg} />
              <Text style={{ color: colors.primaryFg, fontWeight: '700', fontSize: 13 }}>
                Use ₱{fmt(amortSummary.suggestedRemaining)} as remaining balance
              </Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Monthly payment */}
        <View style={{ gap: spacing.xs }}>
          <Text style={[styles.label, { color: colors.textSecondary }]}>Monthly Payment *</Text>
          <View style={[styles.amountRow, {
            backgroundColor: colors.surface, borderColor: colors.border, borderRadius: radius.md,
          }]}>
            <Text style={{ color: selectedColor, fontSize: 24, fontWeight: '800' }}>₱</Text>
            <TextInput
              value={monthlyPayment}
              onChangeText={setMonthlyPayment}
              placeholder="0.00"
              placeholderTextColor={colors.textTertiary}
              keyboardType="decimal-pad"
              style={{ flex: 1, color: colors.textPrimary, fontSize: 24, fontWeight: '800', fontFamily: 'Montserrat_800ExtraBold', marginLeft: spacing.sm }}
            />
          </View>
        </View>

        {/* Interest rate */}
        <View style={{ gap: spacing.xs }}>
          <View style={styles.labelRow}>
            <Text style={[styles.label, { color: colors.textSecondary }]}>Interest Rate</Text>
            <View style={[styles.optionalBadge, { backgroundColor: colors.surfaceSecondary }]}>
              <Text style={{ color: colors.textTertiary, fontSize: 10, fontWeight: '600' }}>OPTIONAL</Text>
            </View>
          </View>
          <View style={{ flexDirection: 'row', gap: spacing.sm }}>
            <View style={[styles.inputIconRow, {
              flex: 1, backgroundColor: colors.surface, borderColor: colors.border, borderRadius: radius.md,
            }]}>
              <TextInput
                value={interestRate}
                onChangeText={setInterestRate}
                placeholder="e.g. 4.95"
                placeholderTextColor={colors.textTertiary}
                keyboardType="decimal-pad"
                style={{ flex: 1, color: colors.textPrimary, fontSize: typography.sizes.base, fontFamily: 'Montserrat_400Regular' }}
              />
              <Text style={{ color: colors.textTertiary, fontWeight: '700', marginLeft: 4 }}>%</Text>
            </View>
            <View style={[styles.rateToggle, { backgroundColor: colors.surfaceElevated, borderColor: colors.border, borderRadius: radius.md }]}>
              {(['monthly', 'annual'] as const).map((opt) => {
                const active = (opt === 'monthly') === rateIsMonthly;
                return (
                  <TouchableOpacity
                    key={opt}
                    onPress={() => setRateIsMonthly(opt === 'monthly')}
                    style={[styles.rateToggleBtn, { backgroundColor: active ? colors.primary : 'transparent', borderRadius: radius.sm }]}
                  >
                    <Text style={{ fontSize: 11, fontWeight: '700', color: active ? colors.primaryFg : colors.textSecondary }}>
                      {opt === 'monthly' ? '/mo' : '/yr'}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>
          <View style={[styles.toggleRow, {
            backgroundColor: colors.surfaceElevated, borderColor: colors.border, borderRadius: radius.md, marginTop: 2,
          }]}>
            {([
              { value: true,  label: 'Coop / 5-6 / SSS', sub: 'flat rate' },
              { value: false, label: 'Bank / Mortgage',   sub: 'lower total' },
            ] as const).map((opt) => {
              const active = addOn === opt.value;
              return (
                <TouchableOpacity
                  key={String(opt.value)}
                  onPress={() => setAddOn(opt.value)}
                  style={[styles.toggleBtn, { backgroundColor: active ? colors.primary : 'transparent', borderRadius: radius.sm, gap: 1 }]}
                >
                  <Text style={{ color: active ? colors.primaryFg : colors.textSecondary, fontWeight: '700', fontSize: 12 }}>
                    {opt.label}
                  </Text>
                  <Text style={{ color: active ? colors.primaryFg : colors.textTertiary, fontSize: 10, opacity: 0.85 }}>
                    {opt.sub}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        {/* Loan Term + Calculator */}
        <View style={{ gap: spacing.xs }}>
          <View style={styles.labelRow}>
            <Text style={[styles.label, { color: colors.textSecondary }]}>Loan Term (months)</Text>
            <View style={[styles.optionalBadge, { backgroundColor: colors.surfaceSecondary }]}>
              <Text style={{ color: colors.textTertiary, fontSize: 10, fontWeight: '600' }}>OPTIONAL</Text>
            </View>
          </View>
          <View style={{ flexDirection: 'row', gap: spacing.sm }}>
            <View style={[styles.inputIconRow, {
              flex: 1, backgroundColor: colors.surface, borderColor: colors.border, borderRadius: radius.md,
            }]}>
              <TextInput
                value={termMonths}
                onChangeText={setTermMonths}
                placeholder="e.g. 12"
                placeholderTextColor={colors.textTertiary}
                keyboardType="number-pad"
                style={{ flex: 1, color: colors.textPrimary, fontSize: typography.sizes.base, fontFamily: 'Montserrat_400Regular' }}
              />
              <Text style={{ color: colors.textTertiary, fontWeight: '600', marginLeft: 4, fontSize: 12 }}>mos</Text>
            </View>
            {amortSummary?.suggested != null && (
              <TouchableOpacity
                onPress={() => setMonthlyPayment(fmt(amortSummary.suggested!))}
                style={[styles.calcBtn, { backgroundColor: colors.primary, borderRadius: radius.md }]}
              >
                <Ionicons name="calculator-outline" size={14} color={colors.primaryFg} />
                <Text style={{ color: colors.primaryFg, fontWeight: '700', fontSize: 12 }}>
                  Use ₱{fmt(amortSummary.suggested)}
                </Text>
              </TouchableOpacity>
            )}
          </View>
        </View>

        {/* Amortization Summary Card */}
        {amortSummary && (amortSummary.months || amortSummary.totalPaid) && (
          <View style={[styles.summaryCard, { backgroundColor: colors.surfaceElevated, borderRadius: radius.lg, borderColor: colors.border }]}>
            <Text style={{ color: colors.textSecondary, fontSize: 12, fontWeight: '700', letterSpacing: 0.5, marginBottom: spacing.sm }}>
              LOAN BREAKDOWN
            </Text>
            <View style={{ gap: spacing.xs }}>
              {amortSummary.months != null && (
                <View style={styles.summaryRow}>
                  <Text style={{ color: colors.textSecondary, fontSize: 13 }}>Months to payoff</Text>
                  <Text style={{ color: colors.textPrimary, fontSize: 13, fontWeight: '700' }}>{amortSummary.months} months</Text>
                </View>
              )}
              {amortSummary.months != null && (amortSummary.suggested ?? parseFloat(monthlyPayment.replace(/,/g, ''))) > 0 && (
                amortSummary.lastPayment != null ? (
                  <>
                    <View style={styles.summaryRow}>
                      <Text style={{ color: colors.textSecondary, fontSize: 13 }}>Monthly ({amortSummary.months - 1}×)</Text>
                      <Text style={{ color: colors.textPrimary, fontSize: 13, fontWeight: '600' }}>
                        ₱{fmt(amortSummary.suggested ?? parseFloat(monthlyPayment.replace(/,/g, '')))}
                      </Text>
                    </View>
                    <View style={styles.summaryRow}>
                      <Text style={{ color: colors.textSecondary, fontSize: 13 }}>Last payment</Text>
                      <Text style={{ color: colors.textPrimary, fontSize: 13, fontWeight: '600' }}>
                        ₱{fmt(amortSummary.lastPayment)}
                        <Text style={{ color: colors.textTertiary, fontSize: 11 }}> (rounding adj.)</Text>
                      </Text>
                    </View>
                  </>
                ) : (
                  <View style={styles.summaryRow}>
                    <Text style={{ color: colors.textSecondary, fontSize: 13 }}>Monthly payment</Text>
                    <Text style={{ color: colors.textPrimary, fontSize: 13, fontWeight: '600' }}>
                      ₱{fmt(amortSummary.suggested ?? parseFloat(monthlyPayment.replace(/,/g, '')))}
                    </Text>
                  </View>
                )
              )}
              {amortSummary.totalPaid != null && (
                <View style={styles.summaryRow}>
                  <Text style={{ color: colors.textSecondary, fontSize: 13 }}>Total amount paid</Text>
                  <Text style={{ color: colors.textPrimary, fontSize: 13, fontWeight: '700' }}>₱{fmt(amortSummary.totalPaid)}</Text>
                </View>
              )}
              {amortSummary.totalInterest != null && amortSummary.totalInterest > 0 && (
                <>
                  <View style={[styles.summaryDivider, { backgroundColor: colors.border }]} />
                  <View style={styles.summaryRow}>
                    <Text style={{ color: colors.textSecondary, fontSize: 13 }}>Principal</Text>
                    <Text style={{ color: colors.textPrimary, fontSize: 13, fontWeight: '600' }}>₱{fmt(parseFloat(principal.replace(/,/g, '')))}</Text>
                  </View>
                  <View style={styles.summaryRow}>
                    <Text style={{ color: colors.expense, fontSize: 13 }}>Total interest</Text>
                    <Text style={{ color: colors.expense, fontSize: 13, fontWeight: '700' }}>+₱{fmt(amortSummary.totalInterest)}</Text>
                  </View>
                </>
              )}
            </View>
          </View>
        )}

        {/* Due day picker */}
        <View style={{ gap: spacing.sm }}>
          <Text style={[styles.label, { color: colors.textSecondary }]}>Due Day of Month</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ flexGrow: 0 }}>
            <View style={{ flexDirection: 'row', gap: spacing.sm, paddingVertical: 4 }}>
              {DUE_DAYS.map((day) => {
                const selected = dueDayOfMonth === day;
                return (
                  <TouchableOpacity
                    key={day}
                    onPress={() => { setDueDayOfMonth(day); setDueDayInput(''); }}
                    style={[styles.dayChip, {
                      backgroundColor: selected ? selectedColor : colors.surface,
                      borderColor: selected ? selectedColor : colors.border,
                      borderRadius: radius.full,
                    }]}
                  >
                    <Text style={{ color: selected ? '#fff' : colors.textPrimary, fontWeight: '700', fontSize: typography.sizes.sm }}>
                      {day}{['st','nd','rd'][((day % 100) - 20) % 10 - 1] ?? (day % 10 <= 3 && day % 100 > 13 ? ['st','nd','rd'][day%10-1] : 'th')}
                    </Text>
                  </TouchableOpacity>
                );
              })}
              <View style={[styles.dayChip, {
                backgroundColor: !DUE_DAYS.includes(dueDayOfMonth) ? selectedColor : colors.surface,
                borderColor: !DUE_DAYS.includes(dueDayOfMonth) ? selectedColor : colors.border,
                borderRadius: radius.full,
                minWidth: 72,
              }]}>
                <TextInput
                  value={dueDayInput}
                  onFocus={() => setDueDayInput('')}
                  onChangeText={(v) => {
                    if (v === '') { setDueDayInput(''); return; }
                    const digits = v.replace(/[^0-9]/g, '');
                    setDueDayInput(digits);
                    const n = parseInt(digits, 10);
                    if (!isNaN(n) && n >= 1 && n <= 28) setDueDayOfMonth(n);
                  }}
                  onBlur={() => {
                    const n = parseInt(dueDayInput, 10);
                    if (isNaN(n) || n < 1 || n > 28) setDueDayInput('');
                  }}
                  placeholder="Other"
                  placeholderTextColor={!DUE_DAYS.includes(dueDayOfMonth) ? 'rgba(255,255,255,0.7)' : colors.textTertiary}
                  keyboardType="number-pad"
                  style={{
                    color: !DUE_DAYS.includes(dueDayOfMonth) ? '#fff' : colors.textPrimary,
                    fontWeight: '700', fontFamily: 'Montserrat_700Bold',
                    fontSize: typography.sizes.sm, textAlign: 'center', minWidth: 48,
                  }}
                />
              </View>
            </View>
          </ScrollView>
          <Text style={{ color: colors.textTertiary, fontSize: typography.sizes.xs }}>
            Payment is due on the {dueDayOfMonth}{['st','nd','rd'][((dueDayOfMonth%100)-20)%10-1] ?? (dueDayOfMonth%10<=3&&dueDayOfMonth%100>13?['st','nd','rd'][dueDayOfMonth%10-1]:'th')} of every month
          </Text>
        </View>

        {/* Recurring toggle */}
        <View style={{ gap: spacing.xs }}>
          <Text style={[styles.label, { color: colors.textSecondary }]}>Payment Frequency</Text>
          <View style={[styles.toggleRow, { backgroundColor: colors.surfaceSecondary, borderColor: colors.border, borderRadius: radius.md }]}>
            {([
              { value: true,  label: 'Repeats Monthly' },
              { value: false, label: 'One-time' },
            ] as const).map((opt) => (
              <TouchableOpacity
                key={String(opt.value)}
                onPress={() => setIsRecurring(opt.value)}
                style={[styles.toggleBtn, { backgroundColor: isRecurring === opt.value ? selectedColor : 'transparent', borderRadius: radius.sm }]}
              >
                <Text style={{ color: isRecurring === opt.value ? '#fff' : colors.textSecondary, fontWeight: '700', fontSize: typography.sizes.sm }}>
                  {opt.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Start date */}
        <DatePickerSheet
          label="Start Date"
          value={startDate || undefined}
          onChange={(d) => setStartDate(d ?? format(new Date(), 'yyyy-MM-dd'))}
        />

        {/* End date */}
        <DatePickerSheet
          label="Expected End / Payoff Date"
          value={endDate || undefined}
          onChange={(d) => setEndDate(d ?? '')}
          optional
          minDate={startDate || undefined}
        />

        {/* Color picker */}
        <View style={{ gap: spacing.sm }}>
          <Text style={[styles.label, { color: colors.textSecondary }]}>Color</Text>
          <View style={{ flexDirection: 'row', gap: spacing.md }}>
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
                {selectedColor === color && <Ionicons name="checkmark" size={16} color="#fff" />}
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Save */}
        <TouchableOpacity
          style={[styles.saveBtn, { backgroundColor: saving ? colors.border : selectedColor, borderRadius: radius.lg, marginTop: spacing.sm }]}
          onPress={handleSave}
          disabled={saving}
        >
          <Ionicons name="checkmark-circle-outline" size={20} color="#fff" />
          <Text style={{ color: '#fff', fontWeight: '700', fontSize: typography.sizes.base }}>
            {saving ? 'Saving...' : 'Save Changes'}
          </Text>
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  header:       { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingBottom: 12, borderBottomWidth: 1 },
  backBtn:      { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  labelRow:     { flexDirection: 'row', alignItems: 'center', gap: 6 },
  label:        { fontSize: 13, fontWeight: '600' },
  optionalBadge:{ paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 },
  input:        { borderWidth: 1, paddingHorizontal: 14, paddingVertical: 13 },
  amountRow:    { flexDirection: 'row', alignItems: 'center', borderWidth: 1, paddingHorizontal: 16, paddingVertical: 12 },
  inputIconRow: { flexDirection: 'row', alignItems: 'center', borderWidth: 1, paddingHorizontal: 14, paddingVertical: 13 },
  dayChip:      { borderWidth: 1, paddingHorizontal: 14, paddingVertical: 9, alignItems: 'center', justifyContent: 'center' },
  toggleRow:    { flexDirection: 'row', borderWidth: 1, padding: 4, gap: 4 },
  toggleBtn:    { flex: 1, paddingVertical: 10, alignItems: 'center' },
  colorDot:     { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  saveBtn:      { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 16 },
  calcBtn:      { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 12, paddingVertical: 0, alignSelf: 'stretch', justifyContent: 'center' },
  rateToggle:   { flexDirection: 'row', borderWidth: 1, padding: 3, gap: 2, alignSelf: 'stretch' },
  rateToggleBtn:{ paddingHorizontal: 10, paddingVertical: 6, alignItems: 'center', justifyContent: 'center' },
  summaryCard:  { borderWidth: 1, padding: 16 },
  summaryRow:   { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  summaryDivider:  { height: 1, marginVertical: 6 },
  monthsPaidRow:   { flexDirection: 'row', alignItems: 'center', gap: 8, borderWidth: 1, paddingHorizontal: 12, paddingVertical: 10 },
  monthsPaidInput: { borderWidth: 1, paddingHorizontal: 8, paddingVertical: 5 },
  useRemainingBtn: { paddingHorizontal: 10, paddingVertical: 6 },
});
