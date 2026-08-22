import { Router } from 'express';
import { getDashboard } from '../controllers/dashboard.controller';
import { authenticateToken, authorize } from '../middleware/authenticateToken';

const router = Router();

router.use(authenticateToken);

router.get('/', authorize('ADMIN', 'MANAGER', 'HR'), getDashboard);

export default router;