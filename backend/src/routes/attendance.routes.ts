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

// Protect all routes
router.use(authenticateToken);

// Mobile check-in/check-out (must be before /:id)
router.post('/checkin', authorize('EMPLOYEE', 'MANAGER', 'HR', 'ADMIN'), mobileCheckIn);
router.post('/checkout', authorize('EMPLOYEE', 'MANAGER', 'HR', 'ADMIN'), mobileCheckOut);
router.get('/my', authorize('EMPLOYEE', 'MANAGER', 'HR', 'ADMIN'), getMyAttendance);

// Attendance routes
router.get('/', authorize('ADMIN', 'MANAGER', 'HR', 'EMPLOYEE'), getAttendanceRecords);
router.get('/export', authorize('ADMIN', 'MANAGER', 'HR', 'EMPLOYEE'), exportAttendance);

// Special routes (must be registered before /:id)
router.get('/today', authorize('ADMIN', 'MANAGER', 'HR', 'EMPLOYEE'), getTodayAttendance);
router.get('/stats', authorize('ADMIN', 'MANAGER', 'HR', 'EMPLOYEE'), getAttendanceStats);

router.get('/:id', authorize('ADMIN', 'MANAGER', 'HR', 'EMPLOYEE'), getAttendanceById);
router.post('/', authorize('ADMIN', 'HR'), validateRequest(attendanceSchema), createAttendanceRecord);
router.put('/:id', authorize('ADMIN', 'HR'), validateRequest(updateAttendanceSchema), updateAttendanceRecord);
router.delete('/:id', authorize('ADMIN', 'HR'), deleteAttendanceRecord);

export default router;