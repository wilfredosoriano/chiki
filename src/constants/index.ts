export const APP_NAME = 'Chiki';

// RevenueCat entitlement identifier — must match what you set in RevenueCat dashboard
export const PREMIUM_ENTITLEMENT_ID = 'premium';

// Secure storage keys — stored in iOS Keychain / Android Keystore
export const STORAGE_KEYS = {
  DB_ENCRYPTION_KEY: 'bw_db_enc_key',
  BIOMETRIC_ENABLED: 'bw_biometric_enabled',
  LOCK_TIMEOUT_MINUTES: 'bw_lock_timeout',
  ONBOARDING_COMPLETE: 'bw_onboarding_done',
  LAST_ACTIVE_AT: 'bw_last_active',
  CURRENCY: 'PHP',
} as const;

// Default categories seeded on first launch
export const DEFAULT_EXPENSE_CATEGORIES = [
  { id: 'cat_food',          name: '🍽️ Food & Dining',   icon: 'fork-knife',       color: '#F97316' },
  { id: 'cat_transport',     name: '🚌 Transportation',   icon: 'car',              color: '#3B82F6' },
  { id: 'cat_housing',       name: '🏠 Housing & Rent',   icon: 'house',            color: '#8B5CF6' },
  { id: 'cat_health',        name: '💊 Health',           icon: 'heart',            color: '#EF4444' },
  { id: 'cat_shopping',      name: '🛍️ Shopping',         icon: 'bag',              color: '#EC4899' },
  { id: 'cat_entertainment', name: '🎬 Entertainment',    icon: 'film',             color: '#F59E0B' },
  { id: 'cat_education',     name: '📚 Education',        icon: 'graduation-cap',   color: '#10B981' },
  { id: 'cat_loan_payment',  name: '🏦 Loan Payment',     icon: 'credit-card',      color: '#EF4444' },
  { id: 'cat_savings',       name: '🐷 Savings',          icon: 'wallet',           color: '#10B981' },
  { id: 'cat_other',         name: '📦 Other',            icon: 'grid',             color: '#6B7280' },
] as const;

export const DEFAULT_INCOME_CATEGORIES = [
  { id: 'cat_salary',       name: '💼 Salary',        icon: 'briefcase',    color: '#10B981' },
  { id: 'cat_freelance',    name: '💻 Freelance',      icon: 'laptop',       color: '#3B82F6' },
  { id: 'cat_investment',   name: '📈 Investment',     icon: 'trending-up',  color: '#8B5CF6' },
  { id: 'cat_gift',         name: '🎁 Gift',           icon: 'gift',         color: '#EC4899' },
  { id: 'cat_other_income', name: '💰 Other Income',   icon: 'plus-circle',  color: '#6B7280' },
] as const;

// Auto-lock options (in minutes). 0 = immediately on background.
export const LOCK_TIMEOUT_OPTIONS = [0, 1, 5, 15, 30] as const;

// Free tier limits
export const FREE_TIER_LIMITS = {
  MAX_ACCOUNTS: 3,
  MAX_BUDGETS: 3,
  MAX_LOANS: 1,
  GOALS_LOCKED: true,
} as const;
