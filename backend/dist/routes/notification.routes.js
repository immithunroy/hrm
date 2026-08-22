"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const notification_controller_1 = require("../controllers/notification.controller");
const authenticateToken_1 = require("../middleware/authenticateToken");
const authenticateToken_2 = require("../middleware/authenticateToken");
const router = (0, express_1.Router)();
// Protect all routes
router.use(authenticateToken_1.authenticateToken);
// Notification routes
router.get('/', (0, authenticateToken_2.authorize)('ADMIN', 'MANAGER', 'HR', 'EMPLOYEE'), notification_controller_1.getNotifications);
router.get('/:id', (0, authenticateToken_2.authorize)('ADMIN', 'MANAGER', 'HR', 'EMPLOYEE'), notification_controller_1.getNotificationById);
router.patch('/:id/read', (0, authenticateToken_2.authorize)('ADMIN', 'MANAGER', 'HR', 'EMPLOYEE'), notification_controller_1.markAsRead);
router.patch('/read-all', (0, authenticateToken_2.authorize)('ADMIN', 'MANAGER', 'HR', 'EMPLOYEE'), notification_controller_1.markAllAsRead);
router.delete('/:id', (0, authenticateToken_2.authorize)('ADMIN', 'MANAGER', 'HR', 'EMPLOYEE'), notification_controller_1.deleteNotification);
router.get('/unread/count', (0, authenticateToken_2.authorize)('ADMIN', 'MANAGER', 'HR', 'EMPLOYEE'), notification_controller_1.getUnreadCount);
exports.default = router;
