"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getUnreadCount = exports.deleteNotification = exports.markAllAsRead = exports.markAsRead = exports.getNotificationById = exports.getNotifications = void 0;
const database_1 = require("../config/database");
const appError_1 = require("../utils/appError");
/**
 * Get notifications for a user with filtering and pagination
 */
const getNotifications = async (req, res, next) => {
    try {
        const { page = 1, limit = 20, isRead, type } = req.query;
        // Get user ID from request (set by auth middleware)
        const userId = req.userId;
        if (!userId) {
            return next(new appError_1.AppError('User not authenticated', 401));
        }
        const skip = (parseInt(page) - 1) * parseInt(limit);
        const take = parseInt(limit);
        // Build where clause
        const where = { recipientId: userId };
        if (isRead !== undefined)
            where.isRead = isRead === 'true';
        if (type)
            where.type = type;
        const [notifications, totalCount] = await database_1.prisma.$transaction([
            database_1.prisma.notification.findMany({
                where,
                skip,
                take,
                orderBy: { createdAt: 'desc' }
            }),
            database_1.prisma.notification.count({ where })
        ]);
        res.status(200).json({
            success: true,
            data: {
                notifications,
                pagination: {
                    page: parseInt(page),
                    limit: parseInt(limit),
                    total: totalCount,
                    totalPages: Math.ceil(totalCount / parseInt(limit))
                }
            }
        });
    }
    catch (error) {
        next(error);
    }
};
exports.getNotifications = getNotifications;
/**
 * Get notification by ID
 */
const getNotificationById = async (req, res, next) => {
    try {
        const { id } = req.params;
        const userId = req.userId;
        if (!userId) {
            return next(new appError_1.AppError('User not authenticated', 401));
        }
        const notification = await database_1.prisma.notification.findFirst({
            where: { id, recipientId: userId }
        });
        if (!notification) {
            return next(new appError_1.AppError('Notification not found', 404));
        }
        res.status(200).json({
            success: true,
            data: notification
        });
    }
    catch (error) {
        next(error);
    }
};
exports.getNotificationById = getNotificationById;
/**
 * Mark notification as read
 */
const markAsRead = async (req, res, next) => {
    try {
        const { id } = req.params;
        const userId = req.userId;
        if (!userId) {
            return next(new appError_1.AppError('User not authenticated', 401));
        }
        const notification = await database_1.prisma.notification.updateMany({
            where: { id, recipientId: userId },
            data: { isRead: true }
        });
        if (notification.count === 0) {
            return next(new appError_1.AppError('Notification not found', 404));
        }
        res.status(200).json({
            success: true,
            message: 'Notification marked as read'
        });
    }
    catch (error) {
        next(error);
    }
};
exports.markAsRead = markAsRead;
/**
 * Mark all notifications as read
 */
const markAllAsRead = async (req, res, next) => {
    try {
        const userId = req.userId;
        if (!userId) {
            return next(new appError_1.AppError('User not authenticated', 401));
        }
        await database_1.prisma.notification.updateMany({
            where: { recipientId: userId, isRead: false },
            data: { isRead: true }
        });
        res.status(200).json({
            success: true,
            message: 'All notifications marked as read'
        });
    }
    catch (error) {
        next(error);
    }
};
exports.markAllAsRead = markAllAsRead;
/**
 * Delete notification
 */
const deleteNotification = async (req, res, next) => {
    try {
        const { id } = req.params;
        const userId = req.userId;
        if (!userId) {
            return next(new appError_1.AppError('User not authenticated', 401));
        }
        const notification = await database_1.prisma.notification.deleteMany({
            where: { id, recipientId: userId }
        });
        if (notification.count === 0) {
            return next(new appError_1.AppError('Notification not found', 404));
        }
        res.status(200).json({
            success: true,
            message: 'Notification deleted successfully'
        });
    }
    catch (error) {
        next(error);
    }
};
exports.deleteNotification = deleteNotification;
/**
 * Get unread notification count
 */
const getUnreadCount = async (req, res, next) => {
    try {
        const userId = req.userId;
        if (!userId) {
            return next(new appError_1.AppError('User not authenticated', 401));
        }
        const count = await database_1.prisma.notification.count({
            where: {
                recipientId: userId,
                isRead: false
            }
        });
        res.status(200).json({
            success: true,
            data: { count }
        });
    }
    catch (error) {
        next(error);
    }
};
exports.getUnreadCount = getUnreadCount;
exports.default = {
    getNotifications: exports.getNotifications,
    getNotificationById: exports.getNotificationById,
    markAsRead: exports.markAsRead,
    markAllAsRead: exports.markAllAsRead,
    deleteNotification: exports.deleteNotification,
    getUnreadCount: exports.getUnreadCount
};
