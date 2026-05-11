/**
 * Per-bank card themes — colors and gradients based on actual card designs.
 * Only banks with verified card screenshots are included.
 * Additional banks will be added in future updates.
 */

export interface BankCardTheme {
  gradientPrimary: string;
  gradientSecondary: string;
  textColor: 'light' | 'dark';
  accentColor: string; // for chip, network logo tint, etc.
}

export const BANK_CARD_THEMES: Record<string, BankCardTheme> = {
  bdo: {
    // Flat cornflower blue — clean minimal BDO debit
    gradientPrimary: '#2A6CC4',
    gradientSecondary: '#2A6CC4',
    textColor: 'light',
    accentColor: '#FFFFFF',
  },
  bpi: {
    // Deep dark maroon/burgundy with subtle diagonal texture
    gradientPrimary: '#4A0A0A',
    gradientSecondary: '#6B1010',
    textColor: 'light',
    accentColor: '#CC6666',
  },
  metrobank: {
    // Blue-to-purple diagonal gradient — Metrobank Prime
    gradientPrimary: '#2B5FBF',
    gradientSecondary: '#7B4DB8',
    textColor: 'light',
    accentColor: '#C0AAFF',
  },
  unionbank: {
    // Bright orange with large diagonal "U" watermark
    gradientPrimary: '#D93D00',
    gradientSecondary: '#F26522',
    textColor: 'light',
    accentColor: '#FFCCAA',
  },
  'security-bank': {
    // Flat solid cobalt blue — Security Bank Everyday Card
    gradientPrimary: '#2B4DB8',
    gradientSecondary: '#2B4DB8',
    textColor: 'light',
    accentColor: '#FFFFFF',
  },
  rcbc: {
    // Medium blue with hexagon texture, slight gradient
    gradientPrimary: '#1A5FA8',
    gradientSecondary: '#2B7CC8',
    textColor: 'light',
    accentColor: '#A0C8F0',
  },
  pnb: {
    // Flat teal/cyan — PNB Mabuhay Miles debit card
    gradientPrimary: '#00A8C0',
    gradientSecondary: '#00BDD6',
    textColor: 'light',
    accentColor: '#FFFFFF',
  },
  chinabank: {
    // Flat brand red — Chinabank debit card
    gradientPrimary: '#AA0D1E',
    gradientSecondary: '#CC1020',
    textColor: 'light',
    accentColor: '#FF8899',
  },
  eastwest: {
    // Flat lime yellow-green with diagonal fold overlap
    gradientPrimary: '#B8CC00',
    gradientSecondary: '#CCDE10',
    textColor: 'dark',
    accentColor: '#4A5200',
  },
  ucpb: {
    // Dark green with light green swoosh/leaf — Landbank
    gradientPrimary: '#0A5C2A',
    gradientSecondary: '#4CAF50',
    textColor: 'light',
    accentColor: '#A8E6B0',
  },
  dbp: {
    // Red-to-blue diagonal gradient — DBP patriotic colors
    gradientPrimary: '#CC1020',
    gradientSecondary: '#1A3AA0',
    textColor: 'light',
    accentColor: '#FFFFFF',
  },
  boc: {
    // Dark navy with gold accent — Bank of Commerce
    gradientPrimary: '#0A1A3A',
    gradientSecondary: '#1A2E5A',
    textColor: 'light',
    accentColor: '#C8A830',
  },
  'maya-bank': {
    // Matte black with neon green Maya accent
    gradientPrimary: '#0A0A0A',
    gradientSecondary: '#111B12',
    textColor: 'light',
    accentColor: '#00E676',
  },
  gotyme: {
    // Dark navy fading to dark teal — horizontal stripe card
    gradientPrimary: '#1A2535',
    gradientSecondary: '#0A3D3D',
    textColor: 'light',
    accentColor: '#00C8C8',
  },
  seabank: {
    // Flat warm orange — SeaBank A Rural Bank
    gradientPrimary: '#F47920',
    gradientSecondary: '#D4600A',
    textColor: 'light',
    accentColor: '#FFFFFF',
  },
  gcash: {
    // Royal blue — GCash Mastercard
    gradientPrimary: '#004BB5',
    gradientSecondary: '#0066CC',
    textColor: 'light',
    accentColor: '#66AAFF',
  },
  atome: {
    // Matte black with acid yellow-green chevron accent
    gradientPrimary: '#1A1A1A',
    gradientSecondary: '#0D0D0D',
    textColor: 'light',
    accentColor: '#C8F000',
  },
};

/** Fallback theme for cash / unknown accounts */
export const DEFAULT_CARD_THEME: BankCardTheme = {
  gradientPrimary: '#3730A3',
  gradientSecondary: '#6366F1',
  textColor: 'light',
  accentColor: '#A5B4FC',
};

export function getCardTheme(bankId?: string): BankCardTheme {
  if (bankId && BANK_CARD_THEMES[bankId]) return BANK_CARD_THEMES[bankId];
  return DEFAULT_CARD_THEME;
}
