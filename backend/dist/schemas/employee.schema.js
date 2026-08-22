"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.updateEmployeeSchema = exports.employeeSchema = void 0;
const zod_1 = require("zod");
exports.employeeSchema = zod_1.z.object({
    firstName: zod_1.z.string().min(1, 'First name is required'),
    lastName: zod_1.z.string().min(1, 'Last name is required'),
    middleName: zod_1.z.string().optional(),
    email: zod_1.z.string().email('Invalid email format'),
    phone: zod_1.z.string().optional(),
    dateOfBirth: zod_1.z.string().optional(),
    gender: zod_1.z.enum(['MALE', 'FEMALE', 'OTHER']).optional(),
    maritalStatus: zod_1.z.enum(['SINGLE', 'MARRIED', 'DIVORCED', 'WIDOWED']).optional(),
    hireDate: zod_1.z.string().optional(),
    employeeId: zod_1.z.string().min(1, 'Employee ID is required').optional(),
    departmentId: zod_1.z.string().min(1, 'Department ID is required'),
    positionId: zod_1.z.string().min(1, 'Position ID is required'),
    employmentType: zod_1.z.enum(['FULL_TIME', 'PART_TIME', 'CONTRACT', 'INTERN', 'TEMPORARY']),
    salary: zod_1.z.number().min(0, 'Salary must be positive').optional(),
    salaryType: zod_1.z.enum(['GROSS', 'SCALED']).optional(),
    basicScale: zod_1.z.number().min(0).optional(),
    accommodationRate: zod_1.z.number().min(0).max(100).optional(),
    medicalRate: zod_1.z.number().min(0).max(100).optional(),
    transportRate: zod_1.z.number().min(0).max(100).optional(),
    mobileInternet: zod_1.z.number().min(0).optional(),
    bankAccountNumber: zod_1.z.string().optional(),
    bankName: zod_1.z.string().optional(),
    emergencyContactName: zod_1.z.string().optional(),
    emergencyContactPhone: zod_1.z.string().optional(),
    address: zod_1.z.string().optional(),
    city: zod_1.z.string().optional(),
    state: zod_1.z.string().optional(),
    zipCode: zod_1.z.string().optional(),
    country: zod_1.z.string().optional(),
    govtIdType: zod_1.z.enum(['NID', 'DRIVING_LICENSE', 'PASSPORT']).nullable().optional(),
    govtIdNumber: zod_1.z.string().optional(),
    profileImageUrl: zod_1.z.string().optional(),
    idDocumentUrl: zod_1.z.string().optional(),
    cvUrl: zod_1.z.string().optional(),
    employmentEndDate: zod_1.z.string().optional(),
    status: zod_1.z.enum(['ACTIVE', 'INACTIVE', 'ON_LEAVE', 'TERMINATED', 'RESIGNED', 'RETIRED', 'SUSPENDED']).optional(),
    weeklyHoliday: zod_1.z.enum(['MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY', 'SUNDAY']).optional(),
    attendanceExempt: zod_1.z.boolean().optional(),
    pin: zod_1.z.string().optional(),
    password: zod_1.z.string().optional()
});
exports.updateEmployeeSchema = exports.employeeSchema.partial();
exports.default = { employeeSchema: exports.employeeSchema, updateEmployeeSchema: exports.updateEmployeeSchema };
