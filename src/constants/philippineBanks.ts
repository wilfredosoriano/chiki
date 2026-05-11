/**
 * Philippine banks with confirmed card designs.
 * Only banks with verified card screenshots are included.
 * Additional banks will be added in future updates.
 *
 * Rates are per annum (p.a.) and approximate as of 2025.
 * Users should verify current rates with their bank directly.
 */

export interface PhBank {
  id: string;
  name: string;
  shortName: string;
  type: 'universal' | 'commercial' | 'thrift' | 'rural' | 'digital';
  color: string;             // brand color for UI
  emoji: string;             // fallback icon
  savingsRatePA: number;     // regular savings, % per annum
  highYieldRatePA?: number;  // high-yield / special savings if available
  minimumBalance: number;    // ADB in PHP to earn interest
  notes?: string;
}

export const PHILIPPINE_BANKS: PhBank[] = [
  // ── Universal / Commercial Banks ─────────────────────────────────────────
  {
    id: 'bdo',
    name: 'BDO Unibank',
    shortName: 'BDO',
    type: 'universal',
    color: '#2A6CC4',
    emoji: '🏦',
    savingsRatePA: 0.10,
    minimumBalance: 2000,
    notes: 'Regular savings. BDO Optimum Savings: up to 3.25% p.a.',
  },
  {
    id: 'bpi',
    name: 'Bank of the Philippine Islands',
    shortName: 'BPI',
    type: 'universal',
    color: '#6B1010',
    emoji: '🏦',
    savingsRatePA: 0.10,
    highYieldRatePA: 4.00,
    minimumBalance: 3000,
    notes: 'BPI Advance Savings: up to 4.00% p.a.',
  },
  {
    id: 'metrobank',
    name: 'Metropolitan Bank & Trust',
    shortName: 'Metrobank',
    type: 'universal',
    color: '#2B5FBF',
    emoji: '🏦',
    savingsRatePA: 0.10,
    minimumBalance: 2000,
  },
  {
    id: 'unionbank',
    name: 'UnionBank of the Philippines',
    shortName: 'UnionBank',
    type: 'universal',
    color: '#F26522',
    emoji: '🏦',
    savingsRatePA: 0.10,
    highYieldRatePA: 6.50,
    minimumBalance: 0,
    notes: 'High-interest account up to 6.50% p.a. for qualified deposits.',
  },
  {
    id: 'security-bank',
    name: 'Security Bank',
    shortName: 'Security Bank',
    type: 'universal',
    color: '#2B4DB8',
    emoji: '🏦',
    savingsRatePA: 0.10,
    minimumBalance: 5000,
  },
  {
    id: 'rcbc',
    name: 'Rizal Commercial Banking Corporation',
    shortName: 'RCBC',
    type: 'universal',
    color: '#2B7CC8',
    emoji: '🏦',
    savingsRatePA: 0.10,
    minimumBalance: 2000,
  },
  {
    id: 'pnb',
    name: 'Philippine National Bank',
    shortName: 'PNB',
    type: 'universal',
    color: '#00BDD6',
    emoji: '🏦',
    savingsRatePA: 0.10,
    minimumBalance: 2000,
  },
  {
    id: 'chinabank',
    name: 'China Banking Corporation',
    shortName: 'Chinabank',
    type: 'universal',
    color: '#CC1020',
    emoji: '🏦',
    savingsRatePA: 0.10,
    minimumBalance: 5000,
  },
  {
    id: 'eastwest',
    name: 'EastWest Bank',
    shortName: 'EastWest',
    type: 'universal',
    color: '#CCDE10',
    emoji: '🏦',
    savingsRatePA: 0.10,
    minimumBalance: 5000,
  },
  {
    id: 'ucpb',
    name: 'Landbank of the Philippines',
    shortName: 'Landbank',
    type: 'universal',
    color: '#0A5C2A',
    emoji: '🏦',
    savingsRatePA: 0.25,
    minimumBalance: 100,
    notes: 'Government bank. UCPB merged with Landbank.',
  },
  {
    id: 'dbp',
    name: 'Development Bank of the Philippines',
    shortName: 'DBP',
    type: 'universal',
    color: '#1A3AA0',
    emoji: '🏦',
    savingsRatePA: 0.25,
    minimumBalance: 500,
    notes: 'Government bank.',
  },
  {
    id: 'boc',
    name: 'Bank of Commerce',
    shortName: 'Bank of Commerce',
    type: 'commercial',
    color: '#1A2E5A',
    emoji: '🏦',
    savingsRatePA: 0.10,
    minimumBalance: 2000,
  },

  // ── Digital / Neobanks ────────────────────────────────────────────────────
  {
    id: 'maya-bank',
    name: 'Maya Bank',
    shortName: 'Maya',
    type: 'digital',
    color: '#00E676',
    emoji: '📱',
    savingsRatePA: 3.50,
    highYieldRatePA: 15.00,
    minimumBalance: 0,
    notes: 'Maya Savings up to 15% p.a. for new users (promo). Regular: 3.5%.',
  },
  {
    id: 'gotyme',
    name: 'GoTyme Bank',
    shortName: 'GoTyme',
    type: 'digital',
    color: '#00C8C8',
    emoji: '📱',
    savingsRatePA: 5.00,
    minimumBalance: 0,
    notes: 'No minimum balance. GoSave up to 5% p.a.',
  },
  {
    id: 'seabank',
    name: 'SeaBank Philippines',
    shortName: 'SeaBank',
    type: 'digital',
    color: '#F47920',
    emoji: '📱',
    savingsRatePA: 3.50,
    minimumBalance: 0,
    notes: 'Shopee-linked digital bank. A Rural Bank.',
  },
  {
    id: 'gcash',
    name: 'GCash (Mynt)',
    shortName: 'GCash',
    type: 'digital',
    color: '#0066CC',
    emoji: '📱',
    savingsRatePA: 0,
    minimumBalance: 0,
    notes: 'E-wallet by Globe/Mynt. GCash Mastercard available.',
  },
  {
    id: 'atome',
    name: 'Atome Card',
    shortName: 'Atome',
    type: 'digital',
    color: '#C8F000',
    emoji: '📱',
    savingsRatePA: 0,
    minimumBalance: 0,
    notes: 'Buy now, pay later card. Mastercard.',
  },
];

/**
 * Returns a bank by its ID. Returns undefined if not found.
 */
export function getBankById(id: string): PhBank | undefined {
  return PHILIPPINE_BANKS.find((b) => b.id === id);
}

/**
 * Returns the display interest rate label for a bank.
 * Shows high-yield rate if available.
 */
export function getBankRateLabel(bank: PhBank): string {
  if (bank.highYieldRatePA) {
    return `${bank.savingsRatePA.toFixed(2)}% – ${bank.highYieldRatePA.toFixed(2)}% p.a.`;
  }
  return `${bank.savingsRatePA.toFixed(2)}% p.a.`;
}
