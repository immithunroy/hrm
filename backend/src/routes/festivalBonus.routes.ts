import { Router } from 'express';
import { validateRequest } from '../middleware/validateRequest';
import { z } from 'zod';
import { authenticateToken, authorize } from '../middleware/authenticateToken';
import * as festivalBonusController from '../controllers/festivalBonus.controller';

const router = Router();

// Protect all festival bonus routes
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

router.get('/', authorize('ADMIN', 'HR', 'FINANCE', 'MANAGER', 'EMPLOYEE'), festivalBonusController.getFestivalBonuses);
router.get('/summary', authorize('ADMIN', 'HR', 'FINANCE', 'MANAGER', 'EMPLOYEE'), festivalBonusController.getFestivalBonusSummary);
router.get('/:id', authorize('ADMIN', 'HR', 'FINANCE', 'MANAGER', 'EMPLOYEE'), festivalBonusController.getFestivalBonusById);
router.post('/', authorize('ADMIN', 'HR', 'FINANCE'), validateRequest(createBonusSchema), festivalBonusController.createFestivalBonus);
router.post('/auto-generate', authorize('ADMIN', 'HR', 'FINANCE'), validateRequest(autoGenerateSchema), festivalBonusController.autoGenerateFestivalBonuses);
router.post('/:id/approve', authorize('ADMIN', 'HR', 'FINANCE'), festivalBonusController.approveFestivalBonus);
router.post('/:id/installment', authorize('ADMIN', 'HR', 'FINANCE'), validateRequest(installmentSchema), festivalBonusController.markInstallmentPaid);
router.post('/:id/cancel', authorize('ADMIN', 'HR', 'FINANCE'), festivalBonusController.cancelFestivalBonus);
router.delete('/:id', authorize('ADMIN', 'HR', 'FINANCE'), festivalBonusController.deleteFestivalBonus);

export default router;
