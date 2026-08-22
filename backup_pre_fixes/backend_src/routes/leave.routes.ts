import { Router } from 'express';
import { 
  getLeaveRequests, 
  getLeaveRequestById, 
  createLeaveRequest,
  updateLeaveRequest,
  deleteLeaveRequest,
  approveLeaveRequest,
  rejectLeaveRequest,
  getLeaveStats
} from '../controllers/leave.controller';
import { authenticateToken } from '../middleware/authenticateToken';
import { authorize } from '../middleware/authenticateToken';
import { validateRequest } from '../middleware/validateRequest';
import { leaveRequestSchema, updateLeaveRequestSchema } from '../schemas/leaveRequest.schema';

const router = Router();

// Protect all routes
router.use(authenticateToken);

// Leave request routes
router.get('/', authorize('ADMIN', 'MANAGER', 'HR'), getLeaveRequests);
router.get('/stats', authorize('ADMIN', 'MANAGER', 'HR'), getLeaveStats);
router.get('/:id', authorize('ADMIN', 'MANAGER', 'HR'), getLeaveRequestById);
router.post('/', authorize('ADMIN', 'MANAGER', 'HR'), validateRequest(leaveRequestSchema), createLeaveRequest);
router.put('/:id', authorize('ADMIN', 'MANAGER', 'HR'), validateRequest(updateLeaveRequestSchema), updateLeaveRequest);
router.delete('/:id', authorize('ADMIN', 'MANAGER', 'HR'), deleteLeaveRequest);

// Special routes
router.patch('/:id/approve', authorize('ADMIN', 'MANAGER', 'HR'), approveLeaveRequest);
router.patch('/:id/reject', authorize('ADMIN', 'MANAGER', 'HR'), rejectLeaveRequest);

export default router;