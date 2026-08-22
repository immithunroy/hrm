"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getAttendanceStats = exports.getTodayAttendance = exports.deleteAttendanceRecord = exports.updateAttendanceRecord = exports.createAttendanceRecord = exports.getAttendanceById = exports.exportAttendance = exports.getAttendanceRecords = void 0;
const database_1 = require("../config/database");
const appError_1 = require("../utils/appError");
const export_service_1 = require("../services/export.service");
const zktService_1 = require("../services/zktService");
const attendanceMerge_service_1 = require("../services/attendanceMerge.service");
const holiday_service_1 = require("../services/holiday.service");
const DHAKA_OFFSET_MS = 6 * 3600 * 1000;
// Normalize a date filter value to a UTC instant. Bare YYYY-MM-DD values are
// interpreted as a Dhaka calendar day (start = 00:00 Dhaka, end = 23:59:59.999 Dhaka).
const normalizeDateBound = (value, isEnd) => {
    if (!value)
        return undefined;
    const s = String(value);
    if (/^\d{4}-\d{2}-\d{2}$/.test(s)) {
        const ms = Date.parse(s);
        if (isEnd)
            return new Date(ms + 86400000 - 1 - DHAKA_OFFSET_MS);
        return new Date(ms - DHAKA_OFFSET_MS);
    }
    return new Date(s);
};
// Shared attendance where-clause builder (list + export).
const buildAttendanceWhere = (query) => {
    const { employeeId, startDate, endDate, status, deviceId } = query;
    const where = {};
    if (employeeId)
        where.employeeId = employeeId;
    if (startDate || endDate) {
        const start = normalizeDateBound(startDate, false);
        const end = normalizeDateBound(endDate, true);
        // Match records whose date, check-in or check-out punch falls in the range
        // (status-only records have no punches, so match on the day itself too).
        where.OR = [
            { date: { ...(start ? { gte: start } : {}), ...(end ? { lte: end } : {}) } },
            { checkIn: { ...(start ? { gte: start } : {}), ...(end ? { lte: end } : {}) } },
            { checkOut: { ...(start ? { gte: start } : {}), ...(end ? { lte: end } : {}) } }
        ];
    }
    if (status)
        where.status = status;
    if (deviceId)
        where.deviceId = deviceId;
    return where;
};
/**
 * Get attendance records with filtering and pagination
 */
const getAttendanceRecords = async (req, res, next) => {
    try {
        const { page = 1, limit = 50, } = req.query;
        const skip = (parseInt(page) - 1) * parseInt(limit);
        const take = parseInt(limit);
        const where = buildAttendanceWhere(req.query);
        const startBound = normalizeDateBound(req.query.startDate, false);
        const endBound = normalizeDateBound(req.query.endDate, true);
        // When a date range is present we merge in real + synthetic (HOLIDAY/LEAVE/
        // WEEKEND) rows and paginate in memory. Without a range we paginate in SQL.
        if (startBound && endBound) {
            const allRecords = await database_1.prisma.attendance.findMany({
                where,
                include: {
                    employee: {
                        select: {
                            id: true,
                            firstName: true,
                            lastName: true,
                            employeeId: true
                        }
                    }
                },
                orderBy: [{ date: 'asc' }, { checkIn: 'asc' }]
            });
            const merged = await (0, attendanceMerge_service_1.mergeAttendanceWithCalendar)(allRecords, {
                start: startBound,
                end: endBound,
                employeeId: req.query.employeeId
            });
            merged.sort((a, b) => {
                const da = new Date(a.date).getTime();
                const db = new Date(b.date).getTime();
                if (da !== db)
                    return da - db;
                const ia = a.checkIn ? new Date(a.checkIn).getTime() : Number.MAX_SAFE_INTEGER;
                const ib = b.checkIn ? new Date(b.checkIn).getTime() : Number.MAX_SAFE_INTEGER;
                return ia - ib;
            });
            const totalCount = merged.length;
            const attendanceRecords = merged.slice(skip, skip + take);
            return res.status(200).json({
                success: true,
                data: {
                    attendanceRecords,
                    pagination: {
                        page: parseInt(page),
                        limit: parseInt(limit),
                        total: totalCount,
                        totalPages: Math.ceil(totalCount / parseInt(limit))
                    }
                }
            });
        }
        const [attendanceRecords, totalCount] = await database_1.prisma.$transaction([
            database_1.prisma.attendance.findMany({
                where,
                include: {
                    employee: {
                        select: {
                            id: true,
                            firstName: true,
                            lastName: true,
                            employeeId: true
                        }
                    }
                },
                skip,
                take,
                orderBy: [{ date: 'asc' }, { checkIn: 'asc' }]
            }),
            database_1.prisma.attendance.count({ where })
        ]);
        res.status(200).json({
            success: true,
            data: {
                attendanceRecords,
                pagination: {
                    page: parseInt(page),
                    limit: parseInt(limit),
                    total: totalCount,
                    totalPages: Math.ceil(totalCount / parseInt(limit))
                }
            }
        });
    }
    catch (error) {
        next(error);
    }
};
exports.getAttendanceRecords = getAttendanceRecords;
/**
 * Export attendance sheet as xlsx or pdf (with leave summary)
 */
const exportAttendance = async (req, res, next) => {
    try {
        const format = String(req.query.format || 'xlsx').toLowerCase();
        const where = buildAttendanceWhere(req.query);
        const records = await database_1.prisma.attendance.findMany({
            where,
            include: {
                employee: {
                    select: {
                        id: true,
                        firstName: true,
                        lastName: true,
                        employeeId: true,
                        department: { select: { name: true } },
                        salary: true
                    }
                }
            },
            orderBy: [{ date: 'asc' }, { checkIn: 'asc' }]
        });
        const merged = await (0, attendanceMerge_service_1.mergeAttendanceWithCalendar)(records, {
            start: normalizeDateBound(req.query.startDate, false),
            end: normalizeDateBound(req.query.endDate, true),
            employeeId: req.query.employeeId
        });
        // Ensure date ascending order after merge
        merged.sort((a, b) => {
            const da = new Date(a.date).getTime();
            const db = new Date(b.date).getTime();
            if (da !== db)
                return da - db;
            const ia = a.checkIn ? new Date(a.checkIn).getTime() : 0;
            const ib = b.checkIn ? new Date(b.checkIn).getTime() : 0;
            return ia - ib;
        });
        const rows = merged.map((r) => ({
            employee: {
                ...r.employee,
                salary: r.employee?.salary
            },
            date: r.date,
            checkIn: r.checkIn,
            checkOut: r.checkOut,
            workHours: r.workHours,
            overtimeHours: r.overtimeHours,
            earlyOvertimeHours: r.earlyOvertimeHours,
            lateMinutes: r.lateMinutes,
            earlyDepartureMinutes: r.earlyDepartureMinutes,
            breakMinutes: r.breakMinutes,
            errandCount: r.errandCount,
            autoCheckOut: r.autoCheckOut,
            status: r.status
        }));
        // Fetch payroll settings
        const settings = await database_1.prisma.systemSetting.findMany({
            where: {
                key: { in: ['overtimeRate', 'holidayOvertimeRate', 'workingDaysPerMonth', 'workingHoursPerDay', 'currency'] }
            }
        });
        const settingsMap = Object.fromEntries(settings.map(s => [s.key, s.value]));
        const payrollSettings = {
            overtimeRate: parseFloat(settingsMap.overtimeRate || '1.5'),
            holidayOvertimeRate: parseFloat(settingsMap.holidayOvertimeRate || '2.0'),
            workingDaysPerMonth: parseInt(settingsMap.workingDaysPerMonth || '26', 10),
            workingHoursPerDay: parseInt(settingsMap.workingHoursPerDay || '9', 10),
            currency: settingsMap.currency || 'BDT'
        };
        const year = new Date().getFullYear();
        const leaveByEmployee = {};
        for (const eid of new Set(records.map((r) => r.employee?.employeeId).filter(Boolean))) {
            const emp = records.find((r) => r.employee?.employeeId === eid)?.employee;
            if (emp?.id)
                leaveByEmployee[eid] = await (0, export_service_1.getLeaveSummary)(emp.id, year);
        }
        const startLabel = req.query.startDate ? (0, export_service_1.fmtDhakaDate)(normalizeDateBound(req.query.startDate, false)) : 'All';
        const endLabel = req.query.endDate ? (0, export_service_1.fmtDhakaDate)(normalizeDateBound(req.query.endDate, true)) : 'All';
        const title = `Attendance Report (${startLabel} - ${endLabel})`;
        const filename = `attendance-${startLabel}-${endLabel}`.replace(/[^a-zA-Z0-9_-]/g, '');
        if (format === 'pdf') {
            const buffer = await (0, export_service_1.buildAttendancePdf)(rows, title, leaveByEmployee, payrollSettings);
            res.setHeader('Content-Type', 'application/pdf');
            res.setHeader('Content-Disposition', `attachment; filename="${filename}.pdf"`);
            return res.send(buffer);
        }
        const buffer = await (0, export_service_1.buildAttendanceWorkbook)(rows, title, leaveByEmployee, payrollSettings);
        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', `attachment; filename="${filename}.xlsx"`);
        return res.send(buffer);
    }
    catch (error) {
        next(error);
    }
};
exports.exportAttendance = exportAttendance;
/**
 * Get attendance record by ID
 */
const getAttendanceById = async (req, res, next) => {
    try {
        const { id } = req.params;
        const attendance = await database_1.prisma.attendance.findUnique({
            where: { id },
            include: {
                employee: {
                    select: {
                        id: true,
                        firstName: true,
                        lastName: true,
                        employeeId: true
                    }
                }
            }
        });
        if (!attendance) {
            return next(new appError_1.AppError('Attendance record not found', 404));
        }
        res.status(200).json({
            success: true,
            data: attendance
        });
    }
    catch (error) {
        next(error);
    }
};
exports.getAttendanceById = getAttendanceById;
/**
 * Create attendance record (manual entry). Admin provides employeeId, a Dhaka
 * date (YYYY-MM-DD) and optional in/out times; the daily summary is computed.
 */
const createAttendanceRecord = async (req, res, next) => {
    try {
        const { employeeId, date, checkIn, checkOut, breakMinutes, status } = req.body;
        const employee = await database_1.prisma.employee.findUnique({ where: { id: employeeId } });
        if (!employee)
            return next(new appError_1.AppError('Employee not found', 404));
        if (!date)
            return next(new appError_1.AppError('date is required (YYYY-MM-DD)', 400));
        // Check for an existing record for the same employee + day
        const existingAttendance = await database_1.prisma.attendance.findFirst({
            where: { employeeId, date: (0, holiday_service_1.dhakaDayStart)(date) }
        });
        if (existingAttendance) {
            return next(new appError_1.AppError('Attendance record already exists for this date', 400));
        }
        // Status-only records (LEAVE / ABSENT / HOLIDAY / WEEKEND / HALF) have no
        // punches and are written directly; otherwise compute the daily summary.
        if (status && !checkIn && !checkOut) {
            const attendance = await database_1.prisma.attendance.create({
                data: {
                    employeeId,
                    date: (0, holiday_service_1.dhakaDayStart)(date),
                    status,
                    workHours: 0,
                    overtimeHours: 0,
                    earlyOvertimeHours: 0,
                    breakMinutes: Number(breakMinutes) || 0,
                    errandCount: 0,
                    punches: [],
                    autoCheckOut: false,
                    deviceId: 'MANUAL'
                }
            });
            return res.status(201).json({ success: true, data: attendance });
        }
        const summary = await (0, zktService_1.computeManualAttendance)(date, checkIn ? new Date(checkIn).toISOString() : undefined, checkOut ? new Date(checkOut).toISOString() : undefined, breakMinutes || 0);
        const attendance = await database_1.prisma.attendance.create({
            data: {
                ...summary,
                ...(status ? { status } : {}),
                employeeId,
                deviceId: 'MANUAL'
            }
        });
        res.status(201).json({ success: true, data: attendance });
    }
    catch (error) {
        next(error);
    }
};
exports.createAttendanceRecord = createAttendanceRecord;
/**
 * Update attendance record (manual adjustment). If in/out times change, the
 * daily summary is recomputed from the provided values.
 */
const updateAttendanceRecord = async (req, res, next) => {
    try {
        const { id } = req.params;
        const updateData = req.body;
        const attendance = await database_1.prisma.attendance.findUnique({ where: { id } });
        if (!attendance)
            return next(new appError_1.AppError('Attendance record not found', 404));
        // Recompute when a date or in/out times are provided.
        const hasPunchChange = updateData.date || updateData.checkIn || updateData.checkOut || updateData.breakMinutes != null;
        let summaryData = {};
        if (hasPunchChange) {
            const dateStr = updateData.date || attendance.date.toISOString().slice(0, 10);
            const checkIn = updateData.checkIn ? new Date(updateData.checkIn).toISOString() : attendance.checkIn?.toISOString();
            const checkOut = updateData.checkOut ? new Date(updateData.checkOut).toISOString() : attendance.checkOut?.toISOString();
            const breakMinutes = updateData.breakMinutes != null ? updateData.breakMinutes : attendance.breakMinutes || 0;
            summaryData = await (0, zktService_1.computeManualAttendance)(dateStr, checkIn, checkOut, breakMinutes);
        }
        const { date, checkIn: ci, checkOut: co, breakMinutes: bm, ...safeUpdates } = updateData;
        const updatedAttendance = await database_1.prisma.attendance.update({
            where: { id },
            data: {
                ...(hasPunchChange ? summaryData : {}),
                ...safeUpdates
            }
        });
        res.status(200).json({ success: true, data: updatedAttendance });
    }
    catch (error) {
        next(error);
    }
};
exports.updateAttendanceRecord = updateAttendanceRecord;
/**
 * Delete attendance record
 */
const deleteAttendanceRecord = async (req, res, next) => {
    try {
        const { id } = req.params;
        // Check if attendance record exists
        const attendance = await database_1.prisma.attendance.findUnique({
            where: { id }
        });
        if (!attendance) {
            return next(new appError_1.AppError('Attendance record not found', 404));
        }
        await database_1.prisma.attendance.delete({
            where: { id }
        });
        res.status(200).json({
            success: true,
            message: 'Attendance record deleted successfully'
        });
    }
    catch (error) {
        next(error);
    }
};
exports.deleteAttendanceRecord = deleteAttendanceRecord;
/**
 * Get today's attendance
 */
const getTodayAttendance = async (req, res, next) => {
    try {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const tomorrow = new Date(today);
        tomorrow.setDate(tomorrow.getDate() + 1);
        const attendanceRecords = await database_1.prisma.attendance.findMany({
            where: {
                checkIn: {
                    gte: today,
                    lt: tomorrow
                }
            },
            include: {
                employee: {
                    select: {
                        id: true,
                        firstName: true,
                        lastName: true,
                        employeeId: true,
                        department: {
                            select: {
                                name: true
                            }
                        }
                    }
                }
            },
            orderBy: { checkIn: 'asc' }
        });
        // Calculate statistics
        const totalEmployees = await database_1.prisma.employee.count({
            where: { status: 'ACTIVE' }
        });
        const presentCount = attendanceRecords.filter(r => r.status === 'PRESENT' || r.status === 'LATE').length;
        const lateCount = attendanceRecords.filter(r => r.status === 'LATE').length;
        const absentCount = totalEmployees - presentCount;
        res.status(200).json({
            success: true,
            data: {
                attendanceRecords,
                statistics: {
                    totalEmployees,
                    presentCount,
                    absentCount,
                    lateCount,
                    attendanceRate: totalEmployees > 0 ? (presentCount / totalEmployees) * 100 : 0
                }
            }
        });
    }
    catch (error) {
        next(error);
    }
};
exports.getTodayAttendance = getTodayAttendance;
/**
 * Get attendance statistics
 */
const getAttendanceStats = async (req, res, next) => {
    try {
        const { startDate, endDate } = req.query;
        // Build date filter
        const dateFilter = {};
        if (startDate)
            dateFilter.gte = new Date(startDate);
        if (endDate)
            dateFilter.lte = new Date(endDate);
        const where = startDate || endDate ? { date: dateFilter } : {};
        const attendanceRecords = await database_1.prisma.attendance.findMany({
            where,
            include: {
                employee: {
                    select: {
                        department: {
                            select: {
                                name: true
                            }
                        }
                    }
                }
            }
        });
        // Calculate statistics
        const totalRecords = attendanceRecords.length;
        const presentCount = attendanceRecords.filter(r => r.status === 'PRESENT' || r.status === 'LATE').length;
        const lateCount = attendanceRecords.filter(r => r.status === 'LATE').length;
        const absentCount = attendanceRecords.filter(r => r.status === 'ABSENT').length;
        const halfDayCount = attendanceRecords.filter(r => r.status === 'HALF').length;
        // Group by department
        const deptStats = {};
        attendanceRecords.forEach(record => {
            const deptName = record.employee.department?.name || 'Unknown';
            if (!deptStats[deptName]) {
                deptStats[deptName] = { total: 0, present: 0, absent: 0, late: 0 };
            }
            deptStats[deptName].total++;
            if (record.status === 'PRESENT' || record.status === 'LATE') {
                deptStats[deptName].present++;
            }
            if (record.status === 'ABSENT') {
                deptStats[deptName].absent++;
            }
            if (record.status === 'LATE') {
                deptStats[deptName].late++;
            }
        });
        res.status(200).json({
            success: true,
            data: {
                statistics: {
                    totalRecords,
                    presentCount,
                    absentCount,
                    lateCount,
                    halfDayCount,
                    attendanceRate: totalRecords > 0 ? (presentCount / totalRecords) * 100 : 0
                },
                departmentBreakdown: deptStats
            }
        });
    }
    catch (error) {
        next(error);
    }
};
exports.getAttendanceStats = getAttendanceStats;
exports.default = {
    getAttendanceRecords: exports.getAttendanceRecords,
    getAttendanceById: exports.getAttendanceById,
    createAttendanceRecord: exports.createAttendanceRecord,
    updateAttendanceRecord: exports.updateAttendanceRecord,
    deleteAttendanceRecord: exports.deleteAttendanceRecord,
    getTodayAttendance: exports.getTodayAttendance,
    getAttendanceStats: exports.getAttendanceStats,
    exportAttendance: exports.exportAttendance
};
