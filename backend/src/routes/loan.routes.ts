/**
 * Loan Routes
 * 
 * Manages employee loans including creation, approval, disbursement,
 * installment payments, and loan lifecycle management.
 * 
 * All routes require authentication. Authorization varies by role:
 *   - ADMIN/HR/FINANCE: Full loan management (create, approve, disburse, cancel)
 *   - MANAGER: Read access to loan data
 *   - EMPLOYEE: Read access to own loan data
 * 
 * Endpoints:
 *   GET    /                                          - List all loans (paginated, filterable)
 *   GET    /upcoming                                  - Get upcoming loan installments
 *   GET    /:id                                       - Get loan by ID
 *   GET    /:employeeId/summary                       - Get loan summary for employee
 *   GET    /:loanId/installments                      - Get installments for a loan
 *   POST   /                                          - Create new loan (admin/HR/finance only)
 *   POST   /:id/approve                               - Approve loan (admin/HR/finance only)
 *   POST   /:id/disburse                              - Disburse loan funds (admin/HR/finance only)
 *   POST   /:loanId/installments/:installmentId/pay   - Record installment payment (admin/HR/finance only)
 *   POST   /:id/cancel                                - Cancel loan (admin/HR/finance only)
 */

import { Router } from 'express';
import { validateRequest } from '../middleware/validateRequest';
import { z } from 'zod';
import { authenticateToken, authorize } from '../middleware/authenticateToken';
import * as loanController from '../controllers/loan.controller';

const router = Router();

// Protect all loan routes — authentication required for every endpoint
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

// Loan listing and stats
router.get('/', authorize('ADMIN', 'HR', 'FINANCE', 'MANAGER', 'EMPLOYEE'), loanController.getLoans);
router.get('/upcoming', authorize('ADMIN', 'HR', 'FINANCE', 'MANAGER', 'EMPLOYEE'), loanController.getUpcomingInstallments);

// Individual loan lookup (must be before /:employeeId/summary to avoid param collision)
router.get('/:id', authorize('ADMIN', 'HR', 'FINANCE', 'MANAGER', 'EMPLOYEE'), loanController.getLoanById);
router.get('/:employeeId/summary', authorize('ADMIN', 'HR', 'FINANCE', 'MANAGER', 'EMPLOYEE'), loanController.getLoanSummary);
router.get('/:loanId/installments', authorize('ADMIN', 'HR', 'FINANCE', 'MANAGER', 'EMPLOYEE'), loanController.getInstallmentsByLoan);

// Loan lifecycle actions (admin/HR/finance only)
router.post('/', authorize('ADMIN', 'HR', 'FINANCE'), validateRequest(createLoanSchema), loanController.createLoan);
router.post('/:id/approve', authorize('ADMIN', 'HR', 'FINANCE'), loanController.approveLoan);
router.post('/:id/disburse', authorize('ADMIN', 'HR', 'FINANCE'), loanController.disburseLoan);
router.post('/:loanId/installments/:installmentId/pay', authorize('ADMIN', 'HR', 'FINANCE'), validateRequest(recordPaymentSchema), loanController.recordPayment);
router.post('/:id/cancel', authorize('ADMIN', 'HR', 'FINANCE'), loanController.cancelLoan);

export default router;
