import { Router } from 'express';
import { getSettings, updateSettings, getRoles, updateRole } from '../controllers/settings.controller';
import { authenticateToken, authorize } from '../middleware/authenticateToken';
import { validateRequest } from '../middleware/validateRequest';
import { updateSettingsSchema, updateRoleSchema } from '../schemas/settings.schema';

const router = Router();

router.use(authenticateToken);

// Payroll settings
router.get('/', authorize('ADMIN', 'MANAGER', 'HR', 'FINANCE', 'EMPLOYEE'), getSettings);
router.put('/', authorize('ADMIN', 'HR', 'FINANCE'), validateRequest(updateSettingsSchema), updateSettings);

// Role management (admin/HR only)
router.get('/roles', authorize('ADMIN', 'HR'), getRoles);
router.put('/roles', authorize('ADMIN', 'HR'), validateRequest(updateRoleSchema), updateRole);

export default router;
