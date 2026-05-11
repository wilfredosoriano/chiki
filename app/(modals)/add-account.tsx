/**
 * Add Account modal — lets users add a debit card from any Philippine bank
 * or a cash/savings/investment account.
 */
import { useState, useMemo } from 'react';
import {
  View, ScrollView, TouchableOpacity, TextInput, StyleSheet,
  Alert, KeyboardAvoidingView, Platform,
} from 'react-native';
import { Text } from '@/components/ui/Text';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@/hooks/useTheme';
import { useAccountStore } from '@/stores/accountStore';
import { useTransactionStore } from '@/stores/transactionStore';
import { useSubscriptionStore } from '@/stores/subscriptionStore';
import { getDatabase } from '@/db/database';
import { insertAccount } from '@/db/accountQueries';
import { insertTransaction } from '@/db/transactionQueries';
import { PHILIPPINE_BANKS } from '@/constants/philippineBanks';
import { FREE_TIER_LIMITS } from '@/constants';
import { PhysicalCard } from '@/components/ui/PhysicalCard';
import type { Account, AccountType, Transaction } from '@/types';

const ACCOUNT_TYPES: Array<{ type: AccountType; label: string; icon: keyof typeof Ionicons.glyphMap; description: string }> = [
  { type: 'debit',      label: 'Debit Card',  icon: 'card-outline',        description: 'ATM / debit card from a Philippine bank' },
  { type: 'cash',       label: 'Cash',        icon: 'cash-outline',         description: 'Physical cash on hand' },
  { type: 'savings',    label: 'Savings',     icon: 'wallet-outline',       description: 'Savings account without a card' },
  { type: 'investment', label: 'Investment',  icon: 'trending-up-outline',  description: 'Stocks, funds, crypto, etc.' },
];

const BANK_TYPES = ['All', 'Universal', 'Commercial', 'Thrift', 'Digital'] as const;

function generateId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

export default function AddAccountScreen() {
  const { colors, typography, spacing, radius } = useTheme();
  const insets = useSafeAreaInsets();
  const { addAccount } = useAccountStore();
  const { addTransaction } = useTransactionStore();

  // Step state
  const [step, setStep] = useState<'type' | 'bank' | 'details'>('type');
  const [selectedType, setSelectedType] = useState<AccountType | null>(null);
  const [selectedBankId, setSelectedBankId] = useState<string | null>(null);
  const [bankFilter, setBankFilter] = useState<string>('All');
  const [bankSearch, setBankSearch] = useState('');

  // Details form
  const [accountName, setAccountName] = useState('');
  const [balance, setBalance] = useState('');
  const [saving, setSaving] = useState(false);

  const selectedBank = PHILIPPINE_BANKS.find((b) => b.id === selectedBankId);

  const filteredBanks = useMemo(() => {
    return PHILIPPINE_BANKS.filter((b) => {
      const matchesFilter = bankFilter === 'All' || b.type === bankFilter.toLowerCase();
      const matchesSearch = b.name.toLowerCase().includes(bankSearch.toLowerCase()) ||
        b.shortName.toLowerCase().includes(bankSearch.toLowerCase());
      return matchesFilter && matchesSearch;
    });
  }, [bankFilter, bankSearch]);

  function handleTypeSelect(type: AccountType) {
    setSelectedType(type);
    if (type === 'debit' || type === 'savings') {
      setStep('bank');
    } else {
      setStep('details');
    }
  }

  function handleBankSelect(bankId: string) {
    setSelectedBankId(bankId);
    const bank = PHILIPPINE_BANKS.find((b) => b.id === bankId);
    if (bank) setAccountName(bank.shortName);
    setStep('details');
  }

  async function handleSave() {
    const { isPremium } = useSubscriptionStore.getState();
    const { accounts } = useAccountStore.getState();
    if (!isPremium && accounts.length >= FREE_TIER_LIMITS.MAX_ACCOUNTS) {
      Alert.alert(
        'Account limit reached',
        `Free plan includes up to ${FREE_TIER_LIMITS.MAX_ACCOUNTS} accounts. Upgrade to Premium for unlimited accounts.`,
        [
          { text: 'Not now', style: 'cancel' },
          { text: 'Upgrade', onPress: () => router.push('/(modals)/paywall') },
        ]
      );
      return;
    }

    if (!accountName.trim()) {
      Alert.alert('Missing name', 'Please enter an account name.');
      return;
    }
    const rawBalance = balance.replace(/,/g, '').trim();
    const parsedBalance = rawBalance === '' ? 0 : parseFloat(rawBalance);
    if (isNaN(parsedBalance)) {
      Alert.alert('Invalid balance', 'Please enter a valid starting balance.');
      return;
    }


    setSaving(true);
    try {
      const now = new Date().toISOString();
      const account: Account = {
        id: generateId(),
        name: accountName.trim(),
        type: selectedType!,
        balance: parsedBalance,
        currency: 'PHP',
        color: selectedBank?.color ?? '#5F6266',
        icon: selectedType === 'debit' ? 'card-outline' : selectedType === 'cash' ? 'cash-outline' : selectedType === 'savings' ? 'wallet-outline' : 'trending-up-outline',
        includeInNetWorth: true,
        bankId: selectedBankId ?? undefined,
        maskedCardNumber: undefined,
        createdAt: now,
        updatedAt: now,
      };

      const db = await getDatabase();
      await insertAccount(db, account);
      addAccount(account);

      if (parsedBalance > 0) {
        // Use local date to avoid UTC timezone shifting the date
        const d = new Date();
        const localDate = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
        const tx: Transaction = {
          id: generateId(),
          accountId: account.id,
          type: 'income',
          amount: parsedBalance,
          categoryId: 'cat_other_income',
          note: 'Initial Balance',
          date: localDate,
          isRecurring: false,
          createdAt: now,
          updatedAt: now,
        };
        await insertTransaction(db, tx);
        addTransaction(tx);
      }

      router.back();
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      console.error('[AddAccount] save failed:', msg);
      Alert.alert('Error saving account', msg);
    } finally {
      setSaving(false);
    }
  }

  function goBack() {
    if (step === 'details' && (selectedType === 'debit' || selectedType === 'savings')) {
      setStep('bank');
    } else if (step === 'bank' || step === 'details') {
      setSelectedType(null);
      setSelectedBankId(null);
      setStep('type');
    } else {
      router.back();
    }
  }

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: colors.background }}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      {/* ── Header ── */}
      <View style={[styles.header, {
        paddingTop: insets.top + spacing.sm,
        paddingHorizontal: spacing.lg,
        borderBottomColor: colors.border,
        backgroundColor: colors.surface,
      }]}>
        <TouchableOpacity onPress={goBack} style={styles.backBtn}>
          <Ionicons name="chevron-back" size={24} color={colors.textPrimary} />
        </TouchableOpacity>
        <Text style={{ color: colors.textPrimary, fontSize: typography.sizes.md, fontWeight: '700' }}>
          {step === 'type' ? 'Add Account' : step === 'bank' ? 'Choose Bank' : 'Account Details'}
        </Text>
        <View style={{ width: 40 }} />
      </View>

      {/* ── Step: Account Type ── */}
      {step === 'type' && (
        <ScrollView contentContainerStyle={{ padding: spacing.lg, gap: spacing.md }}>
          <Text style={{ color: colors.textSecondary, fontSize: typography.sizes.sm, marginBottom: spacing.sm }}>
            What type of account do you want to add?
          </Text>
          {ACCOUNT_TYPES.map((item) => (
            <TouchableOpacity
              key={item.type}
              style={[styles.typeCard, {
                backgroundColor: colors.surface,
                borderColor: colors.border,
                borderRadius: radius.lg,
              }]}
              onPress={() => handleTypeSelect(item.type)}
            >
              <View style={[styles.typeIcon, { backgroundColor: colors.surface, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border }]}>
                <Ionicons name={item.icon} size={26} color={colors.textPrimary} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ color: colors.textPrimary, fontWeight: '700', fontSize: typography.sizes.base }}>
                  {item.label}
                </Text>
                <Text style={{ color: colors.textSecondary, fontSize: typography.sizes.xs, marginTop: 2 }}>
                  {item.description}
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color={colors.textTertiary} />
            </TouchableOpacity>
          ))}
        </ScrollView>
      )}

      {/* ── Step: Bank Picker ── */}
      {step === 'bank' && (
        <View style={{ flex: 1 }}>
          {/* Search */}
          <View style={{ padding: spacing.lg, paddingBottom: spacing.sm }}>
            <View style={[styles.searchBox, {
              backgroundColor: colors.surfaceSecondary,
              borderColor: colors.border,
              borderRadius: radius.lg,
            }]}>
              <Ionicons name="search-outline" size={18} color={colors.textTertiary} />
              <TextInput
                placeholder="Search bank..."
                placeholderTextColor={colors.textTertiary}
                value={bankSearch}
                onChangeText={setBankSearch}
                style={{ flex: 1, color: colors.textPrimary, fontSize: typography.sizes.base, marginLeft: spacing.sm }}
              />
            </View>
          </View>

          {/* Filter tabs */}
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={{ flexGrow: 0 }}
            contentContainerStyle={{ paddingHorizontal: spacing.lg, paddingVertical: spacing.sm, gap: spacing.sm }}
          >
            {BANK_TYPES.map((f) => (
              <TouchableOpacity
                key={f}
                onPress={() => setBankFilter(f)}
                activeOpacity={0.8}
                style={[styles.filterTab, {
                  backgroundColor: bankFilter === f ? colors.primary : colors.surfaceSecondary,
                  borderRadius: radius.full,
                  borderColor: bankFilter === f ? colors.primary : colors.border,
                }]}
              >
                <Text style={{
                  color: bankFilter === f ? colors.primaryFg : colors.textSecondary,
                  fontSize: typography.sizes.sm,
                  fontWeight: '600',
                }}>
                  {f}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>

          {/* Bank list */}
          <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: spacing.lg, paddingTop: spacing.sm, gap: spacing.sm }}>
            {filteredBanks.map((bank) => (
              <TouchableOpacity
                key={bank.id}
                activeOpacity={0.7}
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: 12,
                  backgroundColor: colors.surface,
                  borderColor: colors.border,
                  borderWidth: 1,
                  borderRadius: radius.lg,
                  padding: 12,
                }}
                onPress={() => handleBankSelect(bank.id)}
              >
                {/* Bank initial avatar */}
                <View style={{
                  width: 44,
                  height: 44,
                  borderRadius: 12,
                  backgroundColor: bank.color,
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                }}>
                  <Text style={{ color: '#fff', fontSize: 15, fontWeight: '800', letterSpacing: -0.5 }}>
                    {bank.shortName.slice(0, 2).toUpperCase()}
                  </Text>
                </View>

                {/* Bank info */}
                <View style={{ flex: 1, gap: 2 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                    <Text style={{ color: colors.textPrimary, fontWeight: '700', fontSize: typography.sizes.base, letterSpacing: -0.2 }} numberOfLines={1}>
                      {bank.shortName}
                    </Text>
                    {bank.type === 'digital' && (
                      <View style={{
                        backgroundColor: colors.primaryLight,
                        borderRadius: 4,
                        paddingHorizontal: 5,
                        paddingVertical: 1,
                      }}>
                        <Text style={{ color: colors.primary, fontSize: 9, fontWeight: '700', letterSpacing: 0.3 }}>DIGITAL</Text>
                      </View>
                    )}
                  </View>
                  <Text style={{ color: colors.textTertiary, fontSize: 12 }} numberOfLines={1}>
                    {bank.name}
                  </Text>
                </View>

              </TouchableOpacity>
            ))}

          </ScrollView>
        </View>
      )}

      {/* ── Step: Details Form ── */}
      {step === 'details' && (
        <ScrollView contentContainerStyle={{ padding: spacing.lg, gap: spacing.lg }}>

          {/* Live card preview */}
          <View>
            <PhysicalCard
              account={{
                id: 'preview',
                name: accountName.trim() || (selectedBank?.shortName ?? 'My Account'),
                type: selectedType!,
                balance: parseFloat(balance.replace(/,/g, '')) || 0,
                currency: 'PHP',
                color: selectedBank?.color ?? '#5F6266',
                icon: 'card-outline',
                includeInNetWorth: true,
                bankId: selectedBankId ?? undefined,
                maskedCardNumber: undefined,
                createdAt: '',
                updatedAt: '',
              }}
            />
            {/* Change bank link */}
            {selectedBank && (
              <View style={{ flexDirection: 'row', justifyContent: 'flex-end', marginTop: spacing.sm }}>
                <TouchableOpacity onPress={() => setStep('bank')}>
                  <Text style={{ color: colors.primary, fontSize: typography.sizes.sm, fontWeight: '600' }}>Change Bank</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>

          {/* Account name */}
          <View style={{ gap: spacing.xs }}>
            <Text style={{ color: colors.textSecondary, fontSize: typography.sizes.sm, fontWeight: '600' }}>
              Account Name
            </Text>
            <TextInput
              value={accountName}
              onChangeText={setAccountName}
              placeholder="e.g. BDO Savings, My BPI Card"
              placeholderTextColor={colors.textTertiary}
              style={[styles.input, {
                backgroundColor: colors.surface,
                borderColor: colors.border,
                color: colors.textPrimary,
                borderRadius: radius.md,
                fontSize: typography.sizes.base,
              }]}
            />
          </View>


          {/* Starting balance */}
          <View style={{ gap: spacing.xs }}>
            <Text style={{ color: colors.textSecondary, fontSize: typography.sizes.sm, fontWeight: '600' }}>
              Starting Balance (₱)
            </Text>
            <TextInput
              value={balance}
              onChangeText={setBalance}
              placeholder="0.00"
              placeholderTextColor={colors.textTertiary}
              keyboardType="decimal-pad"
              style={[styles.input, {
                backgroundColor: colors.surface,
                borderColor: colors.border,
                color: colors.textPrimary,
                borderRadius: radius.md,
                fontSize: typography.sizes.base,
              }]}
            />
          </View>


          {/* Save button */}
          <TouchableOpacity
            style={[styles.saveBtn, {
              backgroundColor: saving ? colors.border : colors.primary,
              borderRadius: radius.lg,
              marginTop: spacing.sm,
            }]}
            onPress={handleSave}
            disabled={saving}
          >
            <Ionicons name="checkmark-circle-outline" size={20} color={saving ? colors.textTertiary : colors.primaryFg} />
            <Text style={{ color: saving ? colors.textTertiary : colors.primaryFg, fontWeight: '700', fontSize: typography.sizes.base }}>
              {saving ? 'Saving...' : 'Save Account'}
            </Text>
          </TouchableOpacity>
        </ScrollView>
      )}
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
  typeCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    padding: 16,
    borderWidth: 1,
  },
  typeIcon: { width: 52, height: 52, alignItems: 'center', justifyContent: 'center' },
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderWidth: 1,
  },
  filterTab: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderWidth: 1,
    overflow: 'hidden',   // clips Android ripple to the pill shape
  },
  input: {
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 13,
  },
  saveBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 16,
  },
});
