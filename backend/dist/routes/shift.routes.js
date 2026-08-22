"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const shift_controller_1 = require("../controllers/shift.controller");
const authenticateToken_1 = require("../middleware/authenticateToken");
const authenticateToken_2 = require("../middleware/authenticateToken");
const validateRequest_1 = require("../middleware/validateRequest");
const shift_schema_1 = require("../schemas/shift.schema");
const router = (0, express_1.Router)();
// Protect all routes
router.use(authenticateToken_1.authenticateToken);
// Shift routes
router.get('/', (0, authenticateToken_2.authorize)('ADMIN', 'MANAGER', 'HR', 'EMPLOYEE'), shift_controller_1.getShifts);
router.post('/', (0, authenticateToken_2.authorize)('ADMIN', 'HR'), (0, validateRequest_1.validateRequest)(shift_schema_1.shiftSchema), shift_controller_1.createShift);
// Shift assignment routes (registered before /:id so paths are unambiguous)
router.get('/assignments', (0, authenticateToken_2.authorize)('ADMIN', 'MANAGER', 'HR', 'EMPLOYEE'), shift_controller_1.getShiftAssignments);
router.post('/assignments', (0, authenticateToken_2.authorize)('ADMIN', 'HR'), (0, validateRequest_1.validateRequest)(shift_schema_1.shiftAssignmentSchema), shift_controller_1.createShiftAssignment);
router.put('/assignments/:assignmentId', (0, authenticateToken_2.authorize)('ADMIN', 'HR'), (0, validateRequest_1.validateRequest)(shift_schema_1.updateShiftAssignmentSchema), shift_controller_1.updateShiftAssignment);
router.delete('/assignments/:assignmentId', (0, authenticateToken_2.authorize)('ADMIN', 'HR'), shift_controller_1.deleteShiftAssignment);
router.get('/:id', (0, authenticateToken_2.authorize)('ADMIN', 'MANAGER', 'HR', 'EMPLOYEE'), shift_controller_1.getShiftById);
router.put('/:id', (0, authenticateToken_2.authorize)('ADMIN', 'HR'), (0, validateRequest_1.validateRequest)(shift_schema_1.updateShiftSchema), shift_controller_1.updateShift);
router.delete('/:id', (0, authenticateToken_2.authorize)('ADMIN', 'HR'), shift_controller_1.deleteShift);
exports.default = router;
