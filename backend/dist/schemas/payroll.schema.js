"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.updatePayrollSchema = exports.payrollSchema = void 0;
const zod_1 = require("zod");
exports.payrollSchema = zod_1.z.object({
    employeeId: zod_1.z.string().min(1, 'Employee ID is required'),
    payPeriodStart: zod_1.z.string().datetime(),
    payPeriodEnd: zod_1.z.string().datetime(),
    basicSalary: zod_1.z.number().min(0, 'Basic salary must be positive'),
    overtimePay: zod_1.z.number().min(0, 'Overtime pay must be positive').optional().default(0),
    bonus: zod_1.z.number().min(0, 'Bonus must be positive').optional().default(0),
    deductions: zod_1.z.number().min(0, 'Deductions must be positive').optional().default(0),
    tax: zod_1.z.number().min(0, 'Tax must be positive').optional().default(0),
    netPay: zod_1.z.number().min(0, 'Net pay must be positive').optional().default(0),
    paymentDate: zod_1.z.string().datetime().optional(),
    status: zod_1.z.enum(['PENDING', 'PROCESSED', 'PAID', 'FAILED', 'CANCELLED']).default('PENDING'),
    paymentMethod: zod_1.z.enum(['BANK_TRANSFER', 'CHECK', 'CASH', 'MOBILE_MONEY']).optional(),
    transactionId: zod_1.z.string().optional(),
    notes: zod_1.z.string().optional()
});
exports.updatePayrollSchema = exports.payrollSchema.partial().extend({
    id: zod_1.z.string().min(1, 'Payroll ID is required')
});
exports.default = { payrollSchema: exports.payrollSchema, updatePayrollSchema: exports.updatePayrollSchema };
