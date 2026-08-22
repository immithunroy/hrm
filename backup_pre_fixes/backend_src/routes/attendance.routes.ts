import { Router } from 'express';
import { 
  getAttendanceRecords, 
  getAttendanceById, 
  createAttendanceRecord,
  updateAttendanceRecord,
  deleteAttendanceRecord,
  getTodayAttendance,
  getAttendanceStats,
  exportAttendance
} from '../controllers/attendance.controller';
import { authenticateToken } from '../middleware/authenticateToken';
import { authorize } from '../middleware/authenticateToken';
import { validateRequest } from '../middleware/validateRequest';
import { attendanceSchema, updateAttendanceSchema } from '../schemas/attendance.schema';

const router = Router();

// Protect all routes
router.use(authenticateToken);

// Attendance routes
router.get('/', authorize('ADMIN', 'MANAGER', 'HR'), getAttendanceRecords);
router.get('/export', authorize('ADMIN', 'MANAGER', 'HR'), exportAttendance);

// Special routes (must be registered before /:id)
router.get('/today', authorize('ADMIN', 'MANAGER', 'HR'), getTodayAttendance);
router.get('/stats', authorize('ADMIN', 'MANAGER', 'HR'), getAttendanceStats);

router.get('/:id', authorize('ADMIN', 'MANAGER', 'HR'), getAttendanceById);
router.post('/', authorize('ADMIN', 'HR'), validateRequest(attendanceSchema), createAttendanceRecord);
router.put('/:id', authorize('ADMIN', 'HR'), validateRequest(updateAttendanceSchema), updateAttendanceRecord);
router.delete('/:id', authorize('ADMIN', 'HR'), deleteAttendanceRecord);

export default router;