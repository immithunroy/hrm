import { Router } from 'express';
import { getSettings, updateSettings } from '../controllers/settings.controller';
import { authenticateToken, authorize } from '../middleware/authenticateToken';

const router = Router();

router.use(authenticateToken);

router.get('/', authorize('ADMIN', 'MANAGER', 'HR', 'FINANCE'), getSettings);
router.put('/', authorize('ADMIN', 'HR', 'FINANCE'), updateSettings);

export default router;