/**
 * Employee Controller
 * -------------------
 * CRUD operations for employee records. Includes listing with search/filter,
 * creation with auto-generated usernames, update with role-based field
 * restrictions, permanent deletion with cascading cleanup, document uploads,
 * and sub-resource endpoints for attendance, payroll, and leave balances.
 */
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

    // Numeric-aware ascending sort: pure numbers sort numerically,
    // mixed strings (e.g. EMP001) sort lexicographically after numbers.

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

    // EMPLOYEE role sees only non-sensitive fields; others never see password.
    const SENSITIVE_FIELDS = ['password', 'salary', 'basicScale', 'accommodationRate', 'medicalRate', 'transportRate', 'mobileInternet', 'salaryType', 'taxId', 'bankAccountNumber', 'bankName'];
    const safeEmployees = employees.map(emp => {
      const stripped: any = { ...emp };
      if (req.userRole === 'EMPLOYEE') {
        for (const field of SENSITIVE_FIELDS) {
          delete stripped[field];
        }
      } else {
        delete stripped.password;
      }
      return stripped;
    });

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

    const SENSITIVE_FIELDS = ['password', 'salary', 'basicScale', 'accommodationRate', 'medicalRate', 'transportRate', 'mobileInternet', 'salaryType', 'taxId', 'bankAccountNumber', 'bankName'];
    const safeEmployee: any = { ...employee };
    const isSelf = req.userId === id;
    if (req.userRole === 'EMPLOYEE' && !isSelf) {
      // Viewing another employee: strip sensitive fields
      for (const field of SENSITIVE_FIELDS) {
        delete safeEmployee[field];
      }
    } else {
      delete safeEmployee.password;
    }

    res.status(200).json({
      success: true,
      data: safeEmployee
    });
  } catch (error) {
    next(error);
  }
};

// Whitelist of fields allowed when creating an employee via the API.
const CREATE_ALLOWED_FIELDS = [
  'firstName', 'lastName', 'middleName', 'email', 'username', 'phone', 'dateOfBirth',
  'gender', 'maritalStatus', 'hireDate', 'employeeId', 'departmentId',
  'positionId', 'employmentType', 'salary', 'salaryType', 'basicScale',
  'accommodationRate', 'medicalRate', 'transportRate', 'mobileInternet',
  'bankAccountNumber', 'bankName', 'emergencyContactName', 'emergencyContactPhone',
  'address', 'city', 'state', 'zipCode', 'country', 'govtIdType', 'govtIdNumber',
  'employmentEndDate', 'status', 'weeklyHoliday', 'attendanceExempt', 'payrollExempt',
  'pin', 'password', 'role'
];

// Whitelist of fields allowed when updating an employee (excludes sensitive escalation fields for non-admins).
const UPDATE_ALLOWED_FIELDS_ADMIN = [
  ...CREATE_ALLOWED_FIELDS
];

/**
 * Create new employee
 */
export const createEmployee = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const raw = req.body;
    // Only accept whitelisted fields — prevents mass assignment.
    const employeeData: Record<string, any> = {};
    for (const key of CREATE_ALLOWED_FIELDS) {
      if (raw[key] !== undefined) employeeData[key] = raw[key];
    }

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

    // Normalize and check username uniqueness
    if (!employeeData.username) {
      // Auto-generate from email prefix
      const emailPrefix = employeeData.email.split('@')[0].toLowerCase().trim();
      let candidate = emailPrefix;
      let counter = 2;
      while (await prisma.employee.findUnique({ where: { username: candidate } })) {
        candidate = `${emailPrefix}${counter}`;
        counter++;
      }
      employeeData.username = candidate;
    } else {
      employeeData.username = employeeData.username.toLowerCase().trim();
      const existingUsername = await prisma.employee.findUnique({
        where: { username: employeeData.username }
      });
      if (existingUsername) {
        return next(new AppError('Username already exists', 400));
      }
    }

    const employee = await prisma.employee.create({
      data: {
        ...(employeeData as any),
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
    const raw = req.body;

    // Check if employee exists
    const employee = await prisma.employee.findUnique({
      where: { id }
    });

    if (!employee) {
      return next(new AppError('Employee not found', 404));
    }

    // Role-based field access: EMPLOYEE self-edit is limited to profile
    // fields; HR/FINANCE/MANAGER cannot escalate roles or exemptions.
    const isSelf = req.userId === id;
    if (isSelf && req.userRole === 'EMPLOYEE') {
      const SAFE_FIELDS = ['firstName', 'lastName', 'phone', 'address', 'dateOfBirth', 'weeklyHoliday', 'password'];
      const updateData: Record<string, any> = {};
      for (const key of SAFE_FIELDS) {
        if (raw[key] !== undefined) updateData[key] = raw[key];
      }
      Object.assign(raw, updateData);
      // Remove keys not in SAFE_FIELDS
      for (const key of Object.keys(raw)) {
        if (!SAFE_FIELDS.includes(key)) delete raw[key];
      }
    } else if (req.userRole !== 'ADMIN') {
      // HR/FINANCE/MANAGER: only allowed fields, cannot escalate roles
      const RESTRICTED = ['role', 'payrollExempt', 'attendanceExempt'];
      for (const key of RESTRICTED) {
        delete raw[key];
      }
    }

    // Check if employeeId is being changed and already exists
    if (raw.employeeId && raw.employeeId !== employee.employeeId) {
      const existingEmployee = await prisma.employee.findUnique({
        where: { employeeId: raw.employeeId }
      });
      
      if (existingEmployee) {
        return next(new AppError('Employee ID already exists', 400));
      }
    }

    // Check if email is being changed and already exists
    if (raw.email && raw.email !== employee.email) {
      const existingEmail = await prisma.employee.findUnique({
        where: { email: raw.email }
      });
      
      if (existingEmail) {
        return next(new AppError('Email already exists', 400));
      }
    }

    // Check if username is being changed and already exists
    if (raw.username && raw.username !== employee.username) {
      raw.username = raw.username.toLowerCase().trim();
      const existingUsername = await prisma.employee.findUnique({
        where: { username: raw.username }
      });
      if (existingUsername) {
        return next(new AppError('Username already exists', 400));
      }
    }

    // Build explicit update payload — only fields present in the request are
    // sent to Prisma, preventing mass assignment. Password is hashed on change.
    const data: any = {};
    if (raw.firstName !== undefined) data.firstName = raw.firstName;
    if (raw.lastName !== undefined) data.lastName = raw.lastName;
    if (raw.middleName !== undefined) data.middleName = raw.middleName;
    if (raw.email !== undefined) data.email = raw.email;
    if (raw.username !== undefined) data.username = raw.username;
    if (raw.phone !== undefined) data.phone = raw.phone;
    if (raw.address !== undefined) data.address = raw.address;
    if (raw.city !== undefined) data.city = raw.city;
    if (raw.state !== undefined) data.state = raw.state;
    if (raw.zipCode !== undefined) data.zipCode = raw.zipCode;
    if (raw.country !== undefined) data.country = raw.country;
    if (raw.dateOfBirth !== undefined) data.dateOfBirth = raw.dateOfBirth ? new Date(raw.dateOfBirth) : null;
    if (raw.gender !== undefined) data.gender = raw.gender;
    if (raw.maritalStatus !== undefined) data.maritalStatus = raw.maritalStatus;
    if (raw.hireDate !== undefined) data.hireDate = raw.hireDate ? new Date(raw.hireDate) : undefined;
    if (raw.employeeId !== undefined) data.employeeId = raw.employeeId;
    if (raw.departmentId !== undefined) data.departmentId = raw.departmentId;
    if (raw.positionId !== undefined) data.positionId = raw.positionId;
    if (raw.employmentType !== undefined) data.employmentType = raw.employmentType;
    if (raw.salary !== undefined) data.salary = raw.salary;
    if (raw.salaryType !== undefined) data.salaryType = raw.salaryType;
    if (raw.basicScale !== undefined) data.basicScale = raw.basicScale;
    if (raw.accommodationRate !== undefined) data.accommodationRate = raw.accommodationRate;
    if (raw.medicalRate !== undefined) data.medicalRate = raw.medicalRate;
    if (raw.transportRate !== undefined) data.transportRate = raw.transportRate;
    if (raw.mobileInternet !== undefined) data.mobileInternet = raw.mobileInternet;
    if (raw.bankAccountNumber !== undefined) data.bankAccountNumber = raw.bankAccountNumber;
    if (raw.bankName !== undefined) data.bankName = raw.bankName;
    if (raw.taxId !== undefined) data.taxId = raw.taxId;
    if (raw.emergencyContactName !== undefined) data.emergencyContactName = raw.emergencyContactName;
    if (raw.emergencyContactPhone !== undefined) data.emergencyContactPhone = raw.emergencyContactPhone;
    if (raw.govtIdType !== undefined) data.govtIdType = raw.govtIdType;
    if (raw.govtIdNumber !== undefined) data.govtIdNumber = raw.govtIdNumber;
    if (raw.employmentEndDate !== undefined) data.employmentEndDate = raw.employmentEndDate ? new Date(raw.employmentEndDate) : null;
    if (raw.status !== undefined) data.status = raw.status;
    if (raw.weeklyHoliday !== undefined) data.weeklyHoliday = raw.weeklyHoliday;
    if (raw.attendanceExempt !== undefined) data.attendanceExempt = raw.attendanceExempt;
    if (raw.payrollExempt !== undefined) data.payrollExempt = raw.payrollExempt;
    if (raw.pin !== undefined) data.pin = raw.pin;
    if (raw.role !== undefined && req.userRole === 'ADMIN') data.role = raw.role;
    if (raw.password) data.password = await hash(String(raw.password), 12);

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

    // Delete all related records in a single transaction to avoid FK violations.
    // Order matters: child records first, then the employee itself.
    await prisma.$transaction([
      prisma.attendance.deleteMany({ where: { employeeId: id } }),
      prisma.payroll.deleteMany({ where: { employeeId: id } }),
      prisma.loanInstallment.deleteMany({ where: { loan: { employeeId: id } } }),
      prisma.loan.deleteMany({ where: { employeeId: id } }),
      prisma.festivalBonus.deleteMany({ where: { employeeId: id } }),
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

    // Validate MIME type from the data-URI prefix, falling back to magic bytes.
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

    // Sanitize filename, write to disk, and update the employee record
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

    // Upsert: create a new balance row if none exists for the year, otherwise
    // update the totals. Default entitlements are 10 casual + 14 medical days.
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