"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getDashboard = void 0;
const database_1 = require("../config/database");
const holiday_service_1 = require("../services/holiday.service");
const settings_service_1 = require("../services/settings.service");
const DHAKA_OFFSET_MS = 6 * 3600 * 1000;
// Dhaka calendar day (YYYY-MM-DD) for a date.
const dhakaDay = (value) => {
    const local = new Date(value.getTime() + DHAKA_OFFSET_MS);
    const y = local.getUTCFullYear();
    const m = String(local.getUTCMonth() + 1).padStart(2, '0');
    const d = String(local.getUTCDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
};
const dayStartMs = (dateStr) => {
    const [y, m, d] = dateStr.split('-').map(Number);
    return Date.UTC(y, m - 1, d) - DHAKA_OFFSET_MS;
};
const getDashboard = async (req, res, next) => {
    try {
        const now = new Date();
        const todayStr = dhakaDay(now);
        // ----- Overview counts -----
        const [totalEmployees, activeEmployees, departmentsCount, openPositions, pendingLeave] = await database_1.prisma.$transaction([
            database_1.prisma.employee.count(),
            database_1.prisma.employee.count({ where: { status: 'ACTIVE' } }),
            database_1.prisma.department.count(),
            database_1.prisma.recruitment.count({ where: { status: 'OPEN' } }),
            database_1.prisma.leaveRequest.count({ where: { status: 'PENDING' } })
        ]);
        // ----- Today's attendance (04:00 Dhaka work day) -----
        const todayStart = new Date(dayStartMs(todayStr));
        const todayEnd = new Date(dayStartMs(todayStr) + 86400000 - 1);
        const todaysRecords = await database_1.prisma.attendance.findMany({
            where: {
                OR: [{ checkIn: { gte: todayStart, lte: todayEnd } }, { checkOut: { gte: todayStart, lte: todayEnd } }]
            },
            include: { employee: { select: { id: true, weeklyHoliday: true } } }
        });
        const activeEmployeesList = await database_1.prisma.employee.findMany({
            where: { status: 'ACTIVE' },
            select: { id: true, weeklyHoliday: true, departmentId: true, attendanceExempt: true }
        });
        const exemptIds = new Set(activeEmployeesList.filter((e) => e.attendanceExempt).map((e) => e.id));
        const isTodayHoliday = await (0, holiday_service_1.isMarkedHoliday)(todayStr);
        const todayByEmployee = new Map();
        todaysRecords.forEach((r) => {
            const empId = r.employeeId;
            const cur = todayByEmployee.get(empId);
            if (!cur || (cur.checkIn?.getTime() || 0) > (r.checkIn?.getTime() || 0))
                todayByEmployee.set(empId, r);
        });
        let expectedToday = 0;
        let weeklyHolidayToday = 0;
        let absentToday = 0;
        let presentToday = 0;
        let lateToday = 0;
        let earlyToday = 0;
        let holidayCountedToday = 0;
        for (const emp of activeEmployeesList) {
            if (emp.attendanceExempt)
                continue; // admin/co-founder staff do not punch
            if ((0, holiday_service_1.isWeeklyHoliday)(todayStr, emp.weeklyHoliday || 'FRIDAY')) {
                weeklyHolidayToday++;
                continue;
            }
            if (isTodayHoliday) {
                holidayCountedToday++;
                continue;
            }
            expectedToday++;
            const rec = todayByEmployee.get(emp.id);
            if (!rec) {
                absentToday++;
            }
            else if (rec.status === 'LATE') {
                lateToday++;
                presentToday++;
            }
            else if (rec.status === 'EARLY' || rec.status === 'PRESENT' || rec.status === 'HALF') {
                presentToday++;
                if (rec.status === 'EARLY')
                    earlyToday++;
            }
            else {
                absentToday++;
            }
        }
        const attendanceRateToday = expectedToday > 0 ? Math.round(((presentToday) / expectedToday) * 100) : 0;
        // ----- 30-day trend -----
        const trendDays = [];
        const trendStartMs = dayStartMs(todayStr) - 29 * 86400000;
        const trendRecords = await database_1.prisma.attendance.findMany({
            where: { date: { gte: new Date(trendStartMs) } },
            select: { employeeId: true, status: true, date: true }
        });
        const holidaySet30 = await database_1.prisma.holiday.findMany({
            where: { date: { gte: new Date(trendStartMs), lte: todayEnd } },
            select: { date: true }
        });
        const holidayStrSet = new Set(holidaySet30.map((h) => (0, holiday_service_1.dhakaDayString)(h.date)));
        for (let i = 0; i < 30; i++) {
            const dayStr = dhakaDay(new Date(dayStartMs(todayStr) - i * 86400000));
            const dayStart = new Date(dayStartMs(dayStr));
            const dayEnd = new Date(dayStartMs(dayStr) + 86400000 - 1);
            const dayRecords = trendRecords.filter((r) => r.date.getTime() >= dayStart.getTime() && r.date.getTime() <= dayEnd.getTime());
            let expected = 0;
            let absent = 0;
            let present = 0;
            let late = 0;
            let early = 0;
            const seen = new Set();
            if (!holidayStrSet.has(dayStr)) {
                for (const emp of activeEmployeesList) {
                    if (emp.attendanceExempt)
                        continue; // exempt staff not expected to punch
                    if ((0, holiday_service_1.isWeeklyHoliday)(dayStr, emp.weeklyHoliday || 'FRIDAY'))
                        continue;
                    expected++;
                }
            }
            for (const rec of dayRecords) {
                if (exemptIds.has(rec.employeeId))
                    continue;
                if (seen.has(rec.employeeId))
                    continue;
                seen.add(rec.employeeId);
                if (rec.status === 'LATE') {
                    late++;
                    present++;
                }
                else if (rec.status === 'EARLY' || rec.status === 'PRESENT' || rec.status === 'HALF') {
                    present++;
                    if (rec.status === 'EARLY')
                        early++;
                }
            }
            absent = Math.max(0, expected - seen.size);
            trendDays.push({ date: dayStr, present, late, early, absent, expected });
        }
        trendDays.reverse();
        // ----- Current month status distribution + calendar -----
        const nowUTC = new Date();
        const monthStart = new Date(Date.UTC(nowUTC.getUTCFullYear(), nowUTC.getUTCMonth(), 1) - DHAKA_OFFSET_MS);
        const monthEnd = new Date(Date.UTC(nowUTC.getUTCFullYear(), nowUTC.getUTCMonth() + 1, 1) - DHAKA_OFFSET_MS - 1);
        const monthRecords = await database_1.prisma.attendance.findMany({
            where: { date: { gte: monthStart, lte: monthEnd } },
            select: { status: true, overtimeHours: true, earlyOvertimeHours: true, employeeId: true, date: true }
        });
        const statusDistribution = {};
        let totalOvertimeHoursMonth = 0;
        monthRecords.forEach((r) => {
            if (exemptIds.has(r.employeeId))
                return;
            statusDistribution[r.status] = (statusDistribution[r.status] || 0) + 1;
            totalOvertimeHoursMonth += r.overtimeHours || 0;
            totalOvertimeHoursMonth += r.earlyOvertimeHours || 0;
        });
        // Calendar grid: one entry per Dhaka calendar day of the current month,
        // synced with attendance + holidays.
        const monthYear = nowUTC.getUTCFullYear();
        const monthNum = nowUTC.getUTCMonth() + 1;
        const holidaysThisMonth = await (0, holiday_service_1.getHolidaysForMonth)(monthYear, monthNum);
        const holidaySet = new Set(holidaysThisMonth.map((h) => (0, holiday_service_1.dhakaDayString)(h.date)));
        const holidayNameByDay = {};
        holidaysThisMonth.forEach((h) => {
            holidayNameByDay[(0, holiday_service_1.dhakaDayString)(h.date)] = h.name;
        });
        const daysInMonth = new Date(Date.UTC(monthYear, monthNum, 0)).getUTCDate();
        const calendar = [];
        for (let day = 1; day <= daysInMonth; day++) {
            const dayStr = `${monthYear}-${String(monthNum).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
            const dayStart = new Date(dayStartMs(dayStr));
            const dayEnd = new Date(dayStartMs(dayStr) + 86400000 - 1);
            const dayRecords = monthRecords.filter((r) => r.date.getTime() >= dayStart.getTime() && r.date.getTime() <= dayEnd.getTime());
            let expected = 0;
            let weeklyHolidayCount = 0;
            for (const emp of activeEmployeesList) {
                if (emp.attendanceExempt)
                    continue; // exempt staff not expected to punch
                if ((0, holiday_service_1.isWeeklyHoliday)(dayStr, emp.weeklyHoliday || 'FRIDAY')) {
                    weeklyHolidayCount++;
                }
                else {
                    expected++;
                }
            }
            const isHoliday = holidaySet.has(dayStr);
            if (isHoliday)
                expected = 0;
            let present = 0;
            let late = 0;
            let early = 0;
            const seen = new Set();
            for (const rec of dayRecords) {
                if (exemptIds.has(rec.employeeId))
                    continue;
                if (seen.has(rec.employeeId))
                    continue;
                seen.add(rec.employeeId);
                if (rec.status === 'LATE') {
                    late++;
                    present++;
                }
                else if (rec.status === 'EARLY' || rec.status === 'PRESENT' || rec.status === 'HALF') {
                    present++;
                    if (rec.status === 'EARLY')
                        early++;
                }
            }
            calendar.push({
                date: dayStr,
                weekday: ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][new Date(Date.UTC(monthYear, monthNum - 1, day)).getUTCDay()],
                isHoliday,
                holidayName: holidayNameByDay[dayStr],
                isWeeklyHoliday: weeklyHolidayCount === activeEmployeesList.length && activeEmployeesList.length > 0,
                weeklyHolidayCount,
                expected,
                present,
                late,
                early,
                absent: Math.max(0, expected - seen.size)
            });
        }
        // ----- Department breakdown (employees + today present) -----
        const departments = await database_1.prisma.department.findMany({
            include: {
                employees: {
                    where: { status: 'ACTIVE' },
                    select: { id: true, departmentId: true }
                }
            }
        });
        const departmentBreakdown = departments.map((d) => ({
            name: d.name,
            employeeCount: d.employees.length,
            presentToday: d.employees.filter((e) => {
                const rec = todayByEmployee.get(e.id);
                return rec && ['PRESENT', 'LATE', 'EARLY', 'HALF'].includes(rec.status);
            }).length
        }));
        // ----- Payroll this month -----
        const payrollRecords = await database_1.prisma.payroll.findMany({
            where: { payPeriodStart: { gte: monthStart, lte: monthEnd } }
        });
        const totalNetPay = payrollRecords.reduce((s, p) => s + Number(p.netPay || 0), 0);
        const totalOvertimePay = payrollRecords.reduce((s, p) => s + Number(p.overtimePay || 0), 0);
        // ----- Recent attendance -----
        const recentAttendance = await database_1.prisma.attendance.findMany({
            take: 10,
            orderBy: { date: 'desc' },
            where: { employee: { attendanceExempt: false } },
            include: {
                employee: {
                    select: {
                        id: true,
                        firstName: true,
                        lastName: true,
                        employeeId: true,
                        department: { select: { name: true } }
                    }
                }
            }
        });
        // ----- Leave summary this month -----
        const approvedLeaveDays = await database_1.prisma.leaveRequest.aggregate({
            where: { status: 'APPROVED', startDate: { lte: monthEnd }, endDate: { gte: monthStart } },
            _sum: { daysRequested: true }
        });
        const settings = await (0, settings_service_1.getPayrollSettings)();
        res.status(200).json({
            success: true,
            data: {
                overview: {
                    totalEmployees,
                    activeEmployees,
                    departmentsCount,
                    openPositions,
                    pendingLeave,
                    holidaysThisMonth: holidaysThisMonth.length
                },
                today: {
                    date: todayStr,
                    totalEmployees: activeEmployees,
                    expectedToday,
                    presentToday,
                    lateToday,
                    earlyToday,
                    absentToday,
                    weeklyHolidayToday,
                    isHoliday: isTodayHoliday,
                    attendanceRate: attendanceRateToday
                },
                trend: trendDays,
                statusDistribution,
                totalOvertimeHoursMonth: Math.round(totalOvertimeHoursMonth * 100) / 100,
                departmentBreakdown,
                payroll: {
                    month: `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, '0')}`,
                    recordCount: payrollRecords.length,
                    totalNetPay: Math.round(totalNetPay * 100) / 100,
                    totalOvertimePay: Math.round(totalOvertimePay * 100) / 100
                },
                approvedLeaveDays: approvedLeaveDays._sum.daysRequested || 0,
                holidays: holidaysThisMonth.map((h) => ({ id: h.id, date: (0, holiday_service_1.dhakaDayString)(h.date), name: h.name })),
                calendar,
                recentAttendance,
                settings
            }
        });
    }
    catch (error) {
        next(error);
    }
};
exports.getDashboard = getDashboard;
exports.default = { getDashboard: exports.getDashboard };
