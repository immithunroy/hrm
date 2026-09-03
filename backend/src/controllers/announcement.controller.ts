/**
 * Announcement Controller
 * -----------------------
 * Manages company-wide announcements. Only active, non-expired announcements
 * are returned to the mobile app. Admins/HR can create, update, and delete
 * announcements with priority levels and optional expiry dates.
 */
import { Request, Response, NextFunction } from 'express';
import { prisma } from '../config/database';
import { AppError } from '../utils/appError';

/**
 * Get all active announcements (for mobile app)
 */
export const getAnnouncements = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { page = 1, limit = 50 } = req.query;
    const skip = (parseInt(page as string) - 1) * parseInt(limit as string);
    const take = parseInt(limit as string);

    const where: any = { isActive: true };

    // Include announcements that have no expiry or haven't expired yet
    where.OR = [
      { expiresAt: null },
      { expiresAt: { gte: new Date() } }
    ];

    const [announcements, total] = await prisma.$transaction([
      prisma.announcement.findMany({
        where,
        include: {
          author: { select: { id: true, firstName: true, lastName: true, employeeId: true } }
        },
        orderBy: [
          { priority: 'asc' },
          { createdAt: 'desc' }
        ],
        skip,
        take
      }),
      prisma.announcement.count({ where })
    ]);

    res.status(200).json({
      success: true,
      data: {
        announcements,
        pagination: {
          page: parseInt(page as string),
          limit: take,
          total,
          totalPages: Math.ceil(total / take)
        }
      }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get announcement by ID
 */
export const getAnnouncementById = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const announcement = await prisma.announcement.findUnique({
      where: { id },
      include: {
        author: { select: { id: true, firstName: true, lastName: true, employeeId: true } }
      }
    });

    if (!announcement) return next(new AppError('Announcement not found', 404));

    res.status(200).json({ success: true, data: announcement });
  } catch (error) {
    next(error);
  }
};

/**
 * Create announcement (admin/HR only)
 */
export const createAnnouncement = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { title, content, priority, startsAt, expiresAt } = req.body;

    if (!title || !content) {
      return next(new AppError('Title and content are required', 400));
    }

    const announcement = await prisma.announcement.create({
      data: {
        title,
        content,
        priority: priority || 'NORMAL',
        authorId: req.userId!,
        startsAt: startsAt ? new Date(startsAt) : undefined,
        expiresAt: expiresAt ? new Date(expiresAt) : undefined
      },
      include: {
        author: { select: { id: true, firstName: true, lastName: true, employeeId: true } }
      }
    });

    res.status(201).json({ success: true, data: announcement });
  } catch (error) {
    next(error);
  }
};

/**
 * Update announcement (admin/HR only)
 */
export const updateAnnouncement = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const { title, content, priority, isActive, startsAt, expiresAt } = req.body;

    const announcement = await prisma.announcement.findUnique({ where: { id } });
    if (!announcement) return next(new AppError('Announcement not found', 404));

    const updateData: any = {};
    if (title) updateData.title = title;
    if (content) updateData.content = content;
    if (priority) updateData.priority = priority;
    if (isActive !== undefined) updateData.isActive = isActive;
    if (startsAt) updateData.startsAt = new Date(startsAt);
    if (expiresAt) updateData.expiresAt = new Date(expiresAt);

    const updated = await prisma.announcement.update({
      where: { id },
      data: updateData,
      include: {
        author: { select: { id: true, firstName: true, lastName: true, employeeId: true } }
      }
    });

    res.status(200).json({ success: true, data: updated });
  } catch (error) {
    next(error);
  }
};

/**
 * Delete announcement (admin/HR only)
 */
export const deleteAnnouncement = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const announcement = await prisma.announcement.findUnique({ where: { id } });
    if (!announcement) return next(new AppError('Announcement not found', 404));

    await prisma.announcement.delete({ where: { id } });
    res.status(200).json({ success: true, message: 'Announcement deleted successfully' });
  } catch (error) {
    next(error);
  }
};

export default {
  getAnnouncements,
  getAnnouncementById,
  createAnnouncement,
  updateAnnouncement,
  deleteAnnouncement
};
