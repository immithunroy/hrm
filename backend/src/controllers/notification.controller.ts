/**
 * Notification Controller
 * -----------------------
 * User-specific notification management: listing with filters, marking
 * individual or all notifications as read, deletion, and unread count.
 * Every query is scoped to the authenticated user's recipientId.
 */
import { Request, Response, NextFunction } from 'express';
import { prisma } from '../config/database';
import { AppError } from '../utils/appError';

/**
 * Get notifications for a user with filtering and pagination
 */
export const getNotifications = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { 
      page = 1, 
      limit = 20, 
      isRead,
      type
    } = req.query;

    const userId = req.userId;
    
    if (!userId) {
      return next(new AppError('User not authenticated', 401));
    }

    const skip = (parseInt(page as string) - 1) * parseInt(limit as string);
    const take = parseInt(limit as string);

    // Build where clause
    const where: any = { recipientId: userId };
    
    if (isRead !== undefined) where.isRead = isRead === 'true';
    if (type) where.type = type as string;

    const [notifications, totalCount] = await prisma.$transaction([
      prisma.notification.findMany({
        where,
        skip,
        take,
        orderBy: { createdAt: 'desc' }
      }),
      prisma.notification.count({ where })
    ]);

    res.status(200).json({
      success: true,
      data: {
        notifications,
        pagination: {
          page: parseInt(page as string),
          limit: parseInt(limit as string),
          total: totalCount,
          totalPages: Math.ceil(totalCount / parseInt(limit as string))
        }
      }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get notification by ID
 */
export const getNotificationById = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const userId = req.userId;

    if (!userId) {
      return next(new AppError('User not authenticated', 401));
    }

    const notification = await prisma.notification.findFirst({
      where: { id, recipientId: userId }
    });

    if (!notification) {
      return next(new AppError('Notification not found', 404));
    }

    res.status(200).json({
      success: true,
      data: notification
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Mark notification as read
 */
export const markAsRead = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const userId = req.userId;

    if (!userId) {
      return next(new AppError('User not authenticated', 401));
    }

    const notification = await prisma.notification.updateMany({
      where: { id, recipientId: userId },
      data: { isRead: true }
    });

    if (notification.count === 0) {
      return next(new AppError('Notification not found', 404));
    }

    res.status(200).json({
      success: true,
      message: 'Notification marked as read'
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Mark all notifications as read
 */
export const markAllAsRead = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = req.userId;

    if (!userId) {
      return next(new AppError('User not authenticated', 401));
    }

    await prisma.notification.updateMany({
      where: { recipientId: userId, isRead: false },
      data: { isRead: true }
    });

    res.status(200).json({
      success: true,
      message: 'All notifications marked as read'
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Delete notification
 */
export const deleteNotification = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const userId = req.userId;

    if (!userId) {
      return next(new AppError('User not authenticated', 401));
    }

    const notification = await prisma.notification.deleteMany({
      where: { id, recipientId: userId }
    });

    if (notification.count === 0) {
      return next(new AppError('Notification not found', 404));
    }

    res.status(200).json({
      success: true,
      message: 'Notification deleted successfully'
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get unread notification count
 */
export const getUnreadCount = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = req.userId;

    if (!userId) {
      return next(new AppError('User not authenticated', 401));
    }

    const count = await prisma.notification.count({
      where: {
        recipientId: userId,
        isRead: false
      }
    });

    res.status(200).json({
      success: true,
      data: { count }
    });
  } catch (error) {
    next(error);
  }
};

export default {
  getNotifications,
  getNotificationById,
  markAsRead,
  markAllAsRead,
  deleteNotification,
  getUnreadCount
};