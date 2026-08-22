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
import { authorizeOrSelf } from '../middleware/authenticateToken';
import { validateRequest } from '../middleware/validateRequest';
import { leaveRequestSchema, updateLeaveRequestSchema } from '../schemas/leaveRequest.schema';

const router = Router();

// Protect all routes
router.use(authenticateToken);

// Leave request routes
router.get('/', authorize('ADMIN', 'MANAGER', 'HR', 'EMPLOYEE'), getLeaveRequests);
router.get('/stats', authorize('ADMIN', 'MANAGER', 'HR', 'EMPLOYEE'), getLeaveStats);

// Self or admin/HR/manager can view individual leave request
router.get('/:id', authorizeOrSelf('ADMIN', 'MANAGER', 'HR'), getLeaveRequestById);

// Anyone can create a leave request (controller auto-sets employeeId for EMPLOYEE)
router.post('/', authorize('ADMIN', 'MANAGER', 'HR', 'EMPLOYEE'), validateRequest(leaveRequestSchema), createLeaveRequest);

// Self or admin/HR/manager can update leave request (controller enforces ownership + PENDING status for EMPLOYEE)
router.put('/:id', authorizeOrSelf('ADMIN', 'MANAGER', 'HR'), validateRequest(updateLeaveRequestSchema), updateLeaveRequest);

// Self or admin/HR/manager can delete leave request (controller enforces ownership + PENDING status for EMPLOYEE)
router.delete('/:id', authorizeOrSelf('ADMIN', 'MANAGER', 'HR'), deleteLeaveRequest);

// Special routes — admin/HR/manager only
router.patch('/:id/approve', authorize('ADMIN', 'MANAGER', 'HR'), approveLeaveRequest);
router.patch('/:id/reject', authorize('ADMIN', 'MANAGER', 'HR'), rejectLeaveRequest);

export default router;
