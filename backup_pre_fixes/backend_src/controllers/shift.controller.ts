import { Request, Response, NextFunction } from 'express';
import { prisma } from '../config/database';
import { AppError } from '../utils/appError';
import { z } from 'zod';

/**
 * Get shifts with filtering and pagination
 */
export const getShifts = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const {
      page = 1,
      limit = 20,
      name,
      isActive
    } = req.query;

    const skip = (parseInt(page as string) - 1) * parseInt(limit as string);
    const take = parseInt(limit as string);

    // Build where clause
    const where: any = {};
    
    if (name) where.name = { contains: name as string, mode: 'insensitive' };
    if (isActive !== undefined) where.isActive = isActive === 'true';

    const [shifts, totalCount] = await prisma.$transaction([
      prisma.shift.findMany({
        where,
        skip,
        take,
        orderBy: { name: 'asc' }
      }),
      prisma.shift.count({ where })
    ]);

    res.status(200).json({
      success: true,
      data: {
        shifts,
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
 * Get shift by ID
 */
export const getShiftById = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;

    const shift = await prisma.shift.findUnique({
      where: { id }
    });

    if (!shift) {
      return next(new AppError('Shift not found', 404));
    }

    res.status(200).json({
      success: true,
      data: shift
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Create shift
 */
export const createShift = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const shiftData = req.body;

    // Validate time format
    const startTimeRegex = /^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/;
    const endTimeRegex = /^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/;
    
    if (!startTimeRegex.test(shiftData.startTime)) {
      return next(new AppError('Invalid start time format. Use HH:mm', 400));
    }
    
    if (!endTimeRegex.test(shiftData.endTime)) {
      return next(new AppError('Invalid end time format. Use HH:mm', 400));
    }

    const shift = await prisma.shift.create({
      data: {
        ...shiftData,
        breakTime: shiftData.breakTime || 0
      }
    });

    res.status(201).json({
      success: true,
      data: shift
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Update shift
 */
export const updateShift = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const updateData = req.body;

    // Check if shift exists
    const shift = await prisma.shift.findUnique({
      where: { id }
    });

    if (!shift) {
      return next(new AppError('Shift not found', 404));
    }

    // Validate time format if being updated
    if (updateData.startTime) {
      const startTimeRegex = /^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/;
      if (!startTimeRegex.test(updateData.startTime)) {
        return next(new AppError('Invalid start time format. Use HH:mm', 400));
      }
    }
    
    if (updateData.endTime) {
      const endTimeRegex = /^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/;
      if (!endTimeRegex.test(updateData.endTime)) {
        return next(new AppError('Invalid end time format. Use HH:mm', 400));
      }
    }

    const updatedShift = await prisma.shift.update({
      where: { id },
      data: {
        ...updateData,
        breakTime: updateData.breakTime || 0
      }
    });

    res.status(200).json({
      success: true,
      data: updatedShift
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Delete shift
 */
export const deleteShift = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;

    // Check if shift exists
    const shift = await prisma.shift.findUnique({
      where: { id }
    });

    if (!shift) {
      return next(new AppError('Shift not found', 404));
    }

    // Check if shift has active assignments
    const activeAssignments = await prisma.shiftAssignment.count({
      where: {
        shiftId: id,
        date: { gte: new Date() }
      }
    });

    if (activeAssignments > 0) {
      return next(new AppError('Cannot delete shift with active assignments', 400));
    }

    await prisma.shift.delete({
      where: { id }
    });

    res.status(200).json({
      success: true,
      message: 'Shift deleted successfully'
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get shift assignments with filtering
 */
export const getShiftAssignments = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const {
      shiftId,
      employeeId,
      startDate,
      endDate,
      page = 1,
      limit = 50
    } = req.query;

    const skip = (parseInt(page as string) - 1) * parseInt(limit as string);
    const take = parseInt(limit as string);

    // Build where clause
    const where: any = {};
    
    if (shiftId) where.shiftId = shiftId as string;
    if (employeeId) where.employeeId = employeeId as string;
    if (startDate) where.date = { gte: new Date(startDate as string) };
    if (endDate) {
      if (where.date) {
        where.date.lte = new Date(endDate as string);
      } else {
        where.date = { lte: new Date(endDate as string) };
      }
    }

    const [assignments, totalCount] = await prisma.$transaction([
      prisma.shiftAssignment.findMany({
        where,
        include: {
          employee: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              employeeId: true
            }
          },
          shift: {
            select: {
              id: true,
              name: true,
              startTime: true,
              endTime: true
            }
          }
        },
        skip,
        take,
        orderBy: { date: 'desc' }
      }),
      prisma.shiftAssignment.count({ where })
    ]);

    res.status(200).json({
      success: true,
      data: {
        assignments,
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
 * Create shift assignment
 */
export const createShiftAssignment = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const assignmentData = req.body;

    // Validate employee exists
    const employee = await prisma.employee.findUnique({
      where: { id: assignmentData.employeeId }
    });

    if (!employee) {
      return next(new AppError('Employee not found', 404));
    }

    // Validate shift exists
    const shift = await prisma.shift.findUnique({
      where: { id: assignmentData.shiftId }
    });

    if (!shift) {
      return next(new AppError('Shift not found', 404));
    }

    // Validate date
    const date = new Date(assignmentData.date);
    if (isNaN(date.getTime())) {
      return next(new AppError('Invalid date format', 400));
    }

    // Check for duplicate assignment on same date
    const existingAssignment = await prisma.shiftAssignment.findFirst({
      where: {
        employeeId: assignmentData.employeeId,
        date
      }
    });

    if (existingAssignment) {
      return next(new AppError('Employee already has a shift assignment for this date', 400));
    }

    const assignment = await prisma.shiftAssignment.create({
      data: {
        ...assignmentData,
        date
      }
    });

    res.status(201).json({
      success: true,
      data: assignment
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Update shift assignment
 */
export const updateShiftAssignment = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { assignmentId } = req.params;
    const updateData = req.body;

    // Check if shift assignment exists
    const assignment = await prisma.shiftAssignment.findUnique({
      where: { id: assignmentId }
    });

    if (!assignment) {
      return next(new AppError('Shift assignment not found', 404));
    }

    // Validate date if being updated
    let date = assignment.date;
    if (updateData.date) {
      date = new Date(updateData.date);
      if (isNaN(date.getTime())) {
        return next(new AppError('Invalid date format', 400));
      }
    }

    // Check for duplicate assignment on same date (excluding current record)
    if (updateData.employeeId || updateData.date) {
      const employeeId = updateData.employeeId || assignment.employeeId;
      const checkDate = updateData.date ? new Date(updateData.date) : assignment.date;
      
      const existingAssignment = await prisma.shiftAssignment.findFirst({
        where: {
          employeeId,
          date: checkDate,
          id: { not: assignmentId }
        }
      });

      if (existingAssignment) {
        return next(new AppError('Employee already has a shift assignment for this date', 400));
      }
    }

    const updatedAssignment = await prisma.shiftAssignment.update({
      where: { id: assignmentId },
      data: {
        ...updateData,
        date
      }
    });

    res.status(200).json({
      success: true,
      data: updatedAssignment
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Delete shift assignment
 */
export const deleteShiftAssignment = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { assignmentId } = req.params;

    // Check if shift assignment exists
    const assignment = await prisma.shiftAssignment.findUnique({
      where: { id: assignmentId }
    });

    if (!assignment) {
      return next(new AppError('Shift assignment not found', 404));
    }

    await prisma.shiftAssignment.delete({
      where: { id: assignmentId }
    });

    res.status(200).json({
      success: true,
      message: 'Shift assignment deleted successfully'
    });
  } catch (error) {
    next(error);
  }
};

export default {
  getShifts,
  getShiftById,
  createShift,
  updateShift,
  deleteShift,
  getShiftAssignments,
  createShiftAssignment,
  updateShiftAssignment,
  deleteShiftAssignment
};