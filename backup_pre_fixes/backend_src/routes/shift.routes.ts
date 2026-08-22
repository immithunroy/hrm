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

// Protect all routes
router.use(authenticateToken);

// Shift routes
router.get('/', authorize('ADMIN', 'MANAGER', 'HR'), getShifts);
router.post('/', authorize('ADMIN', 'HR'), validateRequest(shiftSchema), createShift);

// Shift assignment routes (registered before /:id so paths are unambiguous)
router.get('/assignments', authorize('ADMIN', 'MANAGER', 'HR'), getShiftAssignments);
router.post('/assignments', authorize('ADMIN', 'HR'), validateRequest(shiftAssignmentSchema), createShiftAssignment);
router.put('/assignments/:assignmentId', authorize('ADMIN', 'HR'), validateRequest(updateShiftAssignmentSchema), updateShiftAssignment);
router.delete('/assignments/:assignmentId', authorize('ADMIN', 'HR'), deleteShiftAssignment);

router.get('/:id', authorize('ADMIN', 'MANAGER', 'HR'), getShiftById);
router.put('/:id', authorize('ADMIN', 'HR'), validateRequest(updateShiftSchema), updateShift);
router.delete('/:id', authorize('ADMIN', 'HR'), deleteShift);

export default router;