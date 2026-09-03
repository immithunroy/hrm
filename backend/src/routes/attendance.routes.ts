/**
 * Attendance Routes
 * 
 * Manages employee attendance tracking including check-in/check-out,
 * attendance records, statistics, and export functionality.
 * 
 * All routes require authentication. Authorization varies by role:
 *   - ADMIN/HR: Full CRUD access
 *   - MANAGER: Read access to team attendance
 *   - EMPLOYEE: Read access to own attendance, can check in/out
 * 
 * Endpoints:
 *   POST /checkin          - Mobile check-in (all roles)
 *   POST /checkout         - Mobile check-out (all roles)
 *   GET  /my               - Get own attendance records (all roles)
 *   GET  /                 - List all attendance records (paginated, filterable)
 *   GET  /export           - Export attendance data (all roles)
 *   GET  /today            - Get today's attendance summary (all roles)
 *   GET  /stats            - Get attendance statistics (all roles)
 *   GET  /:id              - Get attendance by ID (all roles)
 *   POST /                 - Create attendance record (admin/HR only)
 *   PUT  /:id              - Update attendance record (admin/HR only)
 *   DELETE /:id            - Delete attendance record (admin/HR only)
 */

import { Router } from 'express';
import { 
  getAttendanceRecords, 
  getAttendanceById, 
  createAttendanceRecord,
  updateAttendanceRecord,
  deleteAttendanceRecord,
  getTodayAttendance,
  getAttendanceStats,
  exportAttendance,
  mobileCheckIn,
  mobileCheckOut,
  getMyAttendance
} from '../controllers/attendance.controller';
import { authenticateToken } from '../middleware/authenticateToken';
import { authorize } from '../middleware/authenticateToken';
import { validateRequest } from '../middleware/validateRequest';
import { attendanceSchema, updateAttendanceSchema } from '../schemas/attendance.schema';

const router = Router();

// Protect all routes — authentication required for every endpoint
router.use(authenticateToken);

// Mobile check-in/check-out (must be before /:id to avoid param collision)
router.post('/checkin', authorize('EMPLOYEE', 'MANAGER', 'HR', 'ADMIN'), mobileCheckIn);
router.post('/checkout', authorize('EMPLOYEE', 'MANAGER', 'HR', 'ADMIN'), mobileCheckOut);
router.get('/my', authorize('EMPLOYEE', 'MANAGER', 'HR', 'ADMIN'), getMyAttendance);

// Attendance records and export
router.get('/', authorize('ADMIN', 'MANAGER', 'HR', 'EMPLOYEE'), getAttendanceRecords);
router.get('/export', authorize('ADMIN', 'MANAGER', 'HR', 'EMPLOYEE'), exportAttendance);

// Special routes (must be registered before /:id to avoid param collision)
router.get('/today', authorize('ADMIN', 'MANAGER', 'HR', 'EMPLOYEE'), getTodayAttendance);
router.get('/stats', authorize('ADMIN', 'MANAGER', 'HR', 'EMPLOYEE'), getAttendanceStats);

// CRUD operations on individual attendance records
router.get('/:id', authorize('ADMIN', 'MANAGER', 'HR', 'EMPLOYEE'), getAttendanceById);
router.post('/', authorize('ADMIN', 'HR'), validateRequest(attendanceSchema), createAttendanceRecord);
router.put('/:id', authorize('ADMIN', 'HR'), validateRequest(updateAttendanceSchema), updateAttendanceRecord);
router.delete('/:id', authorize('ADMIN', 'HR'), deleteAttendanceRecord);

export default router;