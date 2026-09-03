/**
 * Task Controller
 * ----------------
 * Manages internal tasks assigned to employees. Supports filtering by
 * status, category, and assignee. Employees see only their own tasks;
 * admins/managers can view and create tasks for anyone.
 */
import { Request, Response, NextFunction } from 'express';
import { prisma } from '../config/database';
import { AppError } from '../utils/appError';

/**
 * Get tasks for the logged-in employee
 */
export const getMyTasks = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { status, category, page = 1, limit = 50 } = req.query;
    const skip = (parseInt(page as string) - 1) * parseInt(limit as string);
    const take = parseInt(limit as string);

    const where: any = { assignedTo: req.userId! };
    if (status) where.status = status as string;
    if (category) where.category = category as string;

    const [tasks, total] = await prisma.$transaction([
      prisma.task.findMany({
        where,
        include: {
          assignee: { select: { id: true, firstName: true, lastName: true, employeeId: true } },
          creator: { select: { id: true, firstName: true, lastName: true, employeeId: true } }
        },
        orderBy: [
          { priority: 'asc' },
          { dueDate: 'asc' },
          { createdAt: 'desc' }
        ],
        skip,
        take
      }),
      prisma.task.count({ where })
    ]);

    res.status(200).json({
      success: true,
      data: {
        tasks,
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
 * Get all tasks (admin/manager can see all, employee sees own)
 */
export const getAllTasks = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { status, category, assignedTo, page = 1, limit = 50 } = req.query;
    const skip = (parseInt(page as string) - 1) * parseInt(limit as string);
    const take = parseInt(limit as string);

    const where: any = {};
    if (status) where.status = status as string;
    if (category) where.category = category as string;
    if (assignedTo) where.assignedTo = assignedTo as string;

    // Non-admin/manager only see their own tasks
    if (req.userRole === 'EMPLOYEE') {
      where.assignedTo = req.userId!;
    }

    const [tasks, total] = await prisma.$transaction([
      prisma.task.findMany({
        where,
        include: {
          assignee: { select: { id: true, firstName: true, lastName: true, employeeId: true } },
          creator: { select: { id: true, firstName: true, lastName: true, employeeId: true } }
        },
        orderBy: [
          { priority: 'asc' },
          { dueDate: 'asc' },
          { createdAt: 'desc' }
        ],
        skip,
        take
      }),
      prisma.task.count({ where })
    ]);

    res.status(200).json({
      success: true,
      data: {
        tasks,
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
 * Get task by ID
 */
export const getTaskById = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const task = await prisma.task.findUnique({
      where: { id },
      include: {
        assignee: { select: { id: true, firstName: true, lastName: true, employeeId: true } },
        creator: { select: { id: true, firstName: true, lastName: true, employeeId: true } }
      }
    });

    if (!task) return next(new AppError('Task not found', 404));

    // Employees can only view their own tasks
    if (req.userRole === 'EMPLOYEE' && task.assignedTo !== req.userId!) {
      return next(new AppError('Insufficient permissions', 403));
    }

    res.status(200).json({ success: true, data: task });
  } catch (error) {
    next(error);
  }
};

/**
 * Create a new task (admin/manager only)
 */
export const createTask = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { title, description, priority, assignedTo, dueDate, category, relatedId, relatedType, notes } = req.body;

    if (!title) return next(new AppError('Title is required', 400));

    const task = await prisma.task.create({
      data: {
        title,
        description,
        priority: priority || 'MEDIUM',
        assignedTo,
        createdBy: req.userId!,
        dueDate: dueDate ? new Date(dueDate) : undefined,
        category,
        relatedId,
        relatedType,
        notes
      },
      include: {
        assignee: { select: { id: true, firstName: true, lastName: true, employeeId: true } },
        creator: { select: { id: true, firstName: true, lastName: true, employeeId: true } }
      }
    });

    res.status(201).json({ success: true, data: task });
  } catch (error) {
    next(error);
  }
};

/**
 * Update task status
 */
export const updateTask = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const { status, priority, notes } = req.body;

    const task = await prisma.task.findUnique({ where: { id } });
    if (!task) return next(new AppError('Task not found', 404));

    // Employees can only update their own tasks
    if (req.userRole === 'EMPLOYEE' && task.assignedTo !== req.userId!) {
      return next(new AppError('Insufficient permissions', 403));
    }

    const updateData: any = {};
    // Auto-set completedAt timestamp when task is marked COMPLETED
    if (status) {
      updateData.status = status;
      if (status === 'COMPLETED') updateData.completedAt = new Date();
    }
    if (priority) updateData.priority = priority;
    if (notes !== undefined) updateData.notes = notes;

    const updated = await prisma.task.update({
      where: { id },
      data: updateData,
      include: {
        assignee: { select: { id: true, firstName: true, lastName: true, employeeId: true } },
        creator: { select: { id: true, firstName: true, lastName: true, employeeId: true } }
      }
    });

    res.status(200).json({ success: true, data: updated });
  } catch (error) {
    next(error);
  }
};

/**
 * Delete task (admin/manager only)
 */
export const deleteTask = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const task = await prisma.task.findUnique({ where: { id } });
    if (!task) return next(new AppError('Task not found', 404));

    await prisma.task.delete({ where: { id } });
    res.status(200).json({ success: true, message: 'Task deleted successfully' });
  } catch (error) {
    next(error);
  }
};

export default {
  getMyTasks,
  getAllTasks,
  getTaskById,
  createTask,
  updateTask,
  deleteTask
};
