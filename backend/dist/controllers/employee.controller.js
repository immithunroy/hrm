"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.updateEmployeeLeaveBalance = exports.getEmployeeLeaveBalance = exports.getEmployeePayroll = exports.getEmployeeAttendance = exports.uploadEmployeeDocument = exports.deleteEmployee = exports.setEmploymentStatus = exports.updateEmployee = exports.createEmployee = exports.getEmployeeById = exports.getEmployees = exports.getEmployeeMeta = void 0;
const database_1 = require("../config/database");
const appError_1 = require("../utils/appError");
const bcryptjs_1 = require("bcryptjs");
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const export_service_1 = require("../services/export.service");
const settings_service_1 = require("../services/settings.service");
/**
 * GET /api/employees/meta — form options (departments, positions, defaults).
 */
const getEmployeeMeta = async (req, res, next) => {
    try {
        const [departments, positions, settings] = await Promise.all([
            database_1.prisma.department.findMany({ orderBy: { name: 'asc' } }),
            database_1.prisma.position.findMany({ orderBy: { title: 'asc' } }),
            (0, settings_service_1.getPayrollSettings)()
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
    }
    catch (error) {
        next(error);
    }
};
exports.getEmployeeMeta = getEmployeeMeta;
/**
 * Get all employees with filtering and pagination.
 * Employees are sorted ascending by employee ID (numeric-aware: 2 < 10 < EMP001).
 */
const getEmployees = async (req, res, next) => {
    try {
        const { page = 1, limit = 10, search, departmentId, status, employmentType } = req.query;
        const pageNum = parseInt(page) || 1;
        const limitNum = parseInt(limit) || 10;
        // Build where clause
        const where = {};
        if (search) {
            where.OR = [
                { firstName: { contains: search, mode: 'insensitive' } },
                { lastName: { contains: search, mode: 'insensitive' } },
                { email: { contains: search, mode: 'insensitive' } },
                { employeeId: { contains: search, mode: 'insensitive' } }
            ];
        }
        if (departmentId)
            where.departmentId = departmentId;
        if (status)
            where.status = status;
        if (employmentType)
            where.employmentType = employmentType;
        const allEmployees = await database_1.prisma.employee.findMany({
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
        const numeric = (id) => (/^\d+$/.test(id) ? parseInt(id, 10) : null);
        allEmployees.sort((a, b) => {
            const an = numeric(a.employeeId);
            const bn = numeric(b.employeeId);
            if (an != null && bn != null)
                return an - bn;
            if (an != null)
                return -1;
            if (bn != null)
                return 1;
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
    }
    catch (error) {
        next(error);
    }
};
exports.getEmployees = getEmployees;
/**
 * Get employee by ID
 */
const getEmployeeById = async (req, res, next) => {
    try {
        const { id } = req.params;
        const employee = await database_1.prisma.employee.findUnique({
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
            return next(new appError_1.AppError('Employee not found', 404));
        }
        const { password, ...safeEmployee } = employee;
        res.status(200).json({
            success: true,
            data: safeEmployee
        });
    }
    catch (error) {
        next(error);
    }
};
exports.getEmployeeById = getEmployeeById;
/**
 * Create new employee
 */
const createEmployee = async (req, res, next) => {
    try {
        const employeeData = req.body;
        // Check if employeeId already exists
        if (employeeData.employeeId) {
            const existingEmployee = await database_1.prisma.employee.findUnique({
                where: { employeeId: employeeData.employeeId }
            });
            if (existingEmployee) {
                return next(new appError_1.AppError('Employee ID already exists', 400));
            }
        }
        // Check if email already exists
        const existingEmail = await database_1.prisma.employee.findUnique({
            where: { email: employeeData.email }
        });
        if (existingEmail) {
            return next(new appError_1.AppError('Email already exists', 400));
        }
        const employee = await database_1.prisma.employee.create({
            data: {
                ...employeeData,
                hireDate: employeeData.hireDate ? new Date(employeeData.hireDate) : new Date(),
                dateOfBirth: employeeData.dateOfBirth ? new Date(employeeData.dateOfBirth) : undefined,
                employmentEndDate: employeeData.employmentEndDate ? new Date(employeeData.employmentEndDate) : undefined,
                weeklyHoliday: employeeData.weeklyHoliday || 'FRIDAY',
                password: employeeData.password ? await (0, bcryptjs_1.hash)(String(employeeData.password), 12) : undefined
            }
        });
        const { password: _, ...safeEmployee } = employee;
        res.status(201).json({
            success: true,
            data: safeEmployee
        });
    }
    catch (error) {
        next(error);
    }
};
exports.createEmployee = createEmployee;
/**
 * Update employee
 */
const updateEmployee = async (req, res, next) => {
    try {
        const { id } = req.params;
        const updateData = req.body;
        // Check if employee exists
        const employee = await database_1.prisma.employee.findUnique({
            where: { id }
        });
        if (!employee) {
            return next(new appError_1.AppError('Employee not found', 404));
        }
        // Check if employeeId is being changed and already exists
        if (updateData.employeeId && updateData.employeeId !== employee.employeeId) {
            const existingEmployee = await database_1.prisma.employee.findUnique({
                where: { employeeId: updateData.employeeId }
            });
            if (existingEmployee) {
                return next(new appError_1.AppError('Employee ID already exists', 400));
            }
        }
        // Check if email is being changed and already exists
        if (updateData.email && updateData.email !== employee.email) {
            const existingEmail = await database_1.prisma.employee.findUnique({
                where: { email: updateData.email }
            });
            if (existingEmail) {
                return next(new appError_1.AppError('Email already exists', 400));
            }
        }
        // Build update payload, hashing the password if it was changed.
        const data = { ...updateData };
        if (updateData.hireDate)
            data.hireDate = new Date(updateData.hireDate);
        if (updateData.dateOfBirth)
            data.dateOfBirth = new Date(updateData.dateOfBirth);
        if (updateData.employmentEndDate)
            data.employmentEndDate = new Date(updateData.employmentEndDate);
        if (updateData.password)
            data.password = await (0, bcryptjs_1.hash)(String(updateData.password), 12);
        else
            delete data.password;
        const updatedEmployee = await database_1.prisma.employee.update({
            where: { id },
            data
        });
        const { password: _, ...safeEmployee } = updatedEmployee;
        res.status(200).json({
            success: true,
            data: safeEmployee
        });
    }
    catch (error) {
        next(error);
    }
};
exports.updateEmployee = updateEmployee;
/**
 * Terminate / resign / retire an employee.
 * POST /api/employees/:id/terminate|resign|retire
 */
const EMPLOYMENT_ACTIONS = {
    terminate: 'TERMINATED',
    resign: 'RESIGNED',
    retire: 'RETIRED'
};
const setEmploymentStatus = async (req, res, next) => {
    try {
        const { id, action } = req.params;
        const newStatus = EMPLOYMENT_ACTIONS[action];
        if (!newStatus)
            return next(new appError_1.AppError('Invalid action', 400));
        const employee = await database_1.prisma.employee.findUnique({ where: { id } });
        if (!employee)
            return next(new appError_1.AppError('Employee not found', 404));
        const endDate = req.body?.endDate ? new Date(req.body.endDate) : new Date();
        const updated = await database_1.prisma.employee.update({
            where: { id },
            data: { status: newStatus, employmentEndDate: endDate }
        });
        const { password: _, ...safeEmployee } = updated;
        res.status(200).json({
            success: true,
            message: `Employee marked as ${newStatus}`,
            data: safeEmployee
        });
    }
    catch (error) {
        next(error);
    }
};
exports.setEmploymentStatus = setEmploymentStatus;
/**
 * Delete employee permanently (removes all related records).
 * DELETE /api/employees/:id
 */
const deleteEmployee = async (req, res, next) => {
    try {
        const { id } = req.params;
        const employee = await database_1.prisma.employee.findUnique({ where: { id } });
        if (!employee) {
            return next(new appError_1.AppError('Employee not found', 404));
        }
        await database_1.prisma.$transaction([
            database_1.prisma.attendance.deleteMany({ where: { employeeId: id } }),
            database_1.prisma.payroll.deleteMany({ where: { employeeId: id } }),
            database_1.prisma.leaveBalance.deleteMany({ where: { employeeId: id } }),
            database_1.prisma.leaveRequest.deleteMany({ where: { employeeId: id } }),
            database_1.prisma.shiftAssignment.deleteMany({ where: { employeeId: id } }),
            database_1.prisma.trainingRecord.deleteMany({ where: { employeeId: id } }),
            database_1.prisma.performanceReview.deleteMany({
                where: { OR: [{ employeeId: id }, { reviewerId: id }] }
            }),
            database_1.prisma.notification.deleteMany({ where: { recipientId: id } }),
            database_1.prisma.department.updateMany({ where: { managerId: id }, data: { managerId: null } }),
            database_1.prisma.employee.delete({ where: { id } })
        ]);
        res.status(200).json({
            success: true,
            message: 'Employee deleted permanently'
        });
    }
    catch (error) {
        next(error);
    }
};
exports.deleteEmployee = deleteEmployee;
/**
 * Upload an employee document (photograph / photo ID / CV) as a base64 JSON payload.
 * POST /api/employees/:id/documents  body: { data: <data-url>, filename: string, type: 'PHOTO'|'ID'|'CV' }
 */
const DOCUMENT_TYPES = {
    PHOTO: 'profileImageUrl',
    ID: 'idDocumentUrl',
    CV: 'cvUrl'
};
const uploadEmployeeDocument = async (req, res, next) => {
    try {
        const { id } = req.params;
        const { data, filename, type } = req.body;
        const employee = await database_1.prisma.employee.findUnique({ where: { id } });
        if (!employee)
            return next(new appError_1.AppError('Employee not found', 404));
        const field = DOCUMENT_TYPES[type];
        if (!field)
            return next(new appError_1.AppError('type must be PHOTO, ID or CV', 400));
        if (!data || typeof data !== 'string')
            return next(new appError_1.AppError('data (base64 data URL) is required', 400));
        // Detect MIME from the data-URI prefix or magic bytes.
        const match = data.match(/^data:([a-zA-Z0-9.+-]+\/[a-zA-Z0-9.+-]+);base64,(.*)$/s);
        if (!match)
            return next(new appError_1.AppError('Invalid base64 data URL', 400));
        const mime = match[1].toLowerCase();
        const raw = Buffer.from(match[2], 'base64');
        if (raw.length === 0)
            return next(new appError_1.AppError('Empty file', 400));
        if (raw.length > 8 * 1024 * 1024)
            return next(new appError_1.AppError('File too large (max 8MB)', 400));
        let ext = 'bin';
        if (mime === 'application/pdf' || raw.subarray(0, 5).toString() === '%PDF-')
            ext = 'pdf';
        else if (mime === 'image/jpeg' || (raw[0] === 0xff && raw[1] === 0xd8))
            ext = 'jpg';
        else if (mime === 'image/png' || (raw[0] === 0x89 && raw[1] === 0x50 && raw[2] === 0x4e && raw[3] === 0x47))
            ext = 'png';
        else if (mime === 'image/webp')
            ext = 'webp';
        else
            return next(new appError_1.AppError('Only PDF, JPG, PNG or WebP files are supported', 400));
        const dir = path.join(process.cwd(), 'uploads', 'employee');
        fs.mkdirSync(dir, { recursive: true });
        const safeBase = String(filename || 'document').replace(/[^a-zA-Z0-9._-]/g, '_').replace(/\.[^.]+$/, '');
        const fileName = `${id}-${Date.now()}-${safeBase}.${ext}`;
        fs.writeFileSync(path.join(dir, fileName), raw);
        const relPath = `employee/${fileName}`;
        const updated = await database_1.prisma.employee.update({ where: { id }, data: { [field]: relPath } });
        res.status(200).json({
            success: true,
            message: 'Document uploaded successfully',
            data: { ...updated, [field]: relPath }
        });
    }
    catch (error) {
        next(error);
    }
};
exports.uploadEmployeeDocument = uploadEmployeeDocument;
/**
 * Get employee attendance records
 */
const getEmployeeAttendance = async (req, res, next) => {
    try {
        const { id: employeeId } = req.params;
        const { startDate, endDate, page = 1, limit = 30 } = req.query;
        const skip = (parseInt(page) - 1) * parseInt(limit);
        const take = parseInt(limit);
        // Build where clause
        const where = { employeeId };
        if (startDate)
            where.checkIn = { gte: new Date(startDate) };
        if (endDate) {
            if (where.checkIn) {
                where.checkIn.lte = new Date(endDate);
            }
            else {
                where.checkIn = { lte: new Date(endDate) };
            }
        }
        const [attendanceRecords, totalCount] = await database_1.prisma.$transaction([
            database_1.prisma.attendance.findMany({
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
exports.getEmployeeAttendance = getEmployeeAttendance;
/**
 * Get employee payroll records
 */
const getEmployeePayroll = async (req, res, next) => {
    try {
        const { id: employeeId } = req.params;
        const { startDate, endDate, page = 1, limit = 12 } = req.query;
        const skip = (parseInt(page) - 1) * parseInt(limit);
        const take = parseInt(limit);
        // Build where clause
        const where = { employeeId };
        if (startDate)
            where.payPeriodStart = { gte: new Date(startDate) };
        if (endDate) {
            if (where.payPeriodStart) {
                where.payPeriodEnd = { lte: new Date(endDate) };
            }
            else {
                where.payPeriodEnd = { lte: new Date(endDate) };
            }
        }
        const [payrollRecords, totalCount] = await database_1.prisma.$transaction([
            database_1.prisma.payroll.findMany({
                where,
                skip,
                take,
                orderBy: { payPeriodStart: 'desc' }
            }),
            database_1.prisma.payroll.count({ where })
        ]);
        res.status(200).json({
            success: true,
            data: {
                payrollRecords,
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
exports.getEmployeePayroll = getEmployeePayroll;
/**
 * Get an employee's annual leave balance (casual + medical).
 */
const getEmployeeLeaveBalance = async (req, res, next) => {
    try {
        const { id } = req.params;
        const year = parseInt(req.query.year) || new Date().getFullYear();
        const employee = await database_1.prisma.employee.findUnique({ where: { id } });
        if (!employee)
            return next(new appError_1.AppError('Employee not found', 404));
        const summary = await (0, export_service_1.getLeaveSummary)(id, year);
        res.status(200).json({ success: true, data: summary });
    }
    catch (error) {
        next(error);
    }
};
exports.getEmployeeLeaveBalance = getEmployeeLeaveBalance;
/**
 * Update an employee's annual leave entitlements (total input).
 */
const updateEmployeeLeaveBalance = async (req, res, next) => {
    try {
        const { id } = req.params;
        const { year, casualTotal, medicalTotal } = req.body;
        const employee = await database_1.prisma.employee.findUnique({ where: { id } });
        if (!employee)
            return next(new appError_1.AppError('Employee not found', 404));
        const targetYear = parseInt(year) || new Date().getFullYear();
        const balance = await database_1.prisma.leaveBalance.upsert({
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
        const summary = await (0, export_service_1.getLeaveSummary)(id, targetYear);
        res.status(200).json({ success: true, data: { balance, summary } });
    }
    catch (error) {
        next(error);
    }
};
exports.updateEmployeeLeaveBalance = updateEmployeeLeaveBalance;
exports.default = {
    getEmployees: exports.getEmployees,
    getEmployeeById: exports.getEmployeeById,
    createEmployee: exports.createEmployee,
    updateEmployee: exports.updateEmployee,
    deleteEmployee: exports.deleteEmployee,
    setEmploymentStatus: exports.setEmploymentStatus,
    uploadEmployeeDocument: exports.uploadEmployeeDocument,
    getEmployeeAttendance: exports.getEmployeeAttendance,
    getEmployeePayroll: exports.getEmployeePayroll,
    getEmployeeLeaveBalance: exports.getEmployeeLeaveBalance,
    updateEmployeeLeaveBalance: exports.updateEmployeeLeaveBalance,
    getEmployeeMeta: exports.getEmployeeMeta
};
