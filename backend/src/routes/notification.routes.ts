/**
 * Notification Routes
 * 
 * Manages user notifications including listing, marking as read, and deletion.
 * 
 * All routes require authentication. All roles (ADMIN, MANAGER, HR, EMPLOYEE)
 * have equal access — each user manages their own notifications.
 * 
 * Endpoints:
 *   GET    /             - List all notifications for current user (paginated)
 *   GET    /unread/count - Get count of unread notifications
 *   PATCH  /read-all     - Mark all notifications as read
 *   GET    /:id          - Get notification by ID
 *   PATCH  /:id/read     - Mark single notification as read
 *   DELETE /:id          - Delete notification
 */

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

// Protect all routes — authentication required for every endpoint
router.use(authenticateToken);

// Notification routes — static paths MUST be before /:id to avoid param collision
router.get('/', authorize('ADMIN', 'MANAGER', 'HR', 'EMPLOYEE'), getNotifications);
router.get('/unread/count', authorize('ADMIN', 'MANAGER', 'HR', 'EMPLOYEE'), getUnreadCount);
router.patch('/read-all', authorize('ADMIN', 'MANAGER', 'HR', 'EMPLOYEE'), markAllAsRead);

// Individual notification operations
router.get('/:id', authorize('ADMIN', 'MANAGER', 'HR', 'EMPLOYEE'), getNotificationById);
router.patch('/:id/read', authorize('ADMIN', 'MANAGER', 'HR', 'EMPLOYEE'), markAsRead);
router.delete('/:id', authorize('ADMIN', 'MANAGER', 'HR', 'EMPLOYEE'), deleteNotification);

export default router;