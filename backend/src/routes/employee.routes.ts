/**
 * Employee Routes
 * 
 * CRUD operations for employee management, including document uploads,
 * employment status changes, and employee-specific data lookups.
 * 
 * All routes require authentication. Authorization varies by role:
 *   - ADMIN/HR: Full access (create, update, delete, status changes)
 *   - MANAGER: Read access to team members
 *   - EMPLOYEE: Read-only access to own profile and subordinates
 * 
 * Endpoints:
 *   GET    /                        - List all employees (paginated, filterable)
 *   GET    /meta                    - Get employee metadata (dropdowns, counts)
 *   GET    /:id                     - Get employee by ID (self or admin/HR)
 *   POST   /                        - Create new employee (admin/HR only)
 *   PUT    /:id                     - Update employee (self or admin/HR)
 *   DELETE /:id                     - Delete employee (admin/HR only)
 *   POST   /:id/documents           - Upload employee document (admin/HR only)
 *   POST   /:id/:action             - Set employment status (admin/HR only)
 *   GET    /:id/attendance          - Get employee attendance records
 *   GET    /:id/payroll             - Get employee payroll records
 *   GET    /:id/leave-balance       - Get employee leave balance
 *   PUT    /:id/leave-balance       - Update employee leave balance (admin/HR only)
 */

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
import { authorizeOrSelf } from '../middleware/authenticateToken';
import { validateRequest } from '../middleware/validateRequest';
import { employeeSchema, updateEmployeeSchema } from '../schemas/employee.schema';

const router = Router();

// Protect all routes — authentication required for every endpoint
router.use(authenticateToken);

// Employee management routes
router.get('/', authorize('ADMIN', 'MANAGER', 'HR', 'EMPLOYEE'), getEmployees);
router.get('/meta', authorize('ADMIN', 'MANAGER', 'HR', 'EMPLOYEE'), getEmployeeMeta);

// Self or admin/HR can view employee detail
router.get('/:id', authorizeOrSelf('ADMIN', 'MANAGER', 'HR'), getEmployeeById);

router.post('/', authorize('ADMIN', 'HR'), validateRequest(employeeSchema), createEmployee);

// Self or admin/HR can update profile
router.put('/:id', authorizeOrSelf('ADMIN', 'HR'), validateRequest(updateEmployeeSchema), updateEmployee);

router.delete('/:id', authorize('ADMIN', 'HR'), deleteEmployee);

// Employee document upload (photograph / photo ID / CV)
router.post('/:id/documents', authorize('ADMIN', 'HR'), uploadEmployeeDocument);

// Employment status actions (terminate / resign / retire)
// Must be registered AFTER /:id/documents so 'documents' is not treated as an action.
router.post('/:id/:action', authorize('ADMIN', 'HR'), setEmploymentStatus);

// Employee-specific data routes — self or admin/HR can view
router.get('/:id/attendance', authorizeOrSelf('ADMIN', 'MANAGER', 'HR'), getEmployeeAttendance);
router.get('/:id/payroll', authorizeOrSelf('ADMIN', 'MANAGER', 'HR'), getEmployeePayroll);
router.get('/:id/leave-balance', authorizeOrSelf('ADMIN', 'MANAGER', 'HR'), getEmployeeLeaveBalance);
router.put('/:id/leave-balance', authorize('ADMIN', 'HR'), updateEmployeeLeaveBalance);

export default router;
