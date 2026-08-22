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

// Notification routes
router.get('/', authorize('ADMIN', 'MANAGER', 'HR'), getNotifications);
router.get('/:id', authorize('ADMIN', 'MANAGER', 'HR'), getNotificationById);
router.patch('/:id/read', authorize('ADMIN', 'MANAGER', 'HR'), markAsRead);
router.patch('/read-all', authorize('ADMIN', 'MANAGER', 'HR'), markAllAsRead);
router.delete('/:id', authorize('ADMIN', 'MANAGER', 'HR'), deleteNotification);
router.get('/unread/count', authorize('ADMIN', 'MANAGER', 'HR'), getUnreadCount);

export default router;