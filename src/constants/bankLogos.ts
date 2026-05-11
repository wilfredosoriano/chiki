/**
 * Bank logo assets — static require() calls for the Metro bundler.
 * Drop PNG files into assets/banks/ using the exact filenames below.
 *
 * Recommended spec: 120×120px PNG, transparent background, white or
 * full-color logo depending on the card design.
 *
 * If a bank's file is missing, the picker falls back to a colored initial.
 */

type LogoMap = Record<string, number>;

const BANK_LOGOS: LogoMap = {
  bdo:             require('../../assets/banks/bdo.png'),
  bpi:             require('../../assets/banks/bpi.png'),
  metrobank:       require('../../assets/banks/metrobank.png'),
  unionbank:       require('../../assets/banks/unionbank.png'),
  'security-bank': require('../../assets/banks/security-bank.png'),
  rcbc:            require('../../assets/banks/rcbc.png'),
  pnb:             require('../../assets/banks/pnb.png'),
  chinabank:       require('../../assets/banks/chinabank.png'),
  eastwest:        require('../../assets/banks/eastwest.png'),
  ucpb:            require('../../assets/banks/landbank.png'),
  dbp:             require('../../assets/banks/dbp.png'),
  boc:             require('../../assets/banks/boc.png'),
  'maya-bank':     require('../../assets/banks/maya.png'),
  gotyme:          require('../../assets/banks/gotyme.png'),
  seabank:         require('../../assets/banks/seabank.png'),
  gcash:           require('../../assets/banks/gcash.png'),
  atome:           require('../../assets/banks/atome.png'),
};

export function getBankLogo(bankId: string): number | null {
  try {
    return BANK_LOGOS[bankId] ?? null;
  } catch {
    return null;
  }
}
