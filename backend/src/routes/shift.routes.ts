/**
 * Shift Routes
 * 
 * Manages work shifts and shift assignments for employees.
 * 
 * All routes require authentication. Authorization varies by role:
 *   - ADMIN/HR: Full CRUD access to shifts and assignments
 *   - MANAGER: Read access to shifts and assignments
 *   - EMPLOYEE: Read access to shifts and assignments
 * 
 * Endpoints:
 *   GET    /                          - List all shifts (paginated, filterable)
 *   POST   /                          - Create new shift (admin/HR only)
 *   GET    /assignments               - List all shift assignments
 *   POST   /assignments               - Create shift assignment (admin/HR only)
 *   PUT    /assignments/:assignmentId - Update shift assignment (admin/HR only)
 *   DELETE /assignments/:assignmentId - Delete shift assignment (admin/HR only)
 *   GET    /:id                       - Get shift by ID
 *   PUT    /:id                       - Update shift (admin/HR only)
 *   DELETE /:id                       - Delete shift (admin/HR only)
 */

import { Router } from 'express';
import { 
  getShifts, 
  getShiftById, 
  createShift,
  updateShift,
  deleteShift,
  getShiftAssignments,
  createShiftAssignment,
  updateShiftAssignment,
  deleteShiftAssignment
} from '../controllers/shift.controller';
import { authenticateToken } from '../middleware/authenticateToken';
import { authorize } from '../middleware/authenticateToken';
import { validateRequest } from '../middleware/validateRequest';
import { shiftSchema, updateShiftSchema, shiftAssignmentSchema, updateShiftAssignmentSchema } from '../schemas/shift.schema';

const router = Router();

// Protect all routes — authentication required for every endpoint
router.use(authenticateToken);

// Shift routes
router.get('/', authorize('ADMIN', 'MANAGER', 'HR', 'EMPLOYEE'), getShifts);
router.post('/', authorize('ADMIN', 'HR'), validateRequest(shiftSchema), createShift);

// Shift assignment routes (registered before /:id so paths are unambiguous)
router.get('/assignments', authorize('ADMIN', 'MANAGER', 'HR', 'EMPLOYEE'), getShiftAssignments);
router.post('/assignments', authorize('ADMIN', 'HR'), validateRequest(shiftAssignmentSchema), createShiftAssignment);
router.put('/assignments/:assignmentId', authorize('ADMIN', 'HR'), validateRequest(updateShiftAssignmentSchema), updateShiftAssignment);
router.delete('/assignments/:assignmentId', authorize('ADMIN', 'HR'), deleteShiftAssignment);

// Individual shift CRUD
router.get('/:id', authorize('ADMIN', 'MANAGER', 'HR', 'EMPLOYEE'), getShiftById);
router.put('/:id', authorize('ADMIN', 'HR'), validateRequest(updateShiftSchema), updateShift);
router.delete('/:id', authorize('ADMIN', 'HR'), deleteShift);

export default router;