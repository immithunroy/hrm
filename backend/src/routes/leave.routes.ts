/**
 * Leave Routes
 * 
 * Manages employee leave requests including creation, updates, approval, and rejection.
 * 
 * All routes require authentication. Authorization varies by role:
 *   - ADMIN/HR/MANAGER: Full access to all leave requests
 *   - EMPLOYEE: Can create, update, and delete own leave requests (PENDING status only)
 * 
 * Endpoints:
 *   GET  /            - List all leave requests (paginated, filterable)
 *   GET  /stats       - Get leave statistics and summaries
 *   GET  /:id         - Get leave request by ID (self or admin/HR/manager)
 *   POST /            - Create new leave request (all roles, controller auto-sets employeeId)
 *   PUT  /:id         - Update leave request (self or admin/HR/manager, PENDING status only for employees)
 *   DELETE /:id       - Delete leave request (self or admin/HR/manager, PENDING status only for employees)
 *   PATCH /:id/approve - Approve leave request (admin/HR/manager only)
 *   PATCH /:id/reject  - Reject leave request (admin/HR/manager only)
 */

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

// Protect all routes — authentication required for every endpoint
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

// Approval/rejection actions — admin/HR/manager only
router.patch('/:id/approve', authorize('ADMIN', 'MANAGER', 'HR'), approveLeaveRequest);
router.patch('/:id/reject', authorize('ADMIN', 'MANAGER', 'HR'), rejectLeaveRequest);

export default router;
