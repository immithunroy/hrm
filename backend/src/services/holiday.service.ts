/**
 * Holiday Management Service
 *
 * Manages company-wide holidays and per-employee weekly holidays for
 * attendance classification. Key exports:
 *
 * - getHolidaysForMonth / getHolidaySet – query marked holidays
 * - isWeeklyHoliday / countWeeklyHolidays – per-employee weekend checks
 * - syncGoogleBangladeshHolidays – imports official BD government office
 *   holidays from an iCal feed, filtering out non-administrative observances
 * - parseGoogleIcs – parses iCal text into { date, name } pairs
 * - dhakaDayStart / dhakaDayString – Dhaka timezone normalization helpers
 *
 * All dates are stored as UTC instants representing Dhaka midnight (UTC+6).
 */
import { prisma } from '../config/database';

const DHAKA_OFFSET_MS = 6 * 3600 * 1000;

// Normalize a Dhaka calendar day (YYYY-MM-DD) to the UTC instant of Dhaka midnight.
export const dhakaDayStart = (dateStr: string): Date => {
  const [y, m, d] = dateStr.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d) - DHAKA_OFFSET_MS);
};

// Dhaka calendar day (YYYY-MM-DD) for a given date.
export const dhakaDayString = (value: Date): string => {
  const local = new Date(value.getTime() + DHAKA_OFFSET_MS);
  const y = local.getUTCFullYear();
  const m = String(local.getUTCMonth() + 1).padStart(2, '0');
  const d = String(local.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
};

// All marked holidays in a month (year, 1-12).
export const getHolidaysForMonth = async (year: number, month: number) => {
  return prisma.holiday.findMany({
    where: { year, month },
    orderBy: { date: 'asc' }
  });
};

// Set of marked holiday dates (YYYY-MM-DD) for a year.
export const getHolidaySet = async (year: number): Promise<Set<string>> => {
  const holidays = await prisma.holiday.findMany({
    where: { year },
    select: { date: true }
  });
  return new Set(holidays.map((h) => dhakaDayString(h.date)));
};

// Is this Dhaka calendar day a marked holiday?
export const isMarkedHoliday = async (dateStr: string): Promise<boolean> => {
  const count = await prisma.holiday.count({ where: { date: dhakaDayStart(dateStr) } });
  return count > 0;
};

// Weekly holiday weekday name (e.g. 'FRIDAY') for an employee.
export const getWeeklyHoliday = (employee: { weeklyHoliday?: string | null }): string => {
  return (employee.weeklyHoliday || 'FRIDAY').toUpperCase();
};

// Is the given Dhaka day (YYYY-MM-DD) the employee's weekly holiday?
// Check if a YYYY-MM-DD string matches the employee's weekly holiday weekday.
// Uses UTC day-of-week since dates are stored as Dhaka midnight UTC.
export const isWeeklyHoliday = (dateStr: string, weeklyHoliday: string): boolean => {
  const [y, m, d] = dateStr.split('-').map(Number);
  const weekday = new Date(Date.UTC(y, m - 1, d)).getUTCDay(); // 0=Sunday .. 6=Saturday
  const names = ['SUNDAY', 'MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY'];
  return names[weekday] === weeklyHoliday.toUpperCase();
};

// Count of weekly holidays between two Dhaka days (inclusive) for a given weekly holiday.
// Count weekly holidays in a date range by iterating each day.
// Used for payslip calculations to exclude weekends from working days.
export const countWeeklyHolidays = (startStr: string, endStr: string, weeklyHoliday: string): number => {
  const start = new Date(`${startStr}T00:00:00Z`);
  const end = new Date(`${endStr}T00:00:00Z`);
  let count = 0;
  for (let t = start.getTime(); t <= end.getTime(); t += 86400000) {
    if (isWeeklyHoliday(dhakaDayString(new Date(t)), weeklyHoliday)) count++;
  }
  return count;
};

// Bangladesh government (administrative / government office) holidays calendar (iCal).
// Only official government office holidays - academic/school/college and other
// non-administrative observances are excluded.
export const BD_GOVT_HOLIDAY_URL = 'https://www.bangladatetoday.com/api/ical/holidays-bd.ics';

// Holiday names that are NOT Bangladesh government office holidays and must never be imported:
// academic/school/college days, Western observances, and minor religious days.
const NON_GOVT_HOLIDAY_PATTERNS: RegExp[] = [
  /valentine/i,
  /mothers?\s*['’]?\s*day/i,
  /fathers?\s*['’]?\s*day/i,
  /halloween/i,
  /christmas eve/i,
  /boxing day/i,
  /new year's eve/i,
  /ash wednesday/i,
  /maundy thursday/i,
  /good friday/i,
  /holy saturday/i,
  /easter/i,
  /maha shivaratri/i,
  /\bholi\b/i,
  /maghi purnima/i,
  /saraswati puja/i,
  /shab[- ]?e[- ]?meraj/i,
  /national flag day/i,
  /harichand tagore/i,
  /madhu purnima/i,
  /prabarana purnima/i,
  /ashari purnima/i,
  /fateha/i,
  /akhari/i,
  /working day/i,
  /election day/i,
  /bank holiday/i,
  /mahalaya/i,
  /ashtami/i,
  /mahanabami/i,
  /lakshmi puja/i,
  /shyama puja/i,
  /shayama puja/i,
  /doljatra|dolyatra|dol purnima/i,
  /new year's day/i,
  /student[- ]?people uprising/i,
  /chaitra sankranti/i,
  /ramadan start/i,
  /\bmuharram\b/i,
  /bangabandhu homecoming/i,
  /academic|school|college|university|vacation|exam|education/i
];

// Is this holiday name a non-government (administrative) holiday?
export const isNonGovtHolidayName = (name: string): boolean =>
  NON_GOVT_HOLIDAY_PATTERNS.some((re) => re.test(name));

// Parse an iCal (VCALENDAR/VEVENT) text block into [{ date, name }].
// Extracts DTSTART (YYYYMMDD format) and SUMMARY for each event.
// Skips events without a valid 8-digit date or missing summary.
export const parseGoogleIcs = (ics: string): Array<{ date: string; name: string }> => {
  const events: Array<{ date: string; name: string }> = [];
  const blocks = ics.split('BEGIN:VEVENT');
  for (let i = 1; i < blocks.length; i++) {
    const block = blocks[i].split('END:VEVENT')[0];
    const dtStart = block.match(/^DTSTART[^:\r\n]*:(.+)$/m);
    if (!dtStart) continue;
    let dateRaw = (dtStart[1] || '').trim().split('T')[0];
    dateRaw = dateRaw.replace(/[^0-9]/g, '');
    if (dateRaw.length !== 8) continue;
    const summary = block.match(/^SUMMARY[^:\r\n]*:(.+)$/m);
    const name = (summary ? summary[1] : 'Holiday').replace(/\r/g, '').trim();
    const y = Number(dateRaw.slice(0, 4));
    const m = Number(dateRaw.slice(4, 6));
    const d = Number(dateRaw.slice(6, 8));
    if (!y || !m || !d) continue;
    events.push({
      date: `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`,
      name
    });
  }
  return events;
};

// Fetch and import the Bangladesh government office holidays calendar (idempotent upsert).
// Fetch BD government holidays from iCal, filter out non-administrative
// observances, and upsert into the Holiday table. Also cleans up any
// previously imported non-government holidays from the DB.
export const syncGoogleBangladeshHolidays = async (): Promise<{
  created: number;
  skipped: number;
  removed: number;
  total: number;
}> => {
  const res = await fetch(BD_GOVT_HOLIDAY_URL, { signal: AbortSignal.timeout(15000) });
  if (!res.ok) throw new Error(`Government holidays calendar fetch failed (${res.status})`);
  const ics = await res.text();
  const events = parseGoogleIcs(ics);
  if (events.length === 0) throw new Error('No holidays parsed from government holidays calendar feed');

  // Clean out previously imported holidays that are not government office holidays.
  const existingAll = await prisma.holiday.findMany({ select: { id: true, name: true } });
  let removed = 0;
  for (const h of existingAll) {
    if (isNonGovtHolidayName(h.name)) {
      await prisma.holiday.delete({ where: { id: h.id } });
      removed++;
    }
  }

  let created = 0;
  let skipped = 0;
  for (const ev of events) {
    if (isNonGovtHolidayName(ev.name)) {
      skipped++;
      continue;
    }
    const dayStart = dhakaDayStart(ev.date);
    const existing = await prisma.holiday.findUnique({ where: { date: dayStart } });
    if (existing) {
      skipped++;
      continue;
    }
    await prisma.holiday.create({
      data: {
        date: dayStart,
        name: ev.name,
        year: dayStart.getUTCFullYear(),
        month: dayStart.getUTCMonth() + 1
      }
    });
    created++;
  }
  return { created, skipped, removed, total: events.length };
};