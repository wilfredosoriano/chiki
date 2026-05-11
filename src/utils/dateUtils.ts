/**
 * Lightweight date utilities — drop-in replacement for the date-fns functions
 * used in this project. Uses only the native Date API; zero dependencies.
 *
 * Supported format() tokens:
 *   yyyy  MMMM  MMM  MM  dd  d  EEEE
 */

const MONTHS_LONG  = ['January','February','March','April','May','June',
                      'July','August','September','October','November','December'];
const MONTHS_SHORT = ['Jan','Feb','Mar','Apr','May','Jun',
                      'Jul','Aug','Sep','Oct','Nov','Dec'];
const DAYS_LONG    = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];

export function format(date: Date, pattern: string): string {
  const yyyy   = date.getFullYear().toString();
  const MM     = String(date.getMonth() + 1).padStart(2, '0');
  const dd     = String(date.getDate()).padStart(2, '0');
  const d      = date.getDate().toString();
  const MMM    = MONTHS_SHORT[date.getMonth()];
  const MMMM   = MONTHS_LONG[date.getMonth()];
  const EEEE   = DAYS_LONG[date.getDay()];

  // Handle exact patterns first for speed, then fall back to token replacement.
  switch (pattern) {
    case 'yyyy-MM-dd':       return `${yyyy}-${MM}-${dd}`;
    case 'yyyy-MM':          return `${yyyy}-${MM}`;
    case 'MMM':              return MMM;
    case 'MMMM':             return MMMM;
    case 'MMM yyyy':         return `${MMM} ${yyyy}`;
    case 'MMMM yyyy':        return `${MMMM} ${yyyy}`;
    case 'MMM d, yyyy':      return `${MMM} ${d}, ${yyyy}`;
    case 'MMMM d, yyyy':     return `${MMMM} ${d}, ${yyyy}`;
    case 'EEEE, MMMM d':     return `${EEEE}, ${MMMM} ${d}`;
    case 'EEEE, MMM d, yyyy':return `${EEEE}, ${MMM} ${d}, ${yyyy}`;
    default:
      return pattern
        .replace('EEEE', EEEE)
        .replace('MMMM', MMMM)
        .replace('MMM',  MMM)
        .replace('yyyy', yyyy)
        .replace('MM',   MM)
        .replace('dd',   dd)
        .replace(/\bd\b/, d);
  }
}

export function addMonths(date: Date, amount: number): Date {
  const result = new Date(date);
  const day = result.getDate();
  result.setMonth(result.getMonth() + amount);
  // Guard against month overflow (e.g. Jan 31 + 1 month → Feb 28)
  if (result.getDate() !== day) result.setDate(0);
  return result;
}

export function subMonths(date: Date, amount: number): Date {
  return addMonths(date, -amount);
}

export function getDaysInMonth(date: Date): number {
  return new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
}

export function getDay(date: Date): number {
  return date.getDay();
}

export function startOfMonth(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

/** Calendar-day difference: positive when dateLeft is after dateRight. */
export function differenceInCalendarDays(dateLeft: Date, dateRight: Date): number {
  const a = Date.UTC(dateLeft.getFullYear(),  dateLeft.getMonth(),  dateLeft.getDate());
  const b = Date.UTC(dateRight.getFullYear(), dateRight.getMonth(), dateRight.getDate());
  return Math.round((a - b) / 86_400_000);
}
