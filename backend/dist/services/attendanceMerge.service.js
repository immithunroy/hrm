"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.mergeAttendanceWithCalendar = void 0;
const database_1 = require("../config/database");
const holiday_service_1 = require("./holiday.service");
const settings_service_1 = require("./settings.service");
const DAY_MS = 86400000;
// Merge real attendance records with synthesized calendar rows so the
// attendance list / sheets show HOLIDAY (company holiday), LEAVE (approved
// leave request) and WEEKEND (employee weekly holiday) days too.
//
// Rules (in precedence order, per active non-exempt employee + day):
//   1. A real attendance record wins (no synthetic duplicate).
//   2. Company holiday (Holiday table) -> HOLIDAY
//   3. Approved leave covering the day -> LEAVE
//   4. Employee's weekly holiday -> WEEKEND
// Days with none of the above and no real record are simply omitted.
const mergeAttendanceWithCalendar = async (realRecords, opts) => {
    const { start, end, employeeId } = opts;
    if (!start || !end)
        return realRecords;
    // Company-wide default weekly holiday (each employee can override it).
    const settings = await (0, settings_service_1.getPayrollSettings)();
    const defaultWeeklyHoliday = (settings.defaultWeeklyHoliday || 'FRIDAY').toUpperCase();
    // Active non-exempt employees (or a single employee for the payslip view).
    const employees = await database_1.prisma.employee.findMany({
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
    if (employees.length === 0)
        return realRecords;
    // Per-employee weekly holiday: their dedicated weekend if set, else the default.
    const weeklyHolidayOf = (emp) => (emp.weeklyHoliday || defaultWeeklyHoliday).toUpperCase();
    const holidays = await database_1.prisma.holiday.findMany({
        where: { date: { gte: start, lte: end } },
        select: { date: true }
    });
    const holidaySet = new Set(holidays.map((h) => (0, holiday_service_1.dhakaDayString)(h.date)));
    const leaves = await database_1.prisma.leaveRequest.findMany({
        where: { status: 'APPROVED', startDate: { lte: end }, endDate: { gte: start } },
        select: { employeeId: true, startDate: true, endDate: true }
    });
    const leaveDaysByEmployee = {};
    for (const l of leaves) {
        const set = (leaveDaysByEmployee[l.employeeId] = leaveDaysByEmployee[l.employeeId] || new Set());
        for (let t = l.startDate.getTime(); t <= l.endDate.getTime(); t += DAY_MS) {
            set.add((0, holiday_service_1.dhakaDayString)(new Date(t)));
        }
    }
    const realKeys = new Set();
    for (const r of realRecords) {
        if (r.date)
            realKeys.add(`${r.employeeId}|${(0, holiday_service_1.dhakaDayString)(new Date(r.date))}`);
    }
    const synthetic = [];
    for (let t = start.getTime(); t <= end.getTime(); t += DAY_MS) {
        const dayDate = new Date(t);
        const dayStr = (0, holiday_service_1.dhakaDayString)(dayDate);
        for (const emp of employees) {
            if (realKeys.has(`${emp.id}|${dayStr}`))
                continue;
            let status = null;
            if (holidaySet.has(dayStr))
                status = 'HOLIDAY';
            else if (leaveDaysByEmployee[emp.id]?.has(dayStr))
                status = 'LEAVE';
            else if ((0, holiday_service_1.isWeeklyHoliday)(dayStr, weeklyHolidayOf(emp)))
                status = 'WEEKEND';
            if (!status)
                status = 'ABSENT';
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
exports.mergeAttendanceWithCalendar = mergeAttendanceWithCalendar;
