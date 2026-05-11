// ─── Domain Types ────────────────────────────────────────────────────────────

export type AccountType = 'cash' | 'debit' | 'savings' | 'investment';

export interface Account {
  id: string;
  name: string;
  type: AccountType;
  balance: number;
  currency: string;
  color: string;
  icon: string;
  includeInNetWorth: boolean;
  // Philippine bank fields
  bankId?: string;           // references PhBank.id
  maskedCardNumber?: string; // last 4 digits only, e.g. "4321"
  sortOrder?: number;        // display order (lower = first)
  createdAt: string;
  updatedAt: string;
}

export type TransactionType = 'income' | 'expense' | 'transfer';

export interface Transaction {
  id: string;
  accountId: string;
  toAccountId?: string; // for transfers
  type: TransactionType;
  amount: number;
  categoryId: string;
  note?: string;
  tags?: string[];
  date: string;
  isRecurring: boolean;
  recurringId?: string;
  createdAt: string;
  updatedAt: string;
}

export interface Category {
  id: string;
  name: string;
  icon: string;
  color: string;
  type: 'income' | 'expense';
  isDefault: boolean;
}

export interface Budget {
  id: string;
  categoryId: string;
  amount: number;
  period: 'monthly' | 'weekly';
  month: number; // 1–12
  year: number;
  createdAt: string;
}

export interface SavingsGoal {
  id: string;
  name: string;
  targetAmount: number;
  currentAmount: number;
  targetDate?: string;
  color: string;
  icon: string;
  createdAt: string;
  updatedAt: string;
}

export type RecurringFrequency = 'daily' | 'weekly' | 'biweekly' | 'monthly' | 'yearly';

export interface RecurringTransaction {
  id: string;
  accountId: string;
  type: TransactionType;
  amount: number;
  categoryId: string;
  note?: string;
  frequency: RecurringFrequency;
  nextDueDate: string;
  isActive: boolean;
  createdAt: string;
}

export interface Loan {
  id: string;
  name: string;           // e.g. "BDO Personal Loan", "Car Loan"
  lender?: string;        // optional lender / bank name
  principalAmount: number; // original loan amount
  remainingBalance: number; // current outstanding balance
  totalPayable?: number;       // total cash to pay incl. interest; used for progress bar
  interestRatePA?: number; // annual interest rate %
  monthlyPayment: number;  // fixed monthly amortisation
  dueDayOfMonth: number;   // 1–28: day each payment is due
  isRecurring: boolean;    // true = repeats every month
  startDate: string;       // YYYY-MM-DD
  endDate?: string;        // YYYY-MM-DD expected payoff date
  color: string;
  isActive: boolean;       // false once fully paid
  createdAt: string;
  updatedAt: string;
}

// ─── Subscription Types ───────────────────────────────────────────────────────

export type EntitlementId = 'premium';

export interface SubscriptionStatus {
  isPremium: boolean;
  isLoading: boolean;
  expiresAt?: string;
}
