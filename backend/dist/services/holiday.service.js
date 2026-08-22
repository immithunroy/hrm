"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.syncGoogleBangladeshHolidays = exports.parseGoogleIcs = exports.isNonGovtHolidayName = exports.BD_GOVT_HOLIDAY_URL = exports.countWeeklyHolidays = exports.isWeeklyHoliday = exports.getWeeklyHoliday = exports.isMarkedHoliday = exports.getHolidaySet = exports.getHolidaysForMonth = exports.dhakaDayString = exports.dhakaDayStart = void 0;
const database_1 = require("../config/database");
const DHAKA_OFFSET_MS = 6 * 3600 * 1000;
// Normalize a Dhaka calendar day (YYYY-MM-DD) to the UTC instant of Dhaka midnight.
const dhakaDayStart = (dateStr) => {
    const [y, m, d] = dateStr.split('-').map(Number);
    return new Date(Date.UTC(y, m - 1, d) - DHAKA_OFFSET_MS);
};
exports.dhakaDayStart = dhakaDayStart;
// Dhaka calendar day (YYYY-MM-DD) for a given date.
const dhakaDayString = (value) => {
    const local = new Date(value.getTime() + DHAKA_OFFSET_MS);
    const y = local.getUTCFullYear();
    const m = String(local.getUTCMonth() + 1).padStart(2, '0');
    const d = String(local.getUTCDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
};
exports.dhakaDayString = dhakaDayString;
// All marked holidays in a month (year, 1-12).
const getHolidaysForMonth = async (year, month) => {
    return database_1.prisma.holiday.findMany({
        where: { year, month },
        orderBy: { date: 'asc' }
    });
};
exports.getHolidaysForMonth = getHolidaysForMonth;
// Set of marked holiday dates (YYYY-MM-DD) for a year.
const getHolidaySet = async (year) => {
    const holidays = await database_1.prisma.holiday.findMany({
        where: { year },
        select: { date: true }
    });
    return new Set(holidays.map((h) => (0, exports.dhakaDayString)(h.date)));
};
exports.getHolidaySet = getHolidaySet;
// Is this Dhaka calendar day a marked holiday?
const isMarkedHoliday = async (dateStr) => {
    const count = await database_1.prisma.holiday.count({ where: { date: (0, exports.dhakaDayStart)(dateStr) } });
    return count > 0;
};
exports.isMarkedHoliday = isMarkedHoliday;
// Weekly holiday weekday name (e.g. 'FRIDAY') for an employee.
const getWeeklyHoliday = (employee) => {
    return (employee.weeklyHoliday || 'FRIDAY').toUpperCase();
};
exports.getWeeklyHoliday = getWeeklyHoliday;
// Is the given Dhaka day (YYYY-MM-DD) the employee's weekly holiday?
const isWeeklyHoliday = (dateStr, weeklyHoliday) => {
    const [y, m, d] = dateStr.split('-').map(Number);
    const weekday = new Date(Date.UTC(y, m - 1, d)).getUTCDay(); // 0=Sunday .. 6=Saturday
    const names = ['SUNDAY', 'MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY'];
    return names[weekday] === weeklyHoliday.toUpperCase();
};
exports.isWeeklyHoliday = isWeeklyHoliday;
// Count of weekly holidays between two Dhaka days (inclusive) for a given weekly holiday.
const countWeeklyHolidays = (startStr, endStr, weeklyHoliday) => {
    const start = new Date(`${startStr}T00:00:00Z`);
    const end = new Date(`${endStr}T00:00:00Z`);
    let count = 0;
    for (let t = start.getTime(); t <= end.getTime(); t += 86400000) {
        if ((0, exports.isWeeklyHoliday)((0, exports.dhakaDayString)(new Date(t)), weeklyHoliday))
            count++;
    }
    return count;
};
exports.countWeeklyHolidays = countWeeklyHolidays;
// Bangladesh government (administrative / government office) holidays calendar (iCal).
// Only official government office holidays - academic/school/college and other
// non-administrative observances are excluded.
exports.BD_GOVT_HOLIDAY_URL = 'https://www.bangladatetoday.com/api/ical/holidays-bd.ics';
// Holiday names that are NOT Bangladesh government office holidays and must never be imported:
// academic/school/college days, Western observances, and minor religious days.
const NON_GOVT_HOLIDAY_PATTERNS = [
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
const isNonGovtHolidayName = (name) => NON_GOVT_HOLIDAY_PATTERNS.some((re) => re.test(name));
exports.isNonGovtHolidayName = isNonGovtHolidayName;
// Parse a Google iCal feed into [{ date: 'YYYY-MM-DD', name }].
const parseGoogleIcs = (ics) => {
    const events = [];
    const blocks = ics.split('BEGIN:VEVENT');
    for (let i = 1; i < blocks.length; i++) {
        const block = blocks[i].split('END:VEVENT')[0];
        const dtStart = block.match(/^DTSTART[^:\r\n]*:(.+)$/m);
        if (!dtStart)
            continue;
        let dateRaw = (dtStart[1] || '').trim().split('T')[0];
        dateRaw = dateRaw.replace(/[^0-9]/g, '');
        if (dateRaw.length !== 8)
            continue;
        const summary = block.match(/^SUMMARY[^:\r\n]*:(.+)$/m);
        const name = (summary ? summary[1] : 'Holiday').replace(/\r/g, '').trim();
        const y = Number(dateRaw.slice(0, 4));
        const m = Number(dateRaw.slice(4, 6));
        const d = Number(dateRaw.slice(6, 8));
        if (!y || !m || !d)
            continue;
        events.push({
            date: `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`,
            name
        });
    }
    return events;
};
exports.parseGoogleIcs = parseGoogleIcs;
// Fetch and import the Bangladesh government office holidays calendar (idempotent upsert).
const syncGoogleBangladeshHolidays = async () => {
    const res = await fetch(exports.BD_GOVT_HOLIDAY_URL, { signal: AbortSignal.timeout(15000) });
    if (!res.ok)
        throw new Error(`Government holidays calendar fetch failed (${res.status})`);
    const ics = await res.text();
    const events = (0, exports.parseGoogleIcs)(ics);
    if (events.length === 0)
        throw new Error('No holidays parsed from government holidays calendar feed');
    // Clean out previously imported holidays that are not government office holidays.
    const existingAll = await database_1.prisma.holiday.findMany({ select: { id: true, name: true } });
    let removed = 0;
    for (const h of existingAll) {
        if ((0, exports.isNonGovtHolidayName)(h.name)) {
            await database_1.prisma.holiday.delete({ where: { id: h.id } });
            removed++;
        }
    }
    let created = 0;
    let skipped = 0;
    for (const ev of events) {
        if ((0, exports.isNonGovtHolidayName)(ev.name)) {
            skipped++;
            continue;
        }
        const dayStart = (0, exports.dhakaDayStart)(ev.date);
        const existing = await database_1.prisma.holiday.findUnique({ where: { date: dayStart } });
        if (existing) {
            skipped++;
            continue;
        }
        await database_1.prisma.holiday.create({
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
exports.syncGoogleBangladeshHolidays = syncGoogleBangladeshHolidays;
