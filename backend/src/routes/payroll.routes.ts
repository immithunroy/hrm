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

// Protect all routes
router.use(authenticateToken);

// Payroll routes
router.get('/', authorize('ADMIN', 'MANAGER', 'HR', 'FINANCE', 'EMPLOYEE'), getPayrollRecords);
router.get('/payslip/:employeeId', authorize('ADMIN', 'MANAGER', 'HR', 'FINANCE', 'EMPLOYEE'), exportEmployeePayslip);
router.get('/stats', authorize('ADMIN', 'MANAGER', 'HR', 'FINANCE', 'EMPLOYEE'), getPayrollStats);
router.get('/:id', authorize('ADMIN', 'MANAGER', 'HR', 'FINANCE', 'EMPLOYEE'), getPayrollById);
router.post('/', authorize('ADMIN', 'HR', 'FINANCE'), validateRequest(payrollSchema), createPayrollRecord);
router.put('/:id', authorize('ADMIN', 'HR', 'FINANCE'), validateRequest(updatePayrollSchema), updatePayrollRecord);
router.delete('/:id', authorize('ADMIN', 'HR', 'FINANCE'), deletePayrollRecord);

// Special routes
router.post('/process', authorize('ADMIN', 'HR', 'FINANCE'), processPayroll);

export default router;