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
router.get('/', authorize('ADMIN', 'MANAGER', 'HR', 'EMPLOYEE'), getNotifications);
router.get('/:id', authorize('ADMIN', 'MANAGER', 'HR', 'EMPLOYEE'), getNotificationById);
router.patch('/:id/read', authorize('ADMIN', 'MANAGER', 'HR', 'EMPLOYEE'), markAsRead);
router.patch('/read-all', authorize('ADMIN', 'MANAGER', 'HR', 'EMPLOYEE'), markAllAsRead);
router.delete('/:id', authorize('ADMIN', 'MANAGER', 'HR', 'EMPLOYEE'), deleteNotification);
router.get('/unread/count', authorize('ADMIN', 'MANAGER', 'HR', 'EMPLOYEE'), getUnreadCount);

export default router;