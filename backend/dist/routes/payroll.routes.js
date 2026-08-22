"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const payroll_controller_1 = require("../controllers/payroll.controller");
const authenticateToken_1 = require("../middleware/authenticateToken");
const authenticateToken_2 = require("../middleware/authenticateToken");
const validateRequest_1 = require("../middleware/validateRequest");
const payroll_schema_1 = require("../schemas/payroll.schema");
const router = (0, express_1.Router)();
// Protect all routes
router.use(authenticateToken_1.authenticateToken);
// Payroll routes
router.get('/', (0, authenticateToken_2.authorize)('ADMIN', 'MANAGER', 'HR', 'FINANCE', 'EMPLOYEE'), payroll_controller_1.getPayrollRecords);
router.get('/payslip/:employeeId', (0, authenticateToken_2.authorize)('ADMIN', 'MANAGER', 'HR', 'FINANCE', 'EMPLOYEE'), payroll_controller_1.exportEmployeePayslip);
router.get('/stats', (0, authenticateToken_2.authorize)('ADMIN', 'MANAGER', 'HR', 'FINANCE', 'EMPLOYEE'), payroll_controller_1.getPayrollStats);
router.get('/:id', (0, authenticateToken_2.authorize)('ADMIN', 'MANAGER', 'HR', 'FINANCE', 'EMPLOYEE'), payroll_controller_1.getPayrollById);
router.post('/', (0, authenticateToken_2.authorize)('ADMIN', 'HR', 'FINANCE'), (0, validateRequest_1.validateRequest)(payroll_schema_1.payrollSchema), payroll_controller_1.createPayrollRecord);
router.put('/:id', (0, authenticateToken_2.authorize)('ADMIN', 'HR', 'FINANCE'), (0, validateRequest_1.validateRequest)(payroll_schema_1.updatePayrollSchema), payroll_controller_1.updatePayrollRecord);
router.delete('/:id', (0, authenticateToken_2.authorize)('ADMIN', 'HR', 'FINANCE'), payroll_controller_1.deletePayrollRecord);
// Special routes
router.post('/process', (0, authenticateToken_2.authorize)('ADMIN', 'HR', 'FINANCE'), payroll_controller_1.processPayroll);
exports.default = router;
