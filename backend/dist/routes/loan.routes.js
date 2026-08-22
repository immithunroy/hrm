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
const express_1 = require("express");
const validateRequest_1 = require("../middleware/validateRequest");
const zod_1 = require("zod");
const authenticateToken_1 = require("../middleware/authenticateToken");
const loanController = __importStar(require("../controllers/loan.controller"));
const router = (0, express_1.Router)();
// Protect all loan routes
router.use(authenticateToken_1.authenticateToken);
const createLoanSchema = zod_1.z.object({
    employeeId: zod_1.z.string().uuid('Invalid employee ID'),
    amount: zod_1.z.number().positive('Amount must be positive'),
    interestRate: zod_1.z.number().min(0).default(0),
    purpose: zod_1.z.string().optional(),
    startDate: zod_1.z.string().datetime('Invalid start date format'),
    endDate: zod_1.z.string().datetime('Invalid end date format').optional(),
    installmentAmount: zod_1.z.number().positive().optional(),
    installmentCount: zod_1.z.number().int().positive().optional(),
    frequency: zod_1.z.enum(['WEEKLY', 'BIWEEKLY', 'MONTHLY', 'QUARTERLY']).default('MONTHLY'),
    notes: zod_1.z.string().optional(),
});
const recordPaymentSchema = zod_1.z.object({
    amount: zod_1.z.number().positive('Amount must be positive'),
    payrollId: zod_1.z.string().uuid().optional(),
});
router.get('/', (0, authenticateToken_1.authorize)('ADMIN', 'HR', 'FINANCE', 'MANAGER', 'EMPLOYEE'), loanController.getLoans);
router.get('/upcoming', (0, authenticateToken_1.authorize)('ADMIN', 'HR', 'FINANCE', 'MANAGER', 'EMPLOYEE'), loanController.getUpcomingInstallments);
router.get('/:id', (0, authenticateToken_1.authorize)('ADMIN', 'HR', 'FINANCE', 'MANAGER', 'EMPLOYEE'), loanController.getLoanById);
router.get('/:employeeId/summary', (0, authenticateToken_1.authorize)('ADMIN', 'HR', 'FINANCE', 'MANAGER', 'EMPLOYEE'), loanController.getLoanSummary);
router.get('/:loanId/installments', (0, authenticateToken_1.authorize)('ADMIN', 'HR', 'FINANCE', 'MANAGER', 'EMPLOYEE'), loanController.getInstallmentsByLoan);
router.post('/', (0, authenticateToken_1.authorize)('ADMIN', 'HR', 'FINANCE'), (0, validateRequest_1.validateRequest)(createLoanSchema), loanController.createLoan);
router.post('/:id/approve', (0, authenticateToken_1.authorize)('ADMIN', 'HR', 'FINANCE'), loanController.approveLoan);
router.post('/:id/disburse', (0, authenticateToken_1.authorize)('ADMIN', 'HR', 'FINANCE'), loanController.disburseLoan);
router.post('/:loanId/installments/:installmentId/pay', (0, authenticateToken_1.authorize)('ADMIN', 'HR', 'FINANCE'), (0, validateRequest_1.validateRequest)(recordPaymentSchema), loanController.recordPayment);
router.post('/:id/cancel', (0, authenticateToken_1.authorize)('ADMIN', 'HR', 'FINANCE'), loanController.cancelLoan);
exports.default = router;
