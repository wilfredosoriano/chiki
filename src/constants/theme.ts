// ─── Design Tokens ────────────────────────────────────────────────────────────
// Philosophy: restraint over decoration. Hierarchy through scale + weight.
// Reference: Stripe Dashboard, Linear, Revolut, Apple Wallet, Vercel

export const Colors = {
  // ── Terra — forest green palette: sage surfaces, deep green text, golden CTA ──
  terra: {
    // Surfaces — white bg, sage-tinted cards
    background:       '#FFFFFF',  // pure white page bg
    surface:          '#E4EEE6',  // soft sage — cards, rows, groups
    surfaceElevated:  '#D6E5D9',  // deeper sage — modals, sheets

    // Borders — forest-tinted
    border:           'rgba(12, 59, 46, 0.14)',
    borderSubtle:     'rgba(12, 59, 46, 0.07)',

    // Primary — golden yellow CTAs (#FFBA00)
    primary:          '#FFBA00',
    primaryFg:        '#0C3B2E',  // deep forest on golden

    // Accent — sage green (#6D9773) + burnt orange (#B46617)
    accent:           '#B46617',  // burnt orange for highlights
    accentFg:         '#FFFFFF',

    // Text — deep forest green (#0C3B2E), very readable on light sage
    textPrimary:      '#0C3B2E',
    textSecondary:    'rgba(12, 59, 46, 0.62)',
    textTertiary:     'rgba(12, 59, 46, 0.40)',

    // Semantic
    income:           '#4A8C43',
    expense:          '#B03020',
    warning:          '#B46617',
    success:          '#4A8C43',

    // ── Backward-compat aliases ──
    primaryLight:     'rgba(255, 186, 0, 0.18)',
    primaryDark:      '#D4A000',
    incomeLight:      '#D4EDCF',
    expenseLight:     '#F8DADA',
    warningLight:     '#FAECC8',
    surfaceSecondary: '#D6E5D9',
    divider:          'rgba(12, 59, 46, 0.10)',
    tabBar:           '#FFFFFF',
    tabBarBorder:     'rgba(12, 59, 46, 0.10)',
    card:             '#0C3B2E',  // deep forest for hero/featured cards
    shadow:           '#0C3B2E',
    gradientStart:    '#FFBA00',
    gradientEnd:      '#B46617',
  },

};

// ─── Typography ───────────────────────────────────────────────────────────────
// System font: SF Pro on iOS, Roboto on Android
export const Typography = {
  // Named scales (new)
  display: { fontSize: 40, fontWeight: '700' as const, letterSpacing: -1.5 },
  h1:      { fontSize: 28, fontWeight: '700' as const, letterSpacing: -0.8 },
  h2:      { fontSize: 22, fontWeight: '600' as const, letterSpacing: -0.4 },
  h3:      { fontSize: 17, fontWeight: '600' as const, letterSpacing: -0.2 },
  body:    { fontSize: 15, fontWeight: '400' as const, letterSpacing: 0 },
  bodyMedium: { fontSize: 15, fontWeight: '500' as const, letterSpacing: 0 },
  caption: { fontSize: 12, fontWeight: '400' as const, letterSpacing: 0.2 },
  label:   { fontSize: 11, fontWeight: '500' as const, letterSpacing: 0.5 },

  // Legacy size map (kept for backward compat with existing screens)
  sizes: {
    xs:    11,
    sm:    13,
    base:  15,
    md:    17,
    lg:    20,
    xl:    24,
    '2xl': 28,
    '3xl': 34,
  },
  weights: {
    regular:   '400' as const,
    medium:    '500' as const,
    semibold:  '600' as const,
    bold:      '700' as const,
    extrabold: '800' as const,
  },
};

// ─── Spacing (4pt grid) ───────────────────────────────────────────────────────
export const Spacing = {
  2: 2, 4: 4, 8: 8, 12: 12, 16: 16, 20: 20, 24: 24, 32: 32, 40: 40, 48: 48, 64: 64,
  // Legacy named keys
  xs:    4,
  sm:    8,
  md:    12,
  base:  16,
  lg:    20,
  xl:    24,
  '2xl': 32,
  '3xl': 40,
};

// ─── Border Radius ────────────────────────────────────────────────────────────
export const Radius = {
  sm:   4,
  md:   8,
  lg:   12,
  xl:   16,
  '2xl': 20,
  full: 9999,
};

// ─── Shadows (light mode only — apply conditionally, never in dark mode) ──────
export const Shadow = {
  sm: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 2,
    elevation: 1,
  },
  md: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 3,
  },
  lg: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.08,
    shadowRadius: 24,
    elevation: 8,
  },
};
