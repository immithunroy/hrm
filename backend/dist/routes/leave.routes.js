"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const leave_controller_1 = require("../controllers/leave.controller");
const authenticateToken_1 = require("../middleware/authenticateToken");
const authenticateToken_2 = require("../middleware/authenticateToken");
const validateRequest_1 = require("../middleware/validateRequest");
const leaveRequest_schema_1 = require("../schemas/leaveRequest.schema");
const router = (0, express_1.Router)();
// Protect all routes
router.use(authenticateToken_1.authenticateToken);
// Leave request routes
router.get('/', (0, authenticateToken_2.authorize)('ADMIN', 'MANAGER', 'HR', 'EMPLOYEE'), leave_controller_1.getLeaveRequests);
router.get('/stats', (0, authenticateToken_2.authorize)('ADMIN', 'MANAGER', 'HR', 'EMPLOYEE'), leave_controller_1.getLeaveStats);
router.get('/:id', (0, authenticateToken_2.authorize)('ADMIN', 'MANAGER', 'HR', 'EMPLOYEE'), leave_controller_1.getLeaveRequestById);
router.post('/', (0, authenticateToken_2.authorize)('ADMIN', 'MANAGER', 'HR', 'EMPLOYEE'), (0, validateRequest_1.validateRequest)(leaveRequest_schema_1.leaveRequestSchema), leave_controller_1.createLeaveRequest);
router.put('/:id', (0, authenticateToken_2.authorize)('ADMIN', 'MANAGER', 'HR', 'EMPLOYEE'), (0, validateRequest_1.validateRequest)(leaveRequest_schema_1.updateLeaveRequestSchema), leave_controller_1.updateLeaveRequest);
router.delete('/:id', (0, authenticateToken_2.authorize)('ADMIN', 'MANAGER', 'HR', 'EMPLOYEE'), leave_controller_1.deleteLeaveRequest);
// Special routes
router.patch('/:id/approve', (0, authenticateToken_2.authorize)('ADMIN', 'MANAGER', 'HR'), leave_controller_1.approveLeaveRequest);
router.patch('/:id/reject', (0, authenticateToken_2.authorize)('ADMIN', 'MANAGER', 'HR'), leave_controller_1.rejectLeaveRequest);
exports.default = router;
