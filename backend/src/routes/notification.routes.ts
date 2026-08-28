import { Router } from 'express';
import { 
  getNotifications, 
  getNotificationById, 
  markAsRead,
  markAllAsRead,
  deleteNotification,
  getUnreadCount
} from '../controllers/notification.controller';
import { authenticateToken } from '../middleware/authenticateToken';
import { authorize } from '../middleware/authenticateToken';

const router = Router();

// Protect all routes
router.use(authenticateToken);

// Notification routes — static paths MUST be before /:id to avoid param collision
router.get('/', authorize('ADMIN', 'MANAGER', 'HR', 'EMPLOYEE'), getNotifications);
router.get('/unread/count', authorize('ADMIN', 'MANAGER', 'HR', 'EMPLOYEE'), getUnreadCount);
router.patch('/read-all', authorize('ADMIN', 'MANAGER', 'HR', 'EMPLOYEE'), markAllAsRead);
router.get('/:id', authorize('ADMIN', 'MANAGER', 'HR', 'EMPLOYEE'), getNotificationById);
router.patch('/:id/read', authorize('ADMIN', 'MANAGER', 'HR', 'EMPLOYEE'), markAsRead);
router.delete('/:id', authorize('ADMIN', 'MANAGER', 'HR', 'EMPLOYEE'), deleteNotification);

export default router;