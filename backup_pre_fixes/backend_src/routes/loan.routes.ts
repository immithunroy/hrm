import { Router } from 'express';
import { validateRequest } from '../middleware/validateRequest';
import { z } from 'zod';
import * as loanController from '../controllers/loan.controller';

const router = Router();

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

router.post('/', validateRequest(createLoanSchema), loanController.createLoan);
router.get('/', loanController.getLoans);
router.get('/upcoming', loanController.getUpcomingInstallments);
router.get('/:id', loanController.getLoanById);
router.get('/:employeeId/summary', loanController.getLoanSummary);
router.get('/:loanId/installments', loanController.getInstallmentsByLoan);
router.post('/:id/approve', loanController.approveLoan);
router.post('/:id/disburse', loanController.disburseLoan);
router.post('/:loanId/installments/:installmentId/pay', validateRequest(recordPaymentSchema), loanController.recordPayment);
router.post('/:id/cancel', loanController.cancelLoan);

export default router;