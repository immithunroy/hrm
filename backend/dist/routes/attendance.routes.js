"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const attendance_controller_1 = require("../controllers/attendance.controller");
const authenticateToken_1 = require("../middleware/authenticateToken");
const authenticateToken_2 = require("../middleware/authenticateToken");
const validateRequest_1 = require("../middleware/validateRequest");
const attendance_schema_1 = require("../schemas/attendance.schema");
const router = (0, express_1.Router)();
// Protect all routes
router.use(authenticateToken_1.authenticateToken);
// Attendance routes
router.get('/', (0, authenticateToken_2.authorize)('ADMIN', 'MANAGER', 'HR', 'EMPLOYEE'), attendance_controller_1.getAttendanceRecords);
router.get('/export', (0, authenticateToken_2.authorize)('ADMIN', 'MANAGER', 'HR', 'EMPLOYEE'), attendance_controller_1.exportAttendance);
// Special routes (must be registered before /:id)
router.get('/today', (0, authenticateToken_2.authorize)('ADMIN', 'MANAGER', 'HR', 'EMPLOYEE'), attendance_controller_1.getTodayAttendance);
router.get('/stats', (0, authenticateToken_2.authorize)('ADMIN', 'MANAGER', 'HR', 'EMPLOYEE'), attendance_controller_1.getAttendanceStats);
router.get('/:id', (0, authenticateToken_2.authorize)('ADMIN', 'MANAGER', 'HR', 'EMPLOYEE'), attendance_controller_1.getAttendanceById);
router.post('/', (0, authenticateToken_2.authorize)('ADMIN', 'HR'), (0, validateRequest_1.validateRequest)(attendance_schema_1.attendanceSchema), attendance_controller_1.createAttendanceRecord);
router.put('/:id', (0, authenticateToken_2.authorize)('ADMIN', 'HR'), (0, validateRequest_1.validateRequest)(attendance_schema_1.updateAttendanceSchema), attendance_controller_1.updateAttendanceRecord);
router.delete('/:id', (0, authenticateToken_2.authorize)('ADMIN', 'HR'), attendance_controller_1.deleteAttendanceRecord);
exports.default = router;
