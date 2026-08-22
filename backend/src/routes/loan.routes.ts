import { Router } from 'express';
import { validateRequest } from '../middleware/validateRequest';
import { z } from 'zod';
import { authenticateToken, authorize } from '../middleware/authenticateToken';
import * as loanController from '../controllers/loan.controller';

const router = Router();

// Protect all loan routes
router.use(authenticateToken);

const createLoanSchema = z.object({
  employeeId: z.string().uuid('Invalid employee ID'),
  amount: z.number().positive('Amount must be positive'),
  interestRate: z.number().min(0).default(0),
  purpose: z.string().optional(),
  startDate: z.string().datetime('Invalid start date format'),
  endDate: z.string().datetime('Invalid end date format').optional(),
  installmentAmount: z.number().positive().optional(),
  installmentCount: z.number().int().positive().optional(),
  frequency: z.enum(['WEEKLY', 'BIWEEKLY', 'MONTHLY', 'QUARTERLY']).default('MONTHLY'),
  notes: z.string().optional(),
});

const recordPaymentSchema = z.object({
  amount: z.number().positive('Amount must be positive'),
  payrollId: z.string().uuid().optional(),
});

router.get('/', authorize('ADMIN', 'HR', 'FINANCE', 'MANAGER', 'EMPLOYEE'), loanController.getLoans);
router.get('/upcoming', authorize('ADMIN', 'HR', 'FINANCE', 'MANAGER', 'EMPLOYEE'), loanController.getUpcomingInstallments);
router.get('/:id', authorize('ADMIN', 'HR', 'FINANCE', 'MANAGER', 'EMPLOYEE'), loanController.getLoanById);
router.get('/:employeeId/summary', authorize('ADMIN', 'HR', 'FINANCE', 'MANAGER', 'EMPLOYEE'), loanController.getLoanSummary);
router.get('/:loanId/installments', authorize('ADMIN', 'HR', 'FINANCE', 'MANAGER', 'EMPLOYEE'), loanController.getInstallmentsByLoan);
router.post('/', authorize('ADMIN', 'HR', 'FINANCE'), validateRequest(createLoanSchema), loanController.createLoan);
router.post('/:id/approve', authorize('ADMIN', 'HR', 'FINANCE'), loanController.approveLoan);
router.post('/:id/disburse', authorize('ADMIN', 'HR', 'FINANCE'), loanController.disburseLoan);
router.post('/:loanId/installments/:installmentId/pay', authorize('ADMIN', 'HR', 'FINANCE'), validateRequest(recordPaymentSchema), loanController.recordPayment);
router.post('/:id/cancel', authorize('ADMIN', 'HR', 'FINANCE'), loanController.cancelLoan);

export default router;
