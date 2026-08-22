// Dhaka time helpers + hour/minute duration formatting (no decimal time).

export const DHAKA_OFFSET_MS = 6 * 3600 * 1000;

export const WEEKDAY_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
export const WEEKDAY_LONG = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

// Decimal hours -> "7h 30m" (no decimal time values).
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

const toDhaka = (value: any) => {
  if (!value) return null;
  const d = new Date(new Date(value).getTime() + DHAKA_OFFSET_MS);
  return isNaN(d.getTime()) ? null : d;
};

// Dhaka calendar date YYYY-MM-DD for an ISO instant.
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

// "2026-08-20 (Thu)"
export const fmtDhakaDateWithDay = (value: any) => {
  const d = toDhaka(value);
  if (!d) return '—';
  return `${fmtDhakaDate(d)} (${dhakaWeekdayShort(d)})`;
};

// Dhaka wall clock (HH:MM) from an ISO instant.
export const fmtDhakaTime = (value: any) => {
  const d = toDhaka(value);
  if (!d) return '—';
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}`;
};

// Weekday name for a bare YYYY-MM-DD Dhaka date string.
export const weekdayNameOfDayStr = (dayStr: string) => {
  const [y, m, d] = dayStr.split('-').map(Number);
  const weekday = new Date(Date.UTC(y, m - 1, d)).getUTCDay();
  return WEEKDAY_SHORT[weekday];
};

// Minutes -> "1h 30m" (same no-decimal-time rule as fmtHM).
export const fmtHMFromMinutes = (minutes: number | null | undefined) => {
  if (minutes == null || Number.isNaN(Number(minutes))) return '—';
  return fmtHM(Number(minutes) / 60);
};

// Currency-aware money formatting (defaults to BDT with the ৳ symbol).
export const fmtMoney = (value: any, currency: string | undefined = 'BDT') => {
  const num = Number(value ?? 0);
  const safe = Number.isFinite(num) ? num : 0;
  const formatted = safe.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  if (currency && currency !== 'BDT') return `${currency} ${formatted}`;
  return `৳ ${formatted}`;
};