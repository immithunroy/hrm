import { Router } from 'express';
import {
  getHolidays,
  createHoliday,
  bulkCreateHolidays,
  updateHoliday,
  deleteHoliday,
  syncGoogleHolidays
} from '../controllers/holiday.controller';
import { authenticateToken, authorize } from '../middleware/authenticateToken';

const router = Router();

router.use(authenticateToken);

router.get('/', authorize('ADMIN', 'MANAGER', 'HR'), getHolidays);
router.post('/', authorize('ADMIN', 'HR'), createHoliday);
router.post('/bulk', authorize('ADMIN', 'HR'), bulkCreateHolidays);
router.post('/sync-google', authorize('ADMIN', 'HR'), syncGoogleHolidays);
router.put('/:id', authorize('ADMIN', 'HR'), updateHoliday);
router.delete('/:id', authorize('ADMIN', 'HR'), deleteHoliday);

export default router;