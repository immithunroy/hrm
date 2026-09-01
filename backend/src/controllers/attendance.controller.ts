import { Request, Response, NextFunction } from 'express';
import { prisma } from '../config/database';
import { AppError } from '../utils/appError';
import { z } from 'zod';
import { buildAttendancePdf, buildAttendanceWorkbook, getLeaveSummary, AttendanceExportRow, fmtDhakaDate, PayrollSettings } from '../services/export.service';
import { computeManualAttendance } from '../services/zktService';
import { mergeAttendanceWithCalendar } from '../services/attendanceMerge.service';
import { dhakaDayStart } from '../services/holiday.service';

const DHAKA_OFFSET_MS = 6 * 3600 * 1000;

/** Build a Date representing midnight in Dhaka (UTC-6). */
const dhakaMidnight = (y: number, m: number, d: number): Date =>
  new Date(Date.UTC(y, m, d) - DHAKA_OFFSET_MS);

// Normalize a date filter value to a UTC instant. Bare YYYY-MM-DD values are
// interpreted as a Dhaka calendar day (start = 00:00 Dhaka, end = 23:59:59.999 Dhaka).
const normalizeDateBound = (value: string | undefined, isEnd: boolean): Date | undefined => {
  if (!value) return undefined;
  const s = String(value);
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) {
    const ms = Date.parse(s);
    if (isEnd) return new Date(ms + 86400000 - 1 - DHAKA_OFFSET_MS);
    return new Date(ms - DHAKA_OFFSET_MS);
  }
  return new Date(s);
};

// Shared attendance where-clause builder (list + export).
const buildAttendanceWhere = (query: any) => {
  const {
    employeeId,
    startDate,
    endDate,
    status,
    deviceId
  } = query;

  const where: any = {};

  if (employeeId) where.employeeId = employeeId as string;
  if (startDate || endDate) {
    const start = normalizeDateBound(startDate as string, false);
    const end = normalizeDateBound(endDate as string, true);
    // Match records whose date, check-in or check-out punch falls in the range
    // (status-only records have no punches, so match on the day itself too).
    where.OR = [
      { date: { ...(start ? { gte: start } : {}), ...(end ? { lte: end } : {}) } },
      { checkIn: { ...(start ? { gte: start } : {}), ...(end ? { lte: end } : {}) } },
      { checkOut: { ...(start ? { gte: start } : {}), ...(end ? { lte: end } : {}) } }
    ];
  }
  if (status) where.status = status as string;
  if (deviceId) where.deviceId = deviceId as string;

  return where;
};

/**
 * Get attendance records with filtering and pagination
 */
export const getAttendanceRecords = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const {
      page = 1,
      limit = 50,
    } = req.query;

    const skip = (parseInt(page as string) - 1) * parseInt(limit as string);
    const take = parseInt(limit as string);

    const query = { ...req.query };
    // EMPLOYEE role can only see their own attendance
    if (req.userRole === 'EMPLOYEE') {
      query.employeeId = req.userId!;
    }
    const where = buildAttendanceWhere(query);

    const startBound = normalizeDateBound(req.query.startDate as string, false);
    const endBound = normalizeDateBound(req.query.endDate as string, true);

    // When a date range is present we merge in real + synthetic (HOLIDAY/LEAVE/
    // WEEKEND) rows and paginate in memory. Without a range we paginate in SQL.
    if (startBound && endBound) {
      const allRecords = await prisma.attendance.findMany({
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

      const merged = await mergeAttendanceWithCalendar(allRecords, {
        start: startBound,
        end: endBound,
      employeeId: (query.employeeId as string) || undefined
      });

      merged.sort((a, b) => {
        const da = new Date(a.date).getTime();
        const db = new Date(b.date).getTime();
        if (da !== db) return da - db;
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
            page: parseInt(page as string),
            limit: parseInt(limit as string),
            total: totalCount,
            totalPages: Math.ceil(totalCount / parseInt(limit as string))
          }
        }
      });
    }

    const [attendanceRecords, totalCount] = await prisma.$transaction([
      prisma.attendance.findMany({
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
      prisma.attendance.count({ where })
    ]);

    res.status(200).json({
      success: true,
      data: {
        attendanceRecords,
        pagination: {
          page: parseInt(page as string),
          limit: parseInt(limit as string),
          total: totalCount,
          totalPages: Math.ceil(totalCount / parseInt(limit as string))
        }
      }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Export attendance sheet as xlsx or pdf (with leave summary)
 */
export const exportAttendance = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const format = String(req.query.format || 'xlsx').toLowerCase();
    const query = { ...req.query };
    // EMPLOYEE role can only export their own attendance
    if (req.userRole === 'EMPLOYEE') {
      query.employeeId = req.userId!;
    }
    const where = buildAttendanceWhere(query);

    const isEmployee = req.userRole === 'EMPLOYEE';
    const records = await prisma.attendance.findMany({
      where,
      include: {
        employee: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            employeeId: true,
            department: { select: { name: true } },
            // EMPLOYEE role should not see salary info in exports.
            ...(isEmployee ? {} : { salary: true })
          }
        }
      },
      orderBy: [{ date: 'asc' }, { checkIn: 'asc' }]
    });

    const merged = await mergeAttendanceWithCalendar(records, {
      start: normalizeDateBound(req.query.startDate as string, false),
      end: normalizeDateBound(req.query.endDate as string, true),
      employeeId: req.query.employeeId as string | undefined
    });

    // Ensure date ascending order after merge
    merged.sort((a, b) => {
      const da = new Date(a.date).getTime();
      const db = new Date(b.date).getTime();
      if (da !== db) return da - db;
      const ia = a.checkIn ? new Date(a.checkIn).getTime() : 0;
      const ib = b.checkIn ? new Date(b.checkIn).getTime() : 0;
      return ia - ib;
    });

    const rows: AttendanceExportRow[] = merged.map((r: any) => ({
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
    const settings = await prisma.systemSetting.findMany({
      where: {
        key: { in: ['overtimeRate', 'holidayOvertimeRate', 'workingDaysPerMonth', 'workingHoursPerDay', 'currency'] }
      }
    });
    const settingsMap = Object.fromEntries(settings.map(s => [s.key, s.value]));
    const payrollSettings: PayrollSettings = {
      overtimeRate: parseFloat(settingsMap.overtimeRate || '1.5'),
      holidayOvertimeRate: parseFloat(settingsMap.holidayOvertimeRate || '2.0'),
      workingDaysPerMonth: parseInt(settingsMap.workingDaysPerMonth || '26', 10),
      workingHoursPerDay: parseInt(settingsMap.workingHoursPerDay || '9', 10),
      currency: settingsMap.currency || 'BDT'
    };

    const year = new Date().getFullYear();
    const leaveByEmployee: Record<string, any> = {};
    for (const eid of new Set(records.map((r) => r.employee?.employeeId).filter(Boolean) as string[])) {
      const emp = records.find((r) => r.employee?.employeeId === eid)?.employee;
      if (emp?.id) leaveByEmployee[eid] = await getLeaveSummary(emp.id, year);
    }

    const startLabel = req.query.startDate ? fmtDhakaDate(normalizeDateBound(req.query.startDate as string, false)) : 'All';
    const endLabel = req.query.endDate ? fmtDhakaDate(normalizeDateBound(req.query.endDate as string, true)) : 'All';
    const title = `Attendance Report (${startLabel} - ${endLabel})`;

    const filename = `attendance-${startLabel}-${endLabel}`.replace(/[^a-zA-Z0-9_-]/g, '');

    if (format === 'pdf') {
      const buffer = await buildAttendancePdf(rows, title, leaveByEmployee, payrollSettings);
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}.pdf"`);
      return res.send(buffer);
    }

    const buffer = await buildAttendanceWorkbook(rows, title, leaveByEmployee, payrollSettings);
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}.xlsx"`);
    return res.send(buffer);
  } catch (error) {
    next(error);
  }
};

/**
 * Get attendance record by ID
 */
export const getAttendanceById = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;

    const attendance = await prisma.attendance.findUnique({
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
      return next(new AppError('Attendance record not found', 404));
    }

    // EMPLOYEE role can only view their own attendance record
    if (req.userRole === 'EMPLOYEE' && attendance.employeeId !== req.userId) {
      return next(new AppError('Access denied', 403));
    }

    res.status(200).json({
      success: true,
      data: attendance
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Create attendance record (manual entry). Admin provides employeeId, a Dhaka
 * date (YYYY-MM-DD) and optional in/out times; the daily summary is computed.
 */
export const createAttendanceRecord = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { employeeId, date, checkIn, checkOut, breakMinutes, status } = req.body;

    const employee = await prisma.employee.findUnique({ where: { id: employeeId } });
    if (!employee) return next(new AppError('Employee not found', 404));
    if (!date) return next(new AppError('date is required (YYYY-MM-DD)', 400));

    // Check for an existing record for the same employee + day
    const existingAttendance = await prisma.attendance.findFirst({
      where: { employeeId, date: dhakaDayStart(date) }
    });
    if (existingAttendance) {
      return next(new AppError('Attendance record already exists for this date', 400));
    }

    // Status-only records (LEAVE / ABSENT / HOLIDAY / WEEKEND / HALF) have no
    // punches and are written directly; otherwise compute the daily summary.
    if (status && !checkIn && !checkOut) {
      const attendance = await prisma.attendance.create({
        data: {
          employeeId,
          date: dhakaDayStart(date),
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

    const summary = await computeManualAttendance(
      date,
      checkIn ? new Date(checkIn).toISOString() : undefined,
      checkOut ? new Date(checkOut).toISOString() : undefined,
      breakMinutes || 0
    );

    const attendance = await prisma.attendance.create({
      data: {
        ...summary,
        ...(status ? { status } : {}),
        employeeId,
        deviceId: 'MANUAL'
      }
    });

    res.status(201).json({ success: true, data: attendance });
  } catch (error) {
    next(error);
  }
};

/**
 * Update attendance record (manual adjustment). If in/out times change, the
 * daily summary is recomputed from the provided values.
 */
export const updateAttendanceRecord = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const updateData = req.body;

    const attendance = await prisma.attendance.findUnique({ where: { id } });
    if (!attendance) return next(new AppError('Attendance record not found', 404));

    // Recompute when a date or in/out times are provided.
    const hasPunchChange =
      updateData.date || updateData.checkIn || updateData.checkOut || updateData.breakMinutes != null;
    let summaryData: any = {};
    if (hasPunchChange) {
      const dateStr = updateData.date || attendance.date.toISOString().slice(0, 10);
      const checkIn = updateData.checkIn ? new Date(updateData.checkIn).toISOString() : attendance.checkIn?.toISOString();
      const checkOut = updateData.checkOut ? new Date(updateData.checkOut).toISOString() : attendance.checkOut?.toISOString();
      const breakMinutes = updateData.breakMinutes != null ? updateData.breakMinutes : attendance.breakMinutes || 0;
      summaryData = await computeManualAttendance(dateStr, checkIn, checkOut, breakMinutes);
    }

    const { date, checkIn: ci, checkOut: co, breakMinutes: bm, ...safeUpdates } = updateData;
    const updatedAttendance = await prisma.attendance.update({
      where: { id },
      data: {
        ...(hasPunchChange ? summaryData : {}),
        ...safeUpdates
      }
    });

    res.status(200).json({ success: true, data: updatedAttendance });
  } catch (error) {
    next(error);
  }
};

/**
 * Delete attendance record
 */
export const deleteAttendanceRecord = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;

    // Check if attendance record exists
    const attendance = await prisma.attendance.findUnique({
      where: { id }
    });

    if (!attendance) {
      return next(new AppError('Attendance record not found', 404));
    }

    await prisma.attendance.delete({
      where: { id }
    });

    res.status(200).json({
      success: true,
      message: 'Attendance record deleted successfully'
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get today's attendance
 */
export const getTodayAttendance = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const whereCondition: any = {
      checkIn: {
        gte: today,
        lt: tomorrow
      }
    };
    // EMPLOYEE role can only see their own attendance
    if (req.userRole === 'EMPLOYEE') {
      whereCondition.employeeId = req.userId!;
    }

    const attendanceRecords = await prisma.attendance.findMany({
      where: whereCondition,
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
    const totalEmployees = await prisma.employee.count({
      where: { status: 'ACTIVE' }
    });
    
    const presentCount = attendanceRecords.filter(r => 
      r.status === 'PRESENT' || r.status === 'LATE'
    ).length;
    
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
  } catch (error) {
    next(error);
  }
};

/**
 * Get attendance statistics
 */
export const getAttendanceStats = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { startDate, endDate } = req.query;
    
    // Build date filter
    const dateFilter: any = {};
    if (startDate) dateFilter.gte = new Date(startDate as string);
    if (endDate) dateFilter.lte = new Date(endDate as string);
    
    const where: any = startDate || endDate ? { date: dateFilter } : {};
    // EMPLOYEE role can only see their own attendance stats
    if (req.userRole === 'EMPLOYEE') {
      where.employeeId = req.userId!;
    }

    const attendanceRecords = await prisma.attendance.findMany({
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
    const presentCount = attendanceRecords.filter(r => 
      r.status === 'PRESENT' || r.status === 'LATE'
    ).length;
    
    const lateCount = attendanceRecords.filter(r => r.status === 'LATE').length;
    const absentCount = attendanceRecords.filter(r => r.status === 'ABSENT').length;
    const halfDayCount = attendanceRecords.filter(r => r.status === 'HALF').length;

    // Group by department
    const deptStats: Record<string, any> = {};
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
  } catch (error) {
    next(error);
  }
};

/**
 * Mobile check-in (employee self-service)
 */
export const mobileCheckIn = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const employeeId = req.userId!;
    if (!employeeId) return next(new AppError('Unauthorized', 401));

    // Get today's date in Dhaka time (YYYY-MM-DD)
    const now = new Date();
    const dhakaMs = now.getTime() + 6 * 3600 * 1000;
    const todayStr = new Date(dhakaMs).toISOString().slice(0, 10);

    // Check if already checked in today
    const todayStart = dhakaMidnight(
      ...todayStr.split('-').map(Number) as [number, number, number]
    );
    const todayEnd = new Date(todayStart.getTime() + 86400000);

    const existing = await prisma.attendance.findFirst({
      where: {
        employeeId,
        OR: [
          { date: { gte: todayStart, lt: todayEnd } },
          { checkIn: { gte: todayStart, lt: todayEnd } }
        ]
      }
    });

    if (existing && existing.checkIn) {
      return next(new AppError('Already checked in today', 400));
    }

    // Use computeManualAttendance for proper shift-aware computation.
    const checkInISO = now.toISOString();
    const summary = await computeManualAttendance(todayStr, checkInISO);

    let attendance;
    if (existing) {
      // Update existing status-only record
      attendance = await prisma.attendance.update({
        where: { id: existing.id },
        data: {
          checkIn: now,
          status: summary.status,
          lateMinutes: summary.lateMinutes,
          deviceId: 'MOBILE',
          punches: summary.punches.map((p: number) => new Date(p).toISOString())
        }
      });
    } else {
      // Create new attendance record
      attendance = await prisma.attendance.create({
        data: {
          employeeId,
          checkIn: now,
          date: todayStart,
          status: summary.status,
          workHours: 0,
          overtimeHours: 0,
          earlyOvertimeHours: 0,
          lateMinutes: summary.lateMinutes,
          earlyDepartureMinutes: 0,
          breakMinutes: 0,
          errandCount: 0,
          punches: summary.punches.map((p: number) => new Date(p).toISOString()),
          autoCheckOut: false,
          deviceId: 'MOBILE'
        }
      });
    }

    res.status(200).json({
      success: true,
      data: {
        attendance,
        message: `Checked in at ${now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true, timeZone: 'Asia/Dhaka' })}`
      }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Mobile check-out (employee self-service)
 */
export const mobileCheckOut = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const employeeId = req.userId!;
    if (!employeeId) return next(new AppError('Unauthorized', 401));

    // Find today's attendance record (Dhaka time)
    const now = new Date();
    const dhakaMs = now.getTime() + 6 * 3600 * 1000;
    const todayStr = new Date(dhakaMs).toISOString().slice(0, 10);
    const todayStart = dhakaMidnight(
      ...todayStr.split('-').map(Number) as [number, number, number]
    );
    const todayEnd = new Date(todayStart.getTime() + 86400000);

    const attendance = await prisma.attendance.findFirst({
      where: {
        employeeId,
        OR: [
          { date: { gte: todayStart, lt: todayEnd } },
          { checkIn: { gte: todayStart, lt: todayEnd } }
        ]
      }
    });

    if (!attendance) {
      return next(new AppError('No check-in record found for today', 400));
    }

    if (attendance.checkOut) {
      return next(new AppError('Already checked out today', 400));
    }

    if (!attendance.checkIn) {
      return next(new AppError('Cannot check out without checking in first', 400));
    }

    // Use computeManualAttendance for proper shift-aware computation.
    const checkInISO = attendance.checkIn.toISOString();
    const checkOutISO = now.toISOString();
    const summary = await computeManualAttendance(todayStr, checkInISO, checkOutISO);

    // Update punches
    const punches = Array.isArray(attendance.punches) ? [...attendance.punches] : [];
    punches.push(now.toISOString());

    const updated = await prisma.attendance.update({
      where: { id: attendance.id },
      data: {
        checkOut: now,
        status: summary.status,
        workHours: summary.workHours,
        overtimeHours: summary.overtimeHours,
        earlyOvertimeHours: summary.earlyOvertimeHours,
        lateMinutes: summary.lateMinutes,
        earlyDepartureMinutes: summary.earlyDepartureMinutes,
        breakMinutes: summary.breakMinutes,
        punches
      }
    });

    res.status(200).json({
      success: true,
      data: {
        attendance: updated,
        message: `Checked out at ${now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true, timeZone: 'Asia/Dhaka' })}. Work hours: ${summary.workHours}`
      }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get my attendance (employee self-service) — merges with full calendar
 */
export const getMyAttendance = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const employeeId = req.userId!;
    if (!employeeId) return next(new AppError('Unauthorized', 401));

    const { startDate, endDate, page = 1, limit = 30 } = req.query;
    const startBound = normalizeDateBound(startDate as string, false);
    const endBound = normalizeDateBound(endDate as string, true);

    // When a date range is provided, merge with full calendar (every day of month).
    if (startBound && endBound) {
      const where: any = {
        employeeId,
        OR: [
          { date: { gte: startBound, lte: endBound } },
          { checkIn: { gte: startBound, lte: endBound } }
        ]
      };

      const allRecords = await prisma.attendance.findMany({
        where,
        orderBy: [{ date: 'asc' }, { checkIn: 'asc' }]
      });

      const merged = await mergeAttendanceWithCalendar(allRecords, {
        start: startBound,
        end: endBound,
        employeeId
      });

      merged.sort((a, b) => {
        const da = new Date(a.date).getTime();
        const db = new Date(b.date).getTime();
        if (da !== db) return da - db;
        const ia = a.checkIn ? new Date(a.checkIn).getTime() : Number.MAX_SAFE_INTEGER;
        const ib = b.checkIn ? new Date(b.checkIn).getTime() : Number.MAX_SAFE_INTEGER;
        return ia - ib;
      });

      const totalCount = merged.length;
      const skip = (parseInt(page as string) - 1) * parseInt(limit as string);
      const take = parseInt(limit as string);
      const attendanceRecords = merged.slice(skip, skip + take);

      return res.status(200).json({
        success: true,
        data: {
          attendanceRecords,
          pagination: {
            page: parseInt(page as string),
            limit: take,
            total: totalCount,
            totalPages: Math.ceil(totalCount / take)
          }
        }
      });
    }

    // Without date range: plain query.
    const skip = (parseInt(page as string) - 1) * parseInt(limit as string);
    const take = parseInt(limit as string);
    const where: any = { employeeId };

    const [records, total] = await prisma.$transaction([
      prisma.attendance.findMany({
        where,
        orderBy: [{ date: 'desc' }, { checkIn: 'desc' }],
        skip,
        take
      }),
      prisma.attendance.count({ where })
    ]);

    res.status(200).json({
      success: true,
      data: {
        attendanceRecords: records,
        pagination: {
          page: parseInt(page as string),
          limit: take,
          total,
          totalPages: Math.ceil(total / take)
        }
      }
    });
  } catch (error) {
    next(error);
  }
};

export default {
  getAttendanceRecords,
  getAttendanceById,
  createAttendanceRecord,
  updateAttendanceRecord,
  deleteAttendanceRecord,
  getTodayAttendance,
  getAttendanceStats,
  exportAttendance,
  mobileCheckIn,
  mobileCheckOut,
  getMyAttendance
};