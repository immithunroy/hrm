import { Request, Response, NextFunction } from 'express';
import { prisma } from '../config/database';
import { AppError } from '../utils/appError';
import { z } from 'zod';

/**
 * Get leave requests with filtering and pagination.
 * EMPLOYEE role: only own leave requests.
 */
export const getLeaveRequests = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const {
      page = 1,
      limit = 20,
      employeeId,
      startDate,
      endDate,
      status,
      leaveType
    } = req.query;

    const skip = (parseInt(page as string) - 1) * parseInt(limit as string);
    const take = parseInt(limit as string);

    // Build where clause
    const where: any = {};
    
    // EMPLOYEE: only own leaves
    if (req.userRole === 'EMPLOYEE') {
      where.employeeId = req.userId;
    } else if (employeeId) {
      where.employeeId = employeeId as string;
    }

    if (startDate) where.startDate = { gte: new Date(startDate as string) };
    if (endDate) {
      if (where.startDate) {
        where.endDate = { lte: new Date(endDate as string) };
      } else {
        where.endDate = { lte: new Date(endDate as string) };
      }
    }
    if (status) where.status = status as string;
    if (leaveType) where.leaveType = leaveType as string;

    const [leaveRequests, totalCount] = await prisma.$transaction([
      prisma.leaveRequest.findMany({
        where,
        include: {
          employee: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              employeeId: true
            }
          }
        },
        skip,
        take,
        orderBy: { createdAt: 'desc' }
      }),
      prisma.leaveRequest.count({ where })
    ]);

    res.status(200).json({
      success: true,
      data: {
        leaveRequests,
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
 * Get leave request by ID.
 * EMPLOYEE: only own leave requests.
 */
export const getLeaveRequestById = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;

    const leaveRequest = await prisma.leaveRequest.findUnique({
      where: { id },
      include: {
        employee: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            employeeId: true
          }
        }
      }
    });

    if (!leaveRequest) {
      return next(new AppError('Leave request not found', 404));
    }

    // EMPLOYEE: only own leaves
    if (req.userRole === 'EMPLOYEE' && leaveRequest.employeeId !== req.userId) {
      return next(new AppError('Insufficient permissions', 403));
    }

    res.status(200).json({
      success: true,
      data: leaveRequest
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Create leave request.
 * EMPLOYEE: auto-sets employeeId to their own ID (cannot create for others).
 */
export const createLeaveRequest = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const leaveData = req.body;

    // EMPLOYEE: force own employeeId
    if (req.userRole === 'EMPLOYEE') {
      leaveData.employeeId = req.userId;
    }

    // Validate employee exists
    const employee = await prisma.employee.findUnique({
      where: { id: leaveData.employeeId }
    });

    if (!employee) {
      return next(new AppError('Employee not found', 404));
    }

    // EMPLOYEE: cannot create for someone else
    if (req.userRole === 'EMPLOYEE' && leaveData.employeeId !== req.userId) {
      return next(new AppError('Insufficient permissions', 403));
    }

    // Validate dates
    const startDate = new Date(leaveData.startDate);
    const endDate = new Date(leaveData.endDate);
    
    if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
      return next(new AppError('Invalid date format', 400));
    }
    
    if (startDate > endDate) {
      return next(new AppError('Start date must be before or equal to end date', 400));
    }

    // Calculate days requested
    const timeDiff = endDate.getTime() - startDate.getTime();
    const daysRequested = Math.ceil(timeDiff / (1000 * 3600 * 24)) + 1;

    const leaveRequest = await prisma.leaveRequest.create({
      data: {
        ...leaveData,
        startDate,
        endDate,
        daysRequested
      }
    });

    res.status(201).json({
      success: true,
      data: leaveRequest
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Update leave request.
 * EMPLOYEE: can only update own PENDING leaves (dates/type only, not status).
 */
export const updateLeaveRequest = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const updateData = req.body;

    // Check if leave request exists
    const leaveRequest = await prisma.leaveRequest.findUnique({
      where: { id }
    });

    if (!leaveRequest) {
      return next(new AppError('Leave request not found', 404));
    }

    // EMPLOYEE: only own leaves
    if (req.userRole === 'EMPLOYEE' && leaveRequest.employeeId !== req.userId) {
      return next(new AppError('Insufficient permissions', 403));
    }

    // EMPLOYEE: can only edit PENDING leaves, and only dates/type (not status, approvedBy)
    if (req.userRole === 'EMPLOYEE') {
      if (leaveRequest.status !== 'PENDING') {
        return next(new AppError('Can only edit pending leave requests', 400));
      }
      delete updateData.status;
      delete updateData.approvedBy;
      delete updateData.approvedAt;
      delete updateData.employeeId;
    }

    // Validate dates if being updated
    let startDate = leaveRequest.startDate;
    let endDate = leaveRequest.endDate;
    
    if (updateData.startDate) {
      startDate = new Date(updateData.startDate);
      if (isNaN(startDate.getTime())) {
        return next(new AppError('Invalid start date format', 400));
      }
    }
    
    if (updateData.endDate) {
      endDate = new Date(updateData.endDate);
      if (isNaN(endDate.getTime())) {
        return next(new AppError('Invalid end date format', 400));
      }
    }
    
    if (startDate > endDate) {
      return next(new AppError('Start date must be before or equal to end date', 400));
    }

    // Recalculate days requested if dates changed
    const daysRequested = updateData.startDate || updateData.endDate 
      ? Math.ceil((new Date(updateData.endDate || endDate).getTime() - new Date(updateData.startDate || startDate).getTime()) / (1000 * 3600 * 24)) + 1
      : leaveRequest.daysRequested;

    const updatedLeaveRequest = await prisma.leaveRequest.update({
      where: { id },
      data: {
        ...updateData,
        startDate,
        endDate,
        daysRequested
      }
    });

    res.status(200).json({
      success: true,
      data: updatedLeaveRequest
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Delete leave request.
 * EMPLOYEE: can only delete own PENDING leaves.
 */
export const deleteLeaveRequest = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;

    // Check if leave request exists
    const leaveRequest = await prisma.leaveRequest.findUnique({
      where: { id }
    });

    if (!leaveRequest) {
      return next(new AppError('Leave request not found', 404));
    }

    // EMPLOYEE: only own leaves
    if (req.userRole === 'EMPLOYEE' && leaveRequest.employeeId !== req.userId) {
      return next(new AppError('Insufficient permissions', 403));
    }

    // EMPLOYEE: can only delete PENDING leaves
    if (req.userRole === 'EMPLOYEE' && leaveRequest.status !== 'PENDING') {
      return next(new AppError('Can only delete pending leave requests', 400));
    }

    await prisma.leaveRequest.delete({
      where: { id }
    });

    res.status(200).json({
      success: true,
      message: 'Leave request deleted successfully'
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Approve leave request (ADMIN/MANAGER/HR only — route-level enforced).
 */
export const approveLeaveRequest = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const { approvedBy } = req.body;

    const leaveRequest = await prisma.leaveRequest.findUnique({
      where: { id }
    });

    if (!leaveRequest) {
      return next(new AppError('Leave request not found', 404));
    }

    if (leaveRequest.status !== 'PENDING') {
      return next(new AppError('Leave request is not pending approval', 400));
    }

    const updatedLeaveRequest = await prisma.leaveRequest.update({
      where: { id },
      data: {
        status: 'APPROVED',
        approvedBy,
        approvedAt: new Date()
      }
    });

    await prisma.notification.create({
      data: {
        recipientId: leaveRequest.employeeId,
        title: 'Leave Request Approved',
        message: `Your ${leaveRequest.leaveType.toLowerCase()} leave request from ${leaveRequest.startDate.toLocaleDateString()} to ${leaveRequest.endDate.toLocaleDateString()} has been approved.`,
        type: 'SUCCESS',
        relatedId: leaveRequest.id,
        relatedType: 'LEAVE_REQUEST'
      }
    });

    res.status(200).json({
      success: true,
      data: updatedLeaveRequest
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Reject leave request (ADMIN/MANAGER/HR only — route-level enforced).
 */
export const rejectLeaveRequest = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const { approvedBy } = req.body;

    const leaveRequest = await prisma.leaveRequest.findUnique({
      where: { id }
    });

    if (!leaveRequest) {
      return next(new AppError('Leave request not found', 404));
    }

    if (leaveRequest.status !== 'PENDING') {
      return next(new AppError('Leave request is not pending approval', 400));
    }

    const updatedLeaveRequest = await prisma.leaveRequest.update({
      where: { id },
      data: {
        status: 'REJECTED',
        approvedBy,
        approvedAt: new Date()
      }
    });

    await prisma.notification.create({
      data: {
        recipientId: leaveRequest.employeeId,
        title: 'Leave Request Rejected',
        message: `Your ${leaveRequest.leaveType.toLowerCase()} leave request from ${leaveRequest.startDate.toLocaleDateString()} to ${leaveRequest.endDate.toLocaleDateString()} has been rejected.`,
        type: 'ERROR',
        relatedId: leaveRequest.id,
        relatedType: 'LEAVE_REQUEST'
      }
    });

    res.status(200).json({
      success: true,
      data: updatedLeaveRequest
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get leave statistics.
 * EMPLOYEE: only own stats.
 */
export const getLeaveStats = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { startDate, endDate } = req.query;
    
    // Build date filter
    const dateFilter: any = {};
    if (startDate) dateFilter.gte = new Date(startDate as string);
    if (endDate) dateFilter.lte = new Date(endDate as string);
    
    const where: any = startDate || endDate ? { startDate: dateFilter } : {};

    // EMPLOYEE: only own leaves
    if (req.userRole === 'EMPLOYEE') {
      where.employeeId = req.userId;
    }

    const leaveRequests = await prisma.leaveRequest.findMany({
      where,
      include: {
        employee: {
          select: {
            department: {
              select: {
                name: true
              }
            }
          }
        }
      }
    });

    const totalRequests = leaveRequests.length;
    const pendingRequests = leaveRequests.filter(r => r.status === 'PENDING').length;
    const approvedRequests = leaveRequests.filter(r => r.status === 'APPROVED').length;
    const rejectedRequests = leaveRequests.filter(r => r.status === 'REJECTED').length;
    const cancelledRequests = leaveRequests.filter(r => r.status === 'CANCELLED').length;
    
    const totalDaysRequested = leaveRequests.reduce((sum, r) => sum + (r.daysRequested || 0), 0);
    const totalDaysApproved = leaveRequests.filter(r => r.status === 'APPROVED').reduce((sum, r) => sum + (r.daysRequested || 0), 0);
    
    const leaveTypeBreakdown: Record<string, number> = {};
    leaveRequests.forEach(request => {
      const type = request.leaveType || 'UNKNOWN';
      leaveTypeBreakdown[type] = (leaveTypeBreakdown[type] || 0) + 1;
    });
    
    const deptBreakdown: Record<string, number> = {};
    leaveRequests.forEach(request => {
      const deptName = request.employee.department?.name || 'Unknown';
      deptBreakdown[deptName] = (deptBreakdown[deptName] || 0) + 1;
    });

    res.status(200).json({
      success: true,
      data: {
        statistics: {
          totalRequests,
          pendingRequests,
          approvedRequests,
          rejectedRequests,
          cancelledRequests,
          totalDaysRequested,
          totalDaysApproved
        },
        leaveTypeBreakdown,
        departmentBreakdown: deptBreakdown
      }
    });
  } catch (error) {
    next(error);
  }
};

export default {
  getLeaveRequests,
  getLeaveRequestById,
  createLeaveRequest,
  updateLeaveRequest,
  deleteLeaveRequest,
  approveLeaveRequest,
  rejectLeaveRequest,
  getLeaveStats
};
