// ─── Design Tokens ────────────────────────────────────────────────────────────
// Philosophy: restraint over decoration. Hierarchy through scale + weight.
// Reference: Stripe Dashboard, Linear, Revolut, Apple Wallet, Vercel

export const Colors = {
  // ── Terra — forest green palette: sage surfaces, deep green text, golden CTA ──
  terra: {
    // Surfaces — white bg, deeper green-tinted cards
    background:       '#FFFFFF',  // pure white page bg
    surface:          '#D6E8D9',  // deeper sage — cards, rows, groups
    surfaceElevated:  '#C4DACA',  // richer sage — modals, sheets

    // Borders — forest-tinted
    border:           'rgba(8, 45, 32, 0.16)',
    borderSubtle:     'rgba(8, 45, 32, 0.08)',

    // Primary — golden yellow CTAs (#FFBA00)
    primary:          '#FFBA00',
    primaryFg:        '#082D20',  // deep forest on golden

    // Accent — burnt orange
    accent:           '#B46617',
    accentFg:         '#FFFFFF',

    // Text — deeper forest green, very readable on sage
    textPrimary:      '#082D20',
    textSecondary:    'rgba(8, 45, 32, 0.65)',
    textTertiary:     'rgba(8, 45, 32, 0.42)',

    // Semantic
    income:           '#1E6B1A',
    expense:          '#B03020',
    warning:          '#B46617',
    success:          '#1E6B1A',

    // ── Backward-compat aliases ──
    primaryLight:     'rgba(255, 186, 0, 0.18)',
    primaryDark:      '#D4A000',
    incomeLight:      '#C2DFBD',
    expenseLight:     '#F8DADA',
    warningLight:     '#FAECC8',
    surfaceSecondary: '#C4DACA',
    divider:          'rgba(8, 45, 32, 0.10)',
    tabBar:           '#FFFFFF',
    tabBarBorder:     'rgba(8, 45, 32, 0.10)',
    card:             '#082D20',  // deep forest for hero/featured cards
    shadow:           '#082D20',
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
