import { Request, Response, NextFunction } from 'express';
import { prisma } from '../config/database';
import { AppError } from '../utils/appError';
import { z } from 'zod';
import { hash } from 'bcryptjs';
import { EmployeeStatus } from '@prisma/client';
import * as fs from 'fs';
import * as path from 'path';
import { getLeaveSummary } from '../services/export.service';
import { getPayrollSettings } from '../services/settings.service';

/**
 * GET /api/employees/meta — form options (departments, positions, defaults).
 */
export const getEmployeeMeta = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const [departments, positions, settings] = await Promise.all([
      prisma.department.findMany({ orderBy: { name: 'asc' } }),
      prisma.position.findMany({ orderBy: { title: 'asc' } }),
      getPayrollSettings()
    ]);
    res.status(200).json({
      success: true,
      data: {
        departments,
        positions,
        weeklyHolidayOptions: ['MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY', 'SUNDAY'],
        defaultWeeklyHoliday: settings.defaultWeeklyHoliday
      }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get all employees with filtering and pagination.
 * Employees are sorted ascending by employee ID (numeric-aware: 2 < 10 < EMP001).
 */
export const getEmployees = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const {
      page = 1,
      limit = 10,
      search,
      departmentId,
      status,
      employmentType
    } = req.query;

    const pageNum = parseInt(page as string) || 1;
    const limitNum = parseInt(limit as string) || 10;

    // Build where clause
    const where: any = {};

    if (search) {
      where.OR = [
        { firstName: { contains: search as string, mode: 'insensitive' } },
        { lastName: { contains: search as string, mode: 'insensitive' } },
        { email: { contains: search as string, mode: 'insensitive' } },
        { employeeId: { contains: search as string, mode: 'insensitive' } }
      ];
    }

    if (departmentId) where.departmentId = departmentId as string;
    if (status) where.status = status as string;
    if (employmentType) where.employmentType = employmentType as string;

    const allEmployees = await prisma.employee.findMany({
      where,
      include: {
        department: {
          select: {
            id: true,
            name: true
          }
        },
        position: {
          select: {
            id: true,
            title: true
          }
        }
      }
    });

    // Numeric-aware ascending sort by employeeId (numbers first, then lexicographic).
    const numeric = (id: string) => (/^\d+$/.test(id) ? parseInt(id, 10) : null);
    allEmployees.sort((a, b) => {
      const an = numeric(a.employeeId);
      const bn = numeric(b.employeeId);
      if (an != null && bn != null) return an - bn;
      if (an != null) return -1;
      if (bn != null) return 1;
      return a.employeeId.localeCompare(b.employeeId);
    });

    const totalCount = allEmployees.length;
    const employees = allEmployees.slice((pageNum - 1) * limitNum, pageNum * limitNum);
    const safeEmployees = employees.map(({ password, ...rest }) => rest);

    res.status(200).json({
      success: true,
      data: {
        employees: safeEmployees,
        pagination: {
          page: pageNum,
          limit: limitNum,
          total: totalCount,
          totalPages: Math.ceil(totalCount / limitNum)
        }
      }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get employee by ID
 */
export const getEmployeeById = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;

    const employee = await prisma.employee.findUnique({
      where: { id },
      include: {
        department: {
          select: {
            id: true,
            name: true
          }
        },
        position: {
          select: {
            id: true,
            title: true
          }
        }
      }
    });

    if (!employee) {
      return next(new AppError('Employee not found', 404));
    }

    const { password, ...safeEmployee } = employee;

    res.status(200).json({
      success: true,
      data: safeEmployee
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Create new employee
 */
export const createEmployee = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const employeeData = req.body;

    // Check if employeeId already exists
    if (employeeData.employeeId) {
      const existingEmployee = await prisma.employee.findUnique({
        where: { employeeId: employeeData.employeeId }
      });
      
      if (existingEmployee) {
        return next(new AppError('Employee ID already exists', 400));
      }
    }

    // Check if email already exists
    const existingEmail = await prisma.employee.findUnique({
      where: { email: employeeData.email }
    });
    
    if (existingEmail) {
      return next(new AppError('Email already exists', 400));
    }

    const employee = await prisma.employee.create({
      data: {
        ...employeeData,
        hireDate: employeeData.hireDate ? new Date(employeeData.hireDate) : new Date(),
        dateOfBirth: employeeData.dateOfBirth ? new Date(employeeData.dateOfBirth) : undefined,
        employmentEndDate: employeeData.employmentEndDate ? new Date(employeeData.employmentEndDate) : undefined,
        weeklyHoliday: employeeData.weeklyHoliday || 'FRIDAY',
        password: employeeData.password ? await hash(String(employeeData.password), 12) : undefined
      }
    });

    const { password: _, ...safeEmployee } = employee;

    res.status(201).json({
      success: true,
      data: safeEmployee
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Update employee
 */
export const updateEmployee = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const updateData = req.body;

    // Check if employee exists
    const employee = await prisma.employee.findUnique({
      where: { id }
    });

    if (!employee) {
      return next(new AppError('Employee not found', 404));
    }

    // Check if employeeId is being changed and already exists
    if (updateData.employeeId && updateData.employeeId !== employee.employeeId) {
      const existingEmployee = await prisma.employee.findUnique({
        where: { employeeId: updateData.employeeId }
      });
      
      if (existingEmployee) {
        return next(new AppError('Employee ID already exists', 400));
      }
    }

    // Check if email is being changed and already exists
    if (updateData.email && updateData.email !== employee.email) {
      const existingEmail = await prisma.employee.findUnique({
        where: { email: updateData.email }
      });
      
      if (existingEmail) {
        return next(new AppError('Email already exists', 400));
      }
    }

    // Build update payload, hashing the password if it was changed.
    const data: any = { ...updateData };
    if (updateData.hireDate) data.hireDate = new Date(updateData.hireDate);
    if (updateData.dateOfBirth) data.dateOfBirth = new Date(updateData.dateOfBirth);
    if (updateData.employmentEndDate) data.employmentEndDate = new Date(updateData.employmentEndDate);
    if (updateData.password) data.password = await hash(String(updateData.password), 12);
    else delete data.password;

    const updatedEmployee = await prisma.employee.update({
      where: { id },
      data
    });

    const { password: _, ...safeEmployee } = updatedEmployee;

    res.status(200).json({
      success: true,
      data: safeEmployee
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Terminate / resign / retire an employee.
 * POST /api/employees/:id/terminate|resign|retire
 */
const EMPLOYMENT_ACTIONS: Record<string, string> = {
  terminate: 'TERMINATED',
  resign: 'RESIGNED',
  retire: 'RETIRED'
};

export const setEmploymentStatus = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id, action } = req.params;
    const newStatus = EMPLOYMENT_ACTIONS[action];
    if (!newStatus) return next(new AppError('Invalid action', 400));

    const employee = await prisma.employee.findUnique({ where: { id } });
    if (!employee) return next(new AppError('Employee not found', 404));

    const endDate = req.body?.endDate ? new Date(req.body.endDate) : new Date();
    const updated = await prisma.employee.update({
      where: { id },
      data: { status: newStatus as EmployeeStatus, employmentEndDate: endDate }
    });

    const { password: _, ...safeEmployee } = updated;
    res.status(200).json({
      success: true,
      message: `Employee marked as ${newStatus}`,
      data: safeEmployee
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Delete employee permanently (removes all related records).
 * DELETE /api/employees/:id
 */
export const deleteEmployee = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;

    const employee = await prisma.employee.findUnique({ where: { id } });
    if (!employee) {
      return next(new AppError('Employee not found', 404));
    }

    await prisma.$transaction([
      prisma.attendance.deleteMany({ where: { employeeId: id } }),
      prisma.payroll.deleteMany({ where: { employeeId: id } }),
      prisma.leaveBalance.deleteMany({ where: { employeeId: id } }),
      prisma.leaveRequest.deleteMany({ where: { employeeId: id } }),
      prisma.shiftAssignment.deleteMany({ where: { employeeId: id } }),
      prisma.trainingRecord.deleteMany({ where: { employeeId: id } }),
      prisma.performanceReview.deleteMany({
        where: { OR: [{ employeeId: id }, { reviewerId: id }] }
      }),
      prisma.notification.deleteMany({ where: { recipientId: id } }),
      prisma.department.updateMany({ where: { managerId: id }, data: { managerId: null } }),
      prisma.employee.delete({ where: { id } })
    ]);

    res.status(200).json({
      success: true,
      message: 'Employee deleted permanently'
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Upload an employee document (photograph / photo ID / CV) as a base64 JSON payload.
 * POST /api/employees/:id/documents  body: { data: <data-url>, filename: string, type: 'PHOTO'|'ID'|'CV' }
 */
const DOCUMENT_TYPES: Record<string, 'profileImageUrl' | 'idDocumentUrl' | 'cvUrl'> = {
  PHOTO: 'profileImageUrl',
  ID: 'idDocumentUrl',
  CV: 'cvUrl'
};

export const uploadEmployeeDocument = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const { data, filename, type } = req.body;

    const employee = await prisma.employee.findUnique({ where: { id } });
    if (!employee) return next(new AppError('Employee not found', 404));

    const field = DOCUMENT_TYPES[type];
    if (!field) return next(new AppError('type must be PHOTO, ID or CV', 400));
    if (!data || typeof data !== 'string') return next(new AppError('data (base64 data URL) is required', 400));

    // Detect MIME from the data-URI prefix or magic bytes.
    const match = data.match(/^data:([a-zA-Z0-9.+-]+\/[a-zA-Z0-9.+-]+);base64,(.*)$/s);
    if (!match) return next(new AppError('Invalid base64 data URL', 400));
    const mime = match[1].toLowerCase();
    const raw = Buffer.from(match[2], 'base64');
    if (raw.length === 0) return next(new AppError('Empty file', 400));
    if (raw.length > 8 * 1024 * 1024) return next(new AppError('File too large (max 8MB)', 400));

    let ext = 'bin';
    if (mime === 'application/pdf' || raw.subarray(0, 5).toString() === '%PDF-') ext = 'pdf';
    else if (mime === 'image/jpeg' || (raw[0] === 0xff && raw[1] === 0xd8)) ext = 'jpg';
    else if (mime === 'image/png' || (raw[0] === 0x89 && raw[1] === 0x50 && raw[2] === 0x4e && raw[3] === 0x47)) ext = 'png';
    else if (mime === 'image/webp') ext = 'webp';
    else return next(new AppError('Only PDF, JPG, PNG or WebP files are supported', 400));

    const dir = path.join(process.cwd(), 'uploads', 'employee');
    fs.mkdirSync(dir, { recursive: true });
    const safeBase = String(filename || 'document').replace(/[^a-zA-Z0-9._-]/g, '_').replace(/\.[^.]+$/, '');
    const fileName = `${id}-${Date.now()}-${safeBase}.${ext}`;
    fs.writeFileSync(path.join(dir, fileName), raw);

    const relPath = `employee/${fileName}`;
    const updated = await prisma.employee.update({ where: { id }, data: { [field]: relPath } });

    res.status(200).json({
      success: true,
      message: 'Document uploaded successfully',
      data: { ...updated, [field]: relPath }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get employee attendance records
 */
export const getEmployeeAttendance = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id: employeeId } = req.params;
    const { startDate, endDate, page = 1, limit = 30 } = req.query;

    const skip = (parseInt(page as string) - 1) * parseInt(limit as string);
    const take = parseInt(limit as string);

    // Build where clause
    const where: any = { employeeId };
    
    if (startDate) where.checkIn = { gte: new Date(startDate as string) };
    if (endDate) {
      if (where.checkIn) {
        where.checkIn.lte = new Date(endDate as string);
      } else {
        where.checkIn = { lte: new Date(endDate as string) };
      }
    }

    const [attendanceRecords, totalCount] = await prisma.$transaction([
      prisma.attendance.findMany({
        where,
        include: {
          employee: {
            select: {
              firstName: true,
              lastName: true,
              employeeId: true
            }
          }
        },
        skip,
        take,
        orderBy: { checkIn: 'desc' }
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
 * Get employee payroll records
 */
export const getEmployeePayroll = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id: employeeId } = req.params;
    const { startDate, endDate, page = 1, limit = 12 } = req.query;

    const skip = (parseInt(page as string) - 1) * parseInt(limit as string);
    const take = parseInt(limit as string);

    // Build where clause
    const where: any = { employeeId };
    
    if (startDate) where.payPeriodStart = { gte: new Date(startDate as string) };
    if (endDate) {
      if (where.payPeriodStart) {
        where.payPeriodEnd = { lte: new Date(endDate as string) };
      } else {
        where.payPeriodEnd = { lte: new Date(endDate as string) };
      }
    }

    const [payrollRecords, totalCount] = await prisma.$transaction([
      prisma.payroll.findMany({
        where,
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
 * Get an employee's annual leave balance (casual + medical).
 */
export const getEmployeeLeaveBalance = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const year = parseInt(req.query.year as string) || new Date().getFullYear();

    const employee = await prisma.employee.findUnique({ where: { id } });
    if (!employee) return next(new AppError('Employee not found', 404));

    const summary = await getLeaveSummary(id, year);
    res.status(200).json({ success: true, data: summary });
  } catch (error) {
    next(error);
  }
};

/**
 * Update an employee's annual leave entitlements (total input).
 */
export const updateEmployeeLeaveBalance = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const { year, casualTotal, medicalTotal } = req.body;

    const employee = await prisma.employee.findUnique({ where: { id } });
    if (!employee) return next(new AppError('Employee not found', 404));

    const targetYear = parseInt(year) || new Date().getFullYear();

    const balance = await prisma.leaveBalance.upsert({
      where: { employeeId_year: { employeeId: id, year: targetYear } },
      update: {
        casualTotal: casualTotal != null ? parseInt(casualTotal) : undefined,
        medicalTotal: medicalTotal != null ? parseInt(medicalTotal) : undefined
      },
      create: {
        employeeId: id,
        year: targetYear,
        casualTotal: casualTotal != null ? parseInt(casualTotal) : 10,
        medicalTotal: medicalTotal != null ? parseInt(medicalTotal) : 14
      }
    });

    const summary = await getLeaveSummary(id, targetYear);
    res.status(200).json({ success: true, data: { balance, summary } });
  } catch (error) {
    next(error);
  }
};

export default {
  getEmployees,
  getEmployeeById,
  createEmployee,
  updateEmployee,
  deleteEmployee,
  setEmploymentStatus,
  uploadEmployeeDocument,
  getEmployeeAttendance,
  getEmployeePayroll,
  getEmployeeLeaveBalance,
  updateEmployeeLeaveBalance,
  getEmployeeMeta
};