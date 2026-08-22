import { Request, Response, NextFunction } from 'express';
import { prisma } from '../config/database';
import { AppError } from '../utils/appError';
import { z } from 'zod';
import {
  AttendanceExportRow,
  PayslipData,
  buildPayslipPdf,
  buildPayslipWorkbook,
  fmtDhakaDate,
  getLeaveSummary,
  round2
} from '../services/export.service';
import { getPayrollSettings } from '../services/settings.service';
import { dhakaDayString, isWeeklyHoliday, getHolidaySet } from '../services/holiday.service';
import { mergeAttendanceWithCalendar } from '../services/attendanceMerge.service';

const DHAKA_OFFSET_MS = 6 * 3600 * 1000;

// Calculate salary breakdown based on salary type (GROSS or SCALED)
const calculateSalaryBreakdown = (employee: any) => {
  const salaryType = employee.salaryType || 'GROSS';
  if (salaryType === 'SCALED') {
    const basic = Number(employee.basicScale || 0);
    const accommodation = round2(basic * Number(employee.accommodationRate || 50) / 100);
    const medical = round2(basic * Number(employee.medicalRate || 25) / 100);
    const transport = round2(basic * Number(employee.transportRate || 15) / 100);
    const mobileInternet = Number(employee.mobileInternet || 0);
    const gross = round2(basic + accommodation + medical + transport + mobileInternet);
    return {
      salaryType: 'SCALED' as const,
      basic,
      accommodation,
      medical,
      transport,
      mobileInternet,
      gross,
      accommodationRate: Number(employee.accommodationRate || 50),
      medicalRate: Number(employee.medicalRate || 25),
      transportRate: Number(employee.transportRate || 15),
    };
  }
  // GROSS type: salary field is the gross amount
  const gross = Number(employee.salary || 0);
  return {
    salaryType: 'GROSS' as const,
    basic: gross,
    accommodation: 0,
    medical: 0,
    transport: 0,
    mobileInternet: 0,
    gross,
    accommodationRate: 0,
    medicalRate: 0,
    transportRate: 0,
  };
};

const monthBounds = (y: number, m: number) => {
  const start = new Date(Date.UTC(y, m - 1, 1) - DHAKA_OFFSET_MS);
  const end = new Date(Date.UTC(y, m, 1) - DHAKA_OFFSET_MS - 1);
  return { start, end };
};

// Per-record overtime split into regular vs holiday (weekly holiday + marked holiday).
// Early-attendance OT is split separately so it can be included/excluded at payslip time.
// holidaySet must be pre-fetched for the relevant year to avoid N+1 queries.

const splitOvertime = async (
  rows: Array<{ date: Date; overtimeHours?: number | null; earlyOvertimeHours?: number | null }>,
  weeklyHoliday: string,
  holidaySet?: Set<string>
) => {
  let regular = 0;
  let holiday = 0;
  let earlyRegular = 0;
  let earlyHoliday = 0;

  // Lazily build the holiday set from the first row's year if not provided
  let _holidaySet = holidaySet;
  if (!_holidaySet && rows.length > 0) {
    const year = rows[0].date.getUTCFullYear();
    _holidaySet = await getHolidaySet(year);
  }

  for (const r of rows) {
    const dayStr = dhakaDayString(r.date);
    const isHolidayDay = isWeeklyHoliday(dayStr, weeklyHoliday) || (_holidaySet?.has(dayStr) ?? false);
    const ot = r.overtimeHours || 0;
    const eot = r.earlyOvertimeHours || 0;
    if (isHolidayDay) {
      holiday += ot;
      earlyHoliday += eot;
    } else {
      regular += ot;
      earlyRegular += eot;
    }
  }
  return {
    regularOTHours: round2(regular),
    holidayOTHours: round2(holiday),
    earlyRegularOTHours: round2(earlyRegular),
    earlyHolidayOTHours: round2(earlyHoliday)
  };
};

// Total errand (break) minutes across attendance rows.
const totalErrandMinutes = (rows: Array<{ breakMinutes?: number | null }>): number => {
  return rows.reduce((s, r) => s + (r.breakMinutes || 0), 0);
};

// Apply the configured errand deduction to regular OT only (holiday OT is untouched).
const applyErrandDeduction = (regularOTHours: number, errandMinutes: number, mode: string) => {
  if (mode !== 'DEDUCT_FROM_OT' || errandMinutes <= 0) {
    return { regularOTHours, deductedErrandMinutes: 0 };
  }
  const deducted = Math.min(regularOTHours, errandMinutes / 60);
  return { regularOTHours: round2(regularOTHours - deducted), deductedErrandMinutes: errandMinutes };
};

/**
 * Export a pay slip (with monthly attendance sheet + leave summary) as xlsx or pdf.
 * GET /api/payroll/payslip/:employeeId?month=YYYY-MM&format=xlsx|pdf
 */
export const exportEmployeePayslip = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { employeeId } = req.params;
    const format = String(req.query.format || 'xlsx').toLowerCase();
    const month = String(req.query.month || '');
    const [y, m] = month.split('-').map(Number);
    if (!y || !m) return next(new AppError('month is required as YYYY-MM', 400));

    const employee = await prisma.employee.findUnique({
      where: { id: employeeId },
      include: {
        department: { select: { name: true } },
        position: { select: { title: true } }
      }
    });
    if (!employee) return next(new AppError('Employee not found', 404));

    // EMPLOYEE: only own payslip
    if (req.userRole === 'EMPLOYEE' && employeeId !== req.userId) {
      return next(new AppError('Insufficient permissions', 403));
    }

    const { start, end } = monthBounds(y, m);
    const settings = await getPayrollSettings();

    // Pre-fetch all holidays for the year to avoid N+1 queries
    const holidaySet = await getHolidaySet(y);

    const records = await prisma.attendance.findMany({
      where: {
        employeeId,
        date: { gte: start, lte: end }
      },
      orderBy: [{ date: 'asc' }, { checkIn: 'asc' }]
    });

    const mergedRecords = await mergeAttendanceWithCalendar(records, {
      start,
      end,
      employeeId
    });

    const rows: AttendanceExportRow[] = mergedRecords.map((r: any) => ({
      employee: {
        firstName: employee.firstName,
        lastName: employee.lastName,
        employeeId: employee.employeeId,
        department: employee.department
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

    const isExempt = Boolean(employee.attendanceExempt);
    const { regularOTHours, holidayOTHours, earlyRegularOTHours, earlyHolidayOTHours } = await splitOvertime(
      records,
      employee.weeklyHoliday || 'FRIDAY',
      holidaySet
    );
    const earlyOTHours = round2(earlyRegularOTHours + earlyHolidayOTHours);
    const includeEarly = settings.earlyOvertimeMode === 'INCLUDE';
    const regularOTAfterEarly = round2(regularOTHours + (includeEarly ? earlyRegularOTHours : 0));
    const holidayOTAfterEarly = round2(holidayOTHours + (includeEarly ? earlyHolidayOTHours : 0));
    const errandMinutes = totalErrandMinutes(rows);
    const errandResult = applyErrandDeduction(regularOTAfterEarly, errandMinutes, settings.errandDeductionMode);
    const totalOvertimeHours = round2(errandResult.regularOTHours + holidayOTAfterEarly);
    const totalLateMinutes = rows.reduce((s, r) => s + (r.lateMinutes || 0), 0);
    const presentDays = isExempt
      ? settings.workingDaysPerMonth
      : rows.filter((r) => ['PRESENT', 'LATE', 'EARLY', 'HALF'].includes(r.status)).length;
    const lateCount = isExempt ? 0 : rows.filter((r) => r.status === 'LATE').length;
    const earlyCount = isExempt ? 0 : rows.filter((r) => r.status === 'EARLY').length;

    const salaryBreakdown = calculateSalaryBreakdown(employee);
    const basic = salaryBreakdown.gross;
    const hourlyRate = basic / settings.workingDaysPerMonth / settings.workingHoursPerDay;
    const overtimePay = isExempt
      ? 0
      : round2(
          errandResult.regularOTHours * hourlyRate * settings.overtimeRate +
          holidayOTAfterEarly * hourlyRate * settings.holidayOvertimeRate
        );

    // --- Festival bonus for payslip ---
    const festivalBonuses = await prisma.festivalBonus.findMany({
      where: {
        employeeId: employee.id,
        year: y,
        status: { in: ['APPROVED', 'PAID'] },
      },
    });
    const festivalBonusTotal = festivalBonuses.reduce((sum, b) => sum + Number(b.totalAmount), 0);

    const gross = round2(basic + overtimePay + festivalBonusTotal);
    const tax = round2(gross * settings.taxRate);

    // --- Auto loan deduction for payslip ---
    const activeLoansForPayslip = await prisma.loan.findMany({
      where: {
        employeeId: employee.id,
        status: { in: ['ACTIVE', 'APPROVED'] },
      },
      include: {
        installments: {
          where: {
            status: { in: ['PENDING', 'PARTIAL', 'OVERDUE'] },
            dueDate: { gte: start, lte: end },
          },
        },
      },
    });
    let loanDeduction = 0;
    for (const loan of activeLoansForPayslip) {
      for (const inst of loan.installments) {
        const remaining = Number(inst.amount) - Number(inst.paidAmount || 0);
        if (remaining > 0) loanDeduction += remaining;
      }
    }
    loanDeduction = round2(loanDeduction);

    const deductions = loanDeduction;
    const netPay = round2(gross - tax - deductions);

    const leave = await getLeaveSummary(employee.id, y);

    const data: PayslipData = {
      employee,
      month: `${y}-${String(m).padStart(2, '0')}`,
      currency: settings.currency,
      attendanceRows: rows,
      totals: {
        totalDays: rows.length,
        presentDays,
        lateCount,
        earlyCount,
        totalOvertimeHours,
        totalLateMinutes,
        regularOTHours: errandResult.regularOTHours,
        holidayOTHours: holidayOTAfterEarly,
        earlyOTHours,
        errandMinutes
      },
      salary: {
        basic,
        overtimePay,
        overtimeRate: settings.overtimeRate,
        holidayOvertimeRate: settings.holidayOvertimeRate,
        bonus: festivalBonusTotal,
        deductions,
        tax,
        netPay,
        salaryType: salaryBreakdown.salaryType,
        accommodation: salaryBreakdown.accommodation,
        medical: salaryBreakdown.medical,
        transport: salaryBreakdown.transport,
        mobileInternet: salaryBreakdown.mobileInternet,
        grossSalary: salaryBreakdown.gross,
        accommodationRate: salaryBreakdown.accommodationRate,
        medicalRate: salaryBreakdown.medicalRate,
        transportRate: salaryBreakdown.transportRate,
      },
      errandDeduction: {
        mode: settings.errandDeductionMode,
        deductedMinutes: errandResult.deductedErrandMinutes,
        currency: settings.currency
      },
      earlyOvertime: {
        mode: settings.earlyOvertimeMode,
        hours: earlyOTHours,
        currency: settings.currency
      },
      leave
    };

    if (loanDeduction > 0) {
      (data as any).loanDeduction = { amount: loanDeduction, currency: settings.currency };
    }

    const filename = `payslip-${employee.employeeId}-${y}-${String(m).padStart(2, '0')}`;

    if (format === 'pdf') {
      const buffer = await buildPayslipPdf(data);
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}.pdf"`);
      return res.send(buffer);
    }

    const buffer = await buildPayslipWorkbook(data);
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}.xlsx"`);
    return res.send(buffer);
  } catch (error) {
    next(error);
  }
};

/**
 * Get payroll records with filtering and pagination
 */
export const getPayrollRecords = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const {
      page = 1,
      limit = 20,
      employeeId,
      startDate,
      endDate,
      status,
      paymentMethod
    } = req.query;

    const skip = (parseInt(page as string) - 1) * parseInt(limit as string);
    const take = parseInt(limit as string);

    // Build where clause
    const where: any = {};
    
    // EMPLOYEE: only own payroll records
    if (req.userRole === 'EMPLOYEE') {
      where.employeeId = req.userId;
    } else if (employeeId) {
      where.employeeId = employeeId as string;
    }

    if (startDate) where.payPeriodStart = { gte: new Date(startDate as string) };
    if (endDate) {
      if (where.payPeriodStart) {
        where.payPeriodEnd = { lte: new Date(endDate as string) };
      } else {
        where.payPeriodEnd = { lte: new Date(endDate as string) };
      }
    }
    if (status) where.status = status as string;
    if (paymentMethod) where.paymentMethod = paymentMethod as string;

    const [payrollRecords, totalCount] = await prisma.$transaction([
      prisma.payroll.findMany({
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
        orderBy: { payPeriodStart: 'desc' }
      }),
      prisma.payroll.count({ where })
    ]);

    res.status(200).json({
      success: true,
      data: {
        payrollRecords,
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
 * Get payroll record by ID
 */
export const getPayrollById = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;

    const payroll = await prisma.payroll.findUnique({
      where: { id },
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
      }
    });

    if (!payroll) {
      return next(new AppError('Payroll record not found', 404));
    }

    // EMPLOYEE: only own payroll
    if (req.userRole === 'EMPLOYEE' && payroll.employeeId !== req.userId) {
      return next(new AppError('Insufficient permissions', 403));
    }

    res.status(200).json({
      success: true,
      data: payroll
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Create payroll record
 */
export const createPayrollRecord = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const payrollData = req.body;

    // Validate employee exists
    const employee = await prisma.employee.findUnique({
      where: { id: payrollData.employeeId }
    });

    if (!employee) {
      return next(new AppError('Employee not found', 404));
    }

    // Validate dates
    const startDate = new Date(payrollData.payPeriodStart);
    const endDate = new Date(payrollData.payPeriodEnd);
    
    if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
      return next(new AppError('Invalid date format', 400));
    }
    
    if (startDate >= endDate) {
      return next(new AppError('Pay period start must be before end date', 400));
    }

    // Check for overlapping payroll periods for same employee
    const overlappingPayroll = await prisma.payroll.findFirst({
      where: {
        employeeId: payrollData.employeeId,
        OR: [
          {
            payPeriodStart: { lte: endDate },
            payPeriodEnd: { gte: startDate }
          }
        ]
      }
    });

    if (overlappingPayroll) {
      return next(new AppError('Payroll period overlaps with existing record', 400));
    }

    const payroll = await prisma.payroll.create({
      data: {
        ...payrollData,
        payPeriodStart: startDate,
        payPeriodEnd: endDate,
        paymentDate: payrollData.paymentDate ? new Date(payrollData.paymentDate) : undefined
      }
    });

    res.status(201).json({
      success: true,
      data: payroll
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Update payroll record
 */
export const updatePayrollRecord = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const updateData = req.body;

    // Check if payroll record exists
    const payroll = await prisma.payroll.findUnique({
      where: { id }
    });

    if (!payroll) {
      return next(new AppError('Payroll record not found', 404));
    }

    // Validate dates if provided
    let startDate = payroll.payPeriodStart;
    let endDate = payroll.payPeriodEnd;
    
    if (updateData.payPeriodStart) {
      startDate = new Date(updateData.payPeriodStart);
      if (isNaN(startDate.getTime())) {
        return next(new AppError('Invalid pay period start date', 400));
      }
    }
    
    if (updateData.payPeriodEnd) {
      endDate = new Date(updateData.payPeriodEnd);
      if (isNaN(endDate.getTime())) {
        return next(new AppError('Invalid pay period end date', 400));
      }
    }
    
    if (startDate >= endDate) {
      return next(new AppError('Pay period start must be before end date', 400));
    }

    // Check for overlapping payroll periods for same employee (excluding current record)
    const overlappingPayroll = await prisma.payroll.findFirst({
      where: {
        employeeId: payroll.employeeId,
        id: { not: id },
        OR: [
          {
            payPeriodStart: { lte: endDate },
            payPeriodEnd: { gte: startDate }
          }
        ]
      }
    });

    if (overlappingPayroll) {
      return next(new AppError('Payroll period overlaps with existing record', 400));
    }

    const updatedPayroll = await prisma.payroll.update({
      where: { id },
      data: {
        ...updateData,
        payPeriodStart: startDate,
        payPeriodEnd: endDate,
        paymentDate: updateData.paymentDate ? new Date(updateData.paymentDate) : undefined
      }
    });

    res.status(200).json({
      success: true,
      data: updatedPayroll
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Delete payroll record
 */
export const deletePayrollRecord = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;

    // Check if payroll record exists
    const payroll = await prisma.payroll.findUnique({
      where: { id }
    });

    if (!payroll) {
      return next(new AppError('Payroll record not found', 404));
    }

    await prisma.payroll.delete({
      where: { id }
    });

    res.status(200).json({
      success: true,
      message: 'Payroll record deleted successfully'
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Process payroll automatically from attendance.
 *
 * POST /api/payroll/process  body: { month?: 'YYYY-MM', employeeIds?: string[] }
 * - month defaults to the current month.
 * - For each active employee: basic salary + regular OT + holiday OT (holidays
 *   and weekly holidays at the configured holiday overtime rate), minus tax.
 * - Existing payroll records for the same month are replaced.
 */
export const processPayroll = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { month, employeeIds } = req.body;

    const now = new Date();
    let y = now.getUTCFullYear();
    let m = now.getUTCMonth() + 1;
    if (month) {
      const parsed = String(month).split('-').map(Number);
      if (parsed.length !== 2 || !parsed[0] || !parsed[1]) {
        return next(new AppError('month must be YYYY-MM', 400));
      }
      y = parsed[0];
      m = parsed[1];
    }

    const { start, end } = monthBounds(y, m);
    const settings = await getPayrollSettings();

    // Pre-fetch all holidays for the year to avoid N+1 queries
    const holidaySet = await getHolidaySet(y);

    // Determine which employees to process
    let employees;
    if (employeeIds && employeeIds.length > 0) {
      employees = await prisma.employee.findMany({
        where: { id: { in: employeeIds }, status: 'ACTIVE', payrollExempt: false }
      });
    } else {
      employees = await prisma.employee.findMany({
        where: { status: 'ACTIVE', payrollExempt: false },
        orderBy: { createdAt: 'asc' }
      });
    }

    if (employees.length === 0) {
      return next(new AppError('No active employees found to process', 400));
    }

    const processed: Array<{
      employeeId: string;
      employeeName: string;
      basicSalary: number;
      overtimePay: number;
      tax: number;
      deductions: number;
      netPay: number;
      regularOTHours: number;
      holidayOTHours: number;
      earlyOTHours: number;
      presentDays: number;
    }> = [];

    for (const employee of employees) {
      const isExempt = Boolean(employee.attendanceExempt);
      const records = await prisma.attendance.findMany({
        where: { employeeId: employee.id, date: { gte: start, lte: end } },
        select: { status: true, overtimeHours: true, earlyOvertimeHours: true, date: true, breakMinutes: true }
      });

      const { regularOTHours, holidayOTHours, earlyRegularOTHours, earlyHolidayOTHours } = await splitOvertime(
        records,
        employee.weeklyHoliday || 'FRIDAY',
        holidaySet
      );
      const earlyOTHours = round2(earlyRegularOTHours + earlyHolidayOTHours);
      const includeEarly = settings.earlyOvertimeMode === 'INCLUDE';
      const regularOTAfterEarly = round2(regularOTHours + (includeEarly ? earlyRegularOTHours : 0));
      const holidayOTAfterEarly = round2(holidayOTHours + (includeEarly ? earlyHolidayOTHours : 0));

      const errandMinutes = totalErrandMinutes(records);
      const errandResult = applyErrandDeduction(regularOTAfterEarly, errandMinutes, settings.errandDeductionMode);

      const salaryBreakdown = calculateSalaryBreakdown(employee);
      const basicSalary = salaryBreakdown.gross;
      const hourlyRate = basicSalary / settings.workingDaysPerMonth / settings.workingHoursPerDay;
      const overtimePay = isExempt
        ? 0
        : round2(
            errandResult.regularOTHours * hourlyRate * settings.overtimeRate +
            holidayOTAfterEarly * hourlyRate * settings.holidayOvertimeRate
          );

      const taxableIncome = basicSalary + overtimePay;
      const tax = round2(taxableIncome * settings.taxRate);

      // --- Auto loan deduction ---
      // Find active loans for this employee with installments due in this month
      const activeLoans = await prisma.loan.findMany({
        where: {
          employeeId: employee.id,
          status: { in: ['ACTIVE', 'APPROVED'] },
        },
        include: {
          installments: {
            where: {
              status: { in: ['PENDING', 'PARTIAL', 'OVERDUE'] },
              dueDate: { gte: start, lte: end },
            },
          },
        },
      });

      let loanDeduction = 0;
      const installmentPaymentData: Array<{ installmentId: string; loanId: string; amount: number }> = [];

      for (const loan of activeLoans) {
        for (const inst of loan.installments) {
          const remaining = Number(inst.amount) - Number(inst.paidAmount || 0);
          if (remaining > 0) {
            loanDeduction += remaining;
            installmentPaymentData.push({
              installmentId: inst.id,
              loanId: loan.id,
              amount: remaining,
            });
          }
        }
      }
      loanDeduction = round2(loanDeduction);

      const netPay = round2(basicSalary + overtimePay - tax - loanDeduction);
      const presentDays = isExempt
        ? settings.workingDaysPerMonth
        : records.filter((r) =>
            ['PRESENT', 'LATE', 'EARLY', 'HALF'].includes(r.status)
          ).length;

      // Replace any existing record for this employee + month
      await prisma.payroll.deleteMany({
        where: {
          employeeId: employee.id,
          payPeriodStart: { gte: start, lte: end }
        }
      });

      const payroll = await prisma.payroll.create({
        data: {
          employeeId: employee.id,
          payPeriodStart: start,
          payPeriodEnd: end,
          basicSalary,
          overtimePay,
          bonus: 0,
          deductions: loanDeduction,
          tax,
          netPay,
          paymentDate: new Date(),
          status: 'PROCESSED',
          notes: `Auto-calculated from attendance (${errandResult.regularOTHours} regular OT hrs, ${holidayOTAfterEarly} holiday OT hrs)${settings.earlyOvertimeMode === 'INCLUDE' && earlyOTHours > 0 ? `; ${earlyOTHours} early-attendance OT hrs included` : settings.earlyOvertimeMode === 'EXCLUDE' && earlyOTHours > 0 ? `; ${earlyOTHours} early-attendance OT hrs excluded` : ''}${settings.errandDeductionMode === 'DEDUCT_FROM_OT' && errandMinutes > 0 ? `; ${errandMinutes} min errand deducted from regular OT` : ''}${loanDeduction > 0 ? `; Loan deduction: ${loanDeduction}` : ''}`
        }
      });

      // Auto-record loan installment payments linked to this payroll
      for (const payment of installmentPaymentData) {
        const installment = await prisma.loanInstallment.findUnique({ where: { id: payment.installmentId } });
        if (!installment) continue;

        const newPaidAmount = Number(installment.paidAmount || 0) + payment.amount;
        const installmentStatus = newPaidAmount >= Number(installment.amount) ? 'PAID' : 'PARTIAL';

        await prisma.loanInstallment.update({
          where: { id: payment.installmentId },
          data: {
            paidAmount: newPaidAmount,
            status: installmentStatus,
            paidAt: new Date(),
            payrollId: payroll.id,
          },
        });

        // Update loan remaining amount and status
        const loan = await prisma.loan.findUnique({ where: { id: payment.loanId } });
        if (loan) {
          const newRemaining = Number(loan.remainingAmount) - payment.amount;
          await prisma.loan.update({
            where: { id: payment.loanId },
            data: {
              remainingAmount: Math.max(0, newRemaining),
              status: newRemaining <= 0 ? 'COMPLETED' : 'ACTIVE',
            },
          });
        }
      }

      processed.push({
        employeeId: employee.id,
        employeeName: `${employee.firstName} ${employee.lastName}`,
        basicSalary,
        overtimePay,
        tax,
        deductions: loanDeduction,
        netPay,
        regularOTHours: errandResult.regularOTHours,
        holidayOTHours: holidayOTAfterEarly,
        earlyOTHours,
        presentDays
      });
    }

    res.status(201).json({
      success: true,
      message: `Payroll processed for ${processed.length} employees (${y}-${String(m).padStart(2, '0')})`,
      data: { month: `${y}-${String(m).padStart(2, '0')}`, processed }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get payroll statistics
 */
export const getPayrollStats = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { startDate, endDate } = req.query;
    
    // Build date filter
    const dateFilter: any = {};
    if (startDate) dateFilter.gte = new Date(startDate as string);
    if (endDate) dateFilter.lte = new Date(endDate as string);
    
    const where = startDate || endDate ? { payPeriodStart: dateFilter } : {};

    // EMPLOYEE: only own payroll stats
    if (req.userRole === 'EMPLOYEE') {
      (where as any).employeeId = req.userId;
    }

    const payrollRecords = await prisma.payroll.findMany({
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
    const totalRecords = payrollRecords.length;
    const totalGrossPay = payrollRecords.reduce((sum, p) => sum + Number(p.basicSalary || 0) + Number(p.overtimePay || 0), 0);
    const totalNetPay = payrollRecords.reduce((sum, p) => sum + Number(p.netPay || 0), 0);
    const totalTax = payrollRecords.reduce((sum, p) => sum + Number(p.tax || 0), 0);
    const totalOvertimePay = payrollRecords.reduce((sum, p) => sum + Number(p.overtimePay || 0), 0);
    
    const statusBreakdown: Record<string, number> = {};
    payrollRecords.forEach(record => {
      const status = record.status || 'UNKNOWN';
      statusBreakdown[status] = (statusBreakdown[status] || 0) + 1;
    });

    res.status(200).json({
      success: true,
      data: {
        statistics: {
          totalRecords,
          totalGrossPay,
          totalNetPay,
          totalTax,
          totalOvertimePay,
          averageNetPay: totalRecords > 0 ? totalNetPay / totalRecords : 0
        },
        statusBreakdown
      }
    });
  } catch (error) {
    next(error);
  }
};

export default {
  getPayrollRecords,
  getPayrollById,
  createPayrollRecord,
  updatePayrollRecord,
  deletePayrollRecord,
  processPayroll,
  getPayrollStats
};