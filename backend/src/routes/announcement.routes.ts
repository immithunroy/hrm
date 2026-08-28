import { Router } from 'express';
import {
  getAnnouncements,
  getAnnouncementById,
  createAnnouncement,
  updateAnnouncement,
  deleteAnnouncement
} from '../controllers/announcement.controller';
import { authenticateToken, authorize } from '../middleware/authenticateToken';

const router = Router();

router.use(authenticateToken);

router.get('/', authorize('ADMIN', 'MANAGER', 'HR', 'EMPLOYEE'), getAnnouncements);
router.get('/:id', authorize('ADMIN', 'MANAGER', 'HR', 'EMPLOYEE'), getAnnouncementById);
router.post('/', authorize('ADMIN', 'HR'), createAnnouncement);
router.put('/:id', authorize('ADMIN', 'HR'), updateAnnouncement);
router.delete('/:id', authorize('ADMIN'), deleteAnnouncement);

export default router;
