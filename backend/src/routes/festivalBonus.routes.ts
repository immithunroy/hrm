/**
 * Festival Bonus Routes
 * 
 * Manages festival bonuses (Eid bonuses) including creation, auto-generation,
 * approval, installment payments, and cancellation.
 * 
 * All routes require authentication. Authorization varies by role:
 *   - ADMIN/HR/FINANCE: Full festival bonus management
 *   - MANAGER: Read access to festival bonus data
 *   - EMPLOYEE: Read access to own festival bonus data
 * 
 * Endpoints:
 *   GET  /              - List all festival bonuses (paginated, filterable)
 *   GET  /summary       - Get festival bonus summary and statistics
 *   GET  /:id           - Get festival bonus by ID
 *   POST /              - Create festival bonus for employee (admin/HR/finance only)
 *   POST /auto-generate - Auto-generate bonuses for all employees (admin/HR/finance only)
 *   POST /:id/approve   - Approve festival bonus (admin/HR/finance only)
 *   POST /:id/installment - Mark installment as paid (admin/HR/finance only)
 *   POST /:id/cancel    - Cancel festival bonus (admin/HR/finance only)
 *   DELETE /:id         - Delete festival bonus (admin/HR/finance only)
 */

import { Router } from 'express';
import { validateRequest } from '../middleware/validateRequest';
import { z } from 'zod';
import { authenticateToken, authorize } from '../middleware/authenticateToken';
import * as festivalBonusController from '../controllers/festivalBonus.controller';

const router = Router();

// Protect all festival bonus routes — authentication required for every endpoint
router.use(authenticateToken);

const createBonusSchema = z.object({
  employeeId: z.string().uuid('Invalid employee ID'),
  festivalType: z.enum(['EID_UL_FITR', 'EID_UL_ADHA', 'OTHER']),
  customFestivalName: z.string().optional(),
  year: z.number().int().min(2020).max(2100),
  bonusType: z.enum(['BASIC_SALARY', 'GROSS_SALARY']),
  paymentMode: z.enum(['ONE_TIME', 'TWO_INSTALLMENTS']).default('ONE_TIME'),
  installment1Date: z.string().optional(),
  installment2Date: z.string().optional(),
  notes: z.string().optional(),
});

const autoGenerateSchema = z.object({
  year: z.number().int().min(2020).max(2100),
  festivalType: z.enum(['EID_UL_FITR', 'EID_UL_ADHA', 'OTHER']),
  bonusType: z.enum(['BASIC_SALARY', 'GROSS_SALARY']),
  paymentMode: z.enum(['ONE_TIME', 'TWO_INSTALLMENTS']).default('ONE_TIME'),
});

const installmentSchema = z.object({
  installmentNumber: z.number().int().min(1).max(2),
});

// Festival bonus listing and stats
router.get('/', authorize('ADMIN', 'HR', 'FINANCE', 'MANAGER', 'EMPLOYEE'), festivalBonusController.getFestivalBonuses);
router.get('/summary', authorize('ADMIN', 'HR', 'FINANCE', 'MANAGER', 'EMPLOYEE'), festivalBonusController.getFestivalBonusSummary);

// Individual bonus lookup (must be before /:id routes)
router.get('/:id', authorize('ADMIN', 'HR', 'FINANCE', 'MANAGER', 'EMPLOYEE'), festivalBonusController.getFestivalBonusById);

// Bonus lifecycle actions (admin/HR/finance only)
router.post('/', authorize('ADMIN', 'HR', 'FINANCE'), validateRequest(createBonusSchema), festivalBonusController.createFestivalBonus);
router.post('/auto-generate', authorize('ADMIN', 'HR', 'FINANCE'), validateRequest(autoGenerateSchema), festivalBonusController.autoGenerateFestivalBonuses);
router.post('/:id/approve', authorize('ADMIN', 'HR', 'FINANCE'), festivalBonusController.approveFestivalBonus);
router.post('/:id/installment', authorize('ADMIN', 'HR', 'FINANCE'), validateRequest(installmentSchema), festivalBonusController.markInstallmentPaid);
router.post('/:id/cancel', authorize('ADMIN', 'HR', 'FINANCE'), festivalBonusController.cancelFestivalBonus);
router.delete('/:id', authorize('ADMIN', 'HR', 'FINANCE'), festivalBonusController.deleteFestivalBonus);

export default router;
