/**
 * Attendance Merge Service
 *
 * Merges real attendance records with synthesized calendar rows so that
 * attendance lists and payslip reports show every expected work day,
 * including those with no device punch. Synthesized statuses:
 *
 *   HOLIDAY – company-wide marked holiday
 *   LEAVE   – approved leave request covering the day
 *   WEEKEND – employee's weekly holiday (default FRIDAY)
 *   ABSENT  – no record, no holiday, no leave
 *
 * Used by the payslip and attendance report generators to produce
 * complete monthly views.
 */
import { prisma } from '../config/database';
import { dhakaDayString, isWeeklyHoliday } from './holiday.service';
import { getPayrollSettings } from './settings.service';

const DAY_MS = 86400000;

// Merge real attendance records with synthesized calendar rows.
//
// For each active non-exempt employee × each day in [start, end]:
//   - If a real punch record exists for that day, it wins (no duplicate).
//   - Otherwise, synthesize a row with status: HOLIDAY > LEAVE > WEEKEND > ABSENT.
//
// This ensures attendance reports show a complete monthly view including
// holidays, leaves, weekends, and absences alongside real punch data.
export const mergeAttendanceWithCalendar = async (
  realRecords: any[],
  opts: { start?: Date; end?: Date; employeeId?: string }
): Promise<any[]> => {
  const { start, end, employeeId } = opts;
  if (!start || !end) return realRecords;

  // Company-wide default weekly holiday (each employee can override it).
  const settings = await getPayrollSettings();
  const defaultWeeklyHoliday = (settings.defaultWeeklyHoliday || 'FRIDAY').toUpperCase();

  // Active non-exempt employees (or a single employee for the payslip view).
  const employees = await prisma.employee.findMany({
    where: {
      status: 'ACTIVE',
      attendanceExempt: false,
      ...(employeeId ? { id: employeeId } : {})
    },
    select: {
      id: true,
      firstName: true,
      lastName: true,
      employeeId: true,
      weeklyHoliday: true,
      department: { select: { name: true } }
    }
  });
  if (employees.length === 0) return realRecords;

  // Per-employee weekly holiday: their dedicated weekend if set, else the default.
  const weeklyHolidayOf = (emp: { weeklyHoliday?: string | null }): string =>
    (emp.weeklyHoliday || defaultWeeklyHoliday).toUpperCase();

  const holidays = await prisma.holiday.findMany({
    where: { date: { gte: start, lte: end } },
    select: { date: true }
  });
  const holidaySet = new Set(holidays.map((h) => dhakaDayString(h.date)));

  const leaves = await prisma.leaveRequest.findMany({
    where: { status: 'APPROVED', startDate: { lte: end }, endDate: { gte: start } },
    select: { employeeId: true, startDate: true, endDate: true }
  });

  const leaveDaysByEmployee: Record<string, Set<string>> = {};
  for (const l of leaves) {
    const set = (leaveDaysByEmployee[l.employeeId] = leaveDaysByEmployee[l.employeeId] || new Set<string>());
    for (let t = l.startDate.getTime(); t <= l.endDate.getTime(); t += DAY_MS) {
      set.add(dhakaDayString(new Date(t)));
    }
  }

  const realKeys = new Set<string>();
  for (const r of realRecords) {
    if (r.date) realKeys.add(`${r.employeeId}|${dhakaDayString(new Date(r.date))}`);
  }

  const synthetic: any[] = [];
  for (let t = start.getTime(); t <= end.getTime(); t += DAY_MS) {
    const dayDate = new Date(t);
    const dayStr = dhakaDayString(dayDate);
    for (const emp of employees) {
      if (realKeys.has(`${emp.id}|${dayStr}`)) continue;
      let status: string | null = null;
      if (holidaySet.has(dayStr)) status = 'HOLIDAY';
      else if (leaveDaysByEmployee[emp.id]?.has(dayStr)) status = 'LEAVE';
      else if (isWeeklyHoliday(dayStr, weeklyHolidayOf(emp))) status = 'WEEKEND';
      if (!status) status = 'ABSENT';
      synthetic.push({
        id: `synth-${status}-${emp.id}-${dayStr}`,
        synthetic: true,
        employeeId: emp.id,
        employee: emp,
        date: dayDate,
        checkIn: null,
        checkOut: null,
        workHours: 0,
        overtimeHours: 0,
        earlyOvertimeHours: 0,
        lateMinutes: null,
        earlyDepartureMinutes: null,
        breakMinutes: 0,
        errandCount: 0,
        autoCheckOut: false,
        punches: [],
        status
      });
    }
  }

  return [...realRecords, ...synthetic];
};