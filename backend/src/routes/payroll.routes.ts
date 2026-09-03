/**
 * Payroll Routes
 * 
 * Manages employee payroll records, payslip generation, and payroll processing.
 * 
 * All routes require authentication. Authorization varies by role:
 *   - ADMIN/HR/FINANCE: Full CRUD access and payroll processing
 *   - MANAGER: Read access to team payroll data
 *   - EMPLOYEE: Read access to own payroll data
 * 
 * Endpoints:
 *   GET  /                       - List all payroll records (paginated, filterable)
 *   GET  /payslip/:employeeId    - Export employee payslip (PDF generation)
 *   GET  /stats                  - Get payroll statistics and summaries
 *   GET  /:id                    - Get payroll record by ID
 *   POST /                       - Create new payroll record (admin/HR/finance only)
 *   PUT  /:id                    - Update payroll record (admin/HR/finance only)
 *   DELETE /:id                  - Delete payroll record (admin/HR/finance only)
 *   POST /process                - Process payroll for a period (admin/HR/finance only)
 */

import { Router } from 'express';
import { 
  getPayrollRecords, 
  getPayrollById, 
  createPayrollRecord,
  updatePayrollRecord,
  deletePayrollRecord,
  processPayroll,
  getPayrollStats,
  exportEmployeePayslip
} from '../controllers/payroll.controller';
import { authenticateToken } from '../middleware/authenticateToken';
import { authorize } from '../middleware/authenticateToken';
import { validateRequest } from '../middleware/validateRequest';
import { payrollSchema, updatePayrollSchema } from '../schemas/payroll.schema';

const router = Router();

// Protect all routes — authentication required for every endpoint
router.use(authenticateToken);

// Payroll records listing and stats
router.get('/', authorize('ADMIN', 'MANAGER', 'HR', 'FINANCE', 'EMPLOYEE'), getPayrollRecords);
router.get('/stats', authorize('ADMIN', 'MANAGER', 'HR', 'FINANCE', 'EMPLOYEE'), getPayrollStats);

// Payslip export (must be before /:id to avoid param collision)
router.get('/payslip/:employeeId', authorize('ADMIN', 'MANAGER', 'HR', 'FINANCE', 'EMPLOYEE'), exportEmployeePayslip);

// Individual payroll record CRUD
router.get('/:id', authorize('ADMIN', 'MANAGER', 'HR', 'FINANCE', 'EMPLOYEE'), getPayrollById);
router.post('/', authorize('ADMIN', 'HR', 'FINANCE'), validateRequest(payrollSchema), createPayrollRecord);
router.put('/:id', authorize('ADMIN', 'HR', 'FINANCE'), validateRequest(updatePayrollSchema), updatePayrollRecord);
router.delete('/:id', authorize('ADMIN', 'HR', 'FINANCE'), deletePayrollRecord);

// Payroll processing action (admin/HR/finance only)
router.post('/process', authorize('ADMIN', 'HR', 'FINANCE'), processPayroll);

export default router;