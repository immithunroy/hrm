import { Router } from 'express';
import { validateRequest } from '../middleware/validateRequest';
import { z } from 'zod';
import * as festivalBonusController from '../controllers/festivalBonus.controller';

const router = Router();

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

router.post('/', validateRequest(createBonusSchema), festivalBonusController.createFestivalBonus);
router.get('/', festivalBonusController.getFestivalBonuses);
router.get('/summary', festivalBonusController.getFestivalBonusSummary);
router.post('/auto-generate', validateRequest(autoGenerateSchema), festivalBonusController.autoGenerateFestivalBonuses);
router.get('/:id', festivalBonusController.getFestivalBonusById);
router.post('/:id/approve', festivalBonusController.approveFestivalBonus);
router.post('/:id/installment', validateRequest(installmentSchema), festivalBonusController.markInstallmentPaid);
router.post('/:id/cancel', festivalBonusController.cancelFestivalBonus);
router.delete('/:id', festivalBonusController.deleteFestivalBonus);

export default router;
