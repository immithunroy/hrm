"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const employee_controller_1 = require("../controllers/employee.controller");
const authenticateToken_1 = require("../middleware/authenticateToken");
const authenticateToken_2 = require("../middleware/authenticateToken");
const validateRequest_1 = require("../middleware/validateRequest");
const employee_schema_1 = require("../schemas/employee.schema");
const router = (0, express_1.Router)();
// Protect all routes
router.use(authenticateToken_1.authenticateToken);
// Employee management routes
router.get('/', (0, authenticateToken_2.authorize)('ADMIN', 'MANAGER', 'HR', 'EMPLOYEE'), employee_controller_1.getEmployees);
router.get('/meta', (0, authenticateToken_2.authorize)('ADMIN', 'MANAGER', 'HR', 'EMPLOYEE'), employee_controller_1.getEmployeeMeta);
router.get('/:id', (0, authenticateToken_2.authorize)('ADMIN', 'MANAGER', 'HR', 'EMPLOYEE'), employee_controller_1.getEmployeeById);
router.post('/', (0, authenticateToken_2.authorize)('ADMIN', 'HR'), (0, validateRequest_1.validateRequest)(employee_schema_1.employeeSchema), employee_controller_1.createEmployee);
router.put('/:id', (0, authenticateToken_2.authorize)('ADMIN', 'HR'), (0, validateRequest_1.validateRequest)(employee_schema_1.updateEmployeeSchema), employee_controller_1.updateEmployee);
router.delete('/:id', (0, authenticateToken_2.authorize)('ADMIN', 'HR'), employee_controller_1.deleteEmployee);
// Employee document upload (photograph / photo ID / CV)
router.post('/:id/documents', (0, authenticateToken_2.authorize)('ADMIN', 'HR'), employee_controller_1.uploadEmployeeDocument);
// Employment status actions (terminate / resign / retire)
// Must be registered AFTER /:id/documents so 'documents' is not treated as an action.
router.post('/:id/:action', (0, authenticateToken_2.authorize)('ADMIN', 'HR'), employee_controller_1.setEmploymentStatus);
// Employee-specific routes
router.get('/:id/attendance', (0, authenticateToken_2.authorize)('ADMIN', 'MANAGER', 'HR', 'EMPLOYEE'), employee_controller_1.getEmployeeAttendance);
router.get('/:id/payroll', (0, authenticateToken_2.authorize)('ADMIN', 'MANAGER', 'HR', 'EMPLOYEE'), employee_controller_1.getEmployeePayroll);
router.get('/:id/leave-balance', (0, authenticateToken_2.authorize)('ADMIN', 'MANAGER', 'HR', 'EMPLOYEE'), employee_controller_1.getEmployeeLeaveBalance);
router.put('/:id/leave-balance', (0, authenticateToken_2.authorize)('ADMIN', 'HR'), employee_controller_1.updateEmployeeLeaveBalance);
exports.default = router;
