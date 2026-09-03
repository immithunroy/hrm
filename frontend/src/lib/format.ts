/**
 * Date/time formatting utilities tuned for the Dhaka (UTC+6) timezone.
 *
 * All date functions convert UTC ISO timestamps to Dhaka-local calendar
 * dates before formatting. Duration helpers use a "hours + minutes" display
 * (e.g. "7h 30m") rather than decimal hours.
 */

/** Dhaka timezone offset in milliseconds (UTC+6). */
export const DHAKA_OFFSET_MS = 6 * 3600 * 1000;

export const WEEKDAY_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
export const WEEKDAY_LONG = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

/**
 * Format decimal hours as "Xh Ym" (e.g. 7.5 → "7h 30m").
 * Returns '—' for null/undefined/NaN inputs.
 */
export const fmtHM = (hours: number | null | undefined) => {
  if (hours == null || Number.isNaN(Number(hours))) return '—';
  const totalMinutes = Math.round(Number(hours) * 60);
  const h = Math.floor(totalMinutes / 60);
  const m = totalMinutes % 60;
  if (h === 0 && m === 0) return '0m';
  if (h === 0) return `${m}m`;
  if (m === 0) return `${h}h`;
  return `${h}h ${m}m`;
};

/**
 * Convert any date-like value to a Date object shifted to Dhaka time.
 * Uses UTC getters on the shifted date so calendar values reflect Dhaka local time.
 */
const toDhaka = (value: any) => {
  if (!value) return null;
  const d = new Date(new Date(value).getTime() + DHAKA_OFFSET_MS);
  return isNaN(d.getTime()) ? null : d;
};

/** Format an ISO instant as a Dhaka calendar date: "YYYY-MM-DD". */
export const fmtDhakaDate = (value: any) => {
  const d = toDhaka(value);
  if (!d) return '—';
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
};

export const dhakaWeekdayShort = (value: any) => {
  const d = toDhaka(value);
  if (!d) return '—';
  return WEEKDAY_SHORT[d.getUTCDay()];
};

export const dhakaWeekdayLong = (value: any) => {
  const d = toDhaka(value);
  if (!d) return '—';
  return WEEKDAY_LONG[d.getUTCDay()];
};

/** Format as "YYYY-MM-DD (Day)" e.g. "2026-08-20 (Thu)". */
export const fmtDhakaDateWithDay = (value: any) => {
  const d = toDhaka(value);
  if (!d) return '—';
  return `${fmtDhakaDate(d)} (${dhakaWeekdayShort(d)})`;
};

/** Format an ISO instant as Dhaka wall clock time: "HH:MM". */
export const fmtDhakaTime = (value: any) => {
  const d = toDhaka(value);
  if (!d) return '—';
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}`;
};

/**
 * Get the short weekday name for a bare "YYYY-MM-DD" date string
 * (assumed to already be in Dhaka local time).
 */
export const weekdayNameOfDayStr = (dayStr: string) => {
  const [y, m, d] = dayStr.split('-').map(Number);
  const weekday = new Date(Date.UTC(y, m - 1, d)).getUTCDay();
  return WEEKDAY_SHORT[weekday];
};

/**
 * Convert minutes to "Xh Ym" format (e.g. 90 → "1h 30m").
 * Delegates to fmtHM after converting minutes to decimal hours.
 */
export const fmtHMFromMinutes = (minutes: number | null | undefined) => {
  if (minutes == null || Number.isNaN(Number(minutes))) return '—';
  return fmtHM(Number(minutes) / 60);
};

/**
 * Format a numeric value as currency.
 * Defaults to Bangladeshi Taka (BDT) with the ৳ symbol.
 * Other currencies are displayed as "CODE amount".
 */
export const fmtMoney = (value: any, currency: string | undefined = 'BDT') => {
  const num = Number(value ?? 0);
  const safe = Number.isFinite(num) ? num : 0;
  const formatted = safe.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  if (currency && currency !== 'BDT') return `${currency} ${formatted}`;
  return `৳ ${formatted}`;
};