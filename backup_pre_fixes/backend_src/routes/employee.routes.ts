import { Router } from 'express';
import { 
  getEmployees, 
  getEmployeeById, 
  createEmployee, 
  updateEmployee, 
  deleteEmployee,
  setEmploymentStatus,
  uploadEmployeeDocument,
  getEmployeeAttendance,
  getEmployeePayroll,
  getEmployeeLeaveBalance,
  updateEmployeeLeaveBalance,
  getEmployeeMeta
} from '../controllers/employee.controller';
import { authenticateToken } from '../middleware/authenticateToken';
import { authorize } from '../middleware/authenticateToken';
import { validateRequest } from '../middleware/validateRequest';
import { employeeSchema, updateEmployeeSchema } from '../schemas/employee.schema';

const router = Router();

// Protect all routes
router.use(authenticateToken);

// Employee management routes
router.get('/', authorize('ADMIN', 'MANAGER', 'HR'), getEmployees);
router.get('/meta', authorize('ADMIN', 'MANAGER', 'HR'), getEmployeeMeta);
router.get('/:id', authorize('ADMIN', 'MANAGER', 'HR'), getEmployeeById);
router.post('/', authorize('ADMIN', 'HR'), validateRequest(employeeSchema), createEmployee);
router.put('/:id', authorize('ADMIN', 'HR'), validateRequest(updateEmployeeSchema), updateEmployee);
router.delete('/:id', authorize('ADMIN', 'HR'), deleteEmployee);

// Employee document upload (photograph / photo ID / CV)
router.post('/:id/documents', authorize('ADMIN', 'HR'), uploadEmployeeDocument);

// Employment status actions (terminate / resign / retire)
// Must be registered AFTER /:id/documents so 'documents' is not treated as an action.
router.post('/:id/:action', authorize('ADMIN', 'HR'), setEmploymentStatus);

// Employee-specific routes
router.get('/:id/attendance', authorize('ADMIN', 'MANAGER', 'HR'), getEmployeeAttendance);
router.get('/:id/payroll', authorize('ADMIN', 'MANAGER', 'HR'), getEmployeePayroll);
router.get('/:id/leave-balance', authorize('ADMIN', 'MANAGER', 'HR'), getEmployeeLeaveBalance);
router.put('/:id/leave-balance', authorize('ADMIN', 'HR'), updateEmployeeLeaveBalance);

export default router;