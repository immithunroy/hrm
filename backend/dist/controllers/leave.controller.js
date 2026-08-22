"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getLeaveStats = exports.rejectLeaveRequest = exports.approveLeaveRequest = exports.deleteLeaveRequest = exports.updateLeaveRequest = exports.createLeaveRequest = exports.getLeaveRequestById = exports.getLeaveRequests = void 0;
const database_1 = require("../config/database");
const appError_1 = require("../utils/appError");
/**
 * Get leave requests with filtering and pagination
 */
const getLeaveRequests = async (req, res, next) => {
    try {
        const { page = 1, limit = 20, employeeId, startDate, endDate, status, leaveType } = req.query;
        const skip = (parseInt(page) - 1) * parseInt(limit);
        const take = parseInt(limit);
        // Build where clause
        const where = {};
        if (employeeId)
            where.employeeId = employeeId;
        if (startDate)
            where.startDate = { gte: new Date(startDate) };
        if (endDate) {
            if (where.startDate) {
                where.endDate = { lte: new Date(endDate) };
            }
            else {
                where.endDate = { lte: new Date(endDate) };
            }
        }
        if (status)
            where.status = status;
        if (leaveType)
            where.leaveType = leaveType;
        const [leaveRequests, totalCount] = await database_1.prisma.$transaction([
            database_1.prisma.leaveRequest.findMany({
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
            database_1.prisma.leaveRequest.count({ where })
        ]);
        res.status(200).json({
            success: true,
            data: {
                leaveRequests,
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
exports.getLeaveRequests = getLeaveRequests;
/**
 * Get leave request by ID
 */
const getLeaveRequestById = async (req, res, next) => {
    try {
        const { id } = req.params;
        const leaveRequest = await database_1.prisma.leaveRequest.findUnique({
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
            return next(new appError_1.AppError('Leave request not found', 404));
        }
        res.status(200).json({
            success: true,
            data: leaveRequest
        });
    }
    catch (error) {
        next(error);
    }
};
exports.getLeaveRequestById = getLeaveRequestById;
/**
 * Create leave request
 */
const createLeaveRequest = async (req, res, next) => {
    try {
        const leaveData = req.body;
        // Validate employee exists
        const employee = await database_1.prisma.employee.findUnique({
            where: { id: leaveData.employeeId }
        });
        if (!employee) {
            return next(new appError_1.AppError('Employee not found', 404));
        }
        // Validate dates
        const startDate = new Date(leaveData.startDate);
        const endDate = new Date(leaveData.endDate);
        if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
            return next(new appError_1.AppError('Invalid date format', 400));
        }
        if (startDate > endDate) {
            return next(new appError_1.AppError('Start date must be before or equal to end date', 400));
        }
        // Calculate days requested
        const timeDiff = endDate.getTime() - startDate.getTime();
        const daysRequested = Math.ceil(timeDiff / (1000 * 3600 * 24)) + 1;
        const leaveRequest = await database_1.prisma.leaveRequest.create({
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
    }
    catch (error) {
        next(error);
    }
};
exports.createLeaveRequest = createLeaveRequest;
/**
 * Update leave request
 */
const updateLeaveRequest = async (req, res, next) => {
    try {
        const { id } = req.params;
        const updateData = req.body;
        // Check if leave request exists
        const leaveRequest = await database_1.prisma.leaveRequest.findUnique({
            where: { id }
        });
        if (!leaveRequest) {
            return next(new appError_1.AppError('Leave request not found', 404));
        }
        // Validate dates if being updated
        let startDate = leaveRequest.startDate;
        let endDate = leaveRequest.endDate;
        if (updateData.startDate) {
            startDate = new Date(updateData.startDate);
            if (isNaN(startDate.getTime())) {
                return next(new appError_1.AppError('Invalid start date format', 400));
            }
        }
        if (updateData.endDate) {
            endDate = new Date(updateData.endDate);
            if (isNaN(endDate.getTime())) {
                return next(new appError_1.AppError('Invalid end date format', 400));
            }
        }
        if (startDate > endDate) {
            return next(new appError_1.AppError('Start date must be before or equal to end date', 400));
        }
        // Recalculate days requested if dates changed
        const daysRequested = updateData.startDate || updateData.endDate
            ? Math.ceil((new Date(updateData.endDate || endDate).getTime() - new Date(updateData.startDate || startDate).getTime()) / (1000 * 3600 * 24)) + 1
            : leaveRequest.daysRequested;
        const updatedLeaveRequest = await database_1.prisma.leaveRequest.update({
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
    }
    catch (error) {
        next(error);
    }
};
exports.updateLeaveRequest = updateLeaveRequest;
/**
 * Delete leave request
 */
const deleteLeaveRequest = async (req, res, next) => {
    try {
        const { id } = req.params;
        // Check if leave request exists
        const leaveRequest = await database_1.prisma.leaveRequest.findUnique({
            where: { id }
        });
        if (!leaveRequest) {
            return next(new appError_1.AppError('Leave request not found', 404));
        }
        await database_1.prisma.leaveRequest.delete({
            where: { id }
        });
        res.status(200).json({
            success: true,
            message: 'Leave request deleted successfully'
        });
    }
    catch (error) {
        next(error);
    }
};
exports.deleteLeaveRequest = deleteLeaveRequest;
/**
 * Approve leave request
 */
const approveLeaveRequest = async (req, res, next) => {
    try {
        const { id } = req.params;
        const { approvedBy } = req.body;
        // Check if leave request exists
        const leaveRequest = await database_1.prisma.leaveRequest.findUnique({
            where: { id }
        });
        if (!leaveRequest) {
            return next(new appError_1.AppError('Leave request not found', 404));
        }
        // Check if already processed
        if (leaveRequest.status !== 'PENDING') {
            return next(new appError_1.AppError('Leave request is not pending approval', 400));
        }
        const updatedLeaveRequest = await database_1.prisma.leaveRequest.update({
            where: { id },
            data: {
                status: 'APPROVED',
                approvedBy,
                approvedAt: new Date()
            }
        });
        // Create notification for employee
        await database_1.prisma.notification.create({
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
    }
    catch (error) {
        next(error);
    }
};
exports.approveLeaveRequest = approveLeaveRequest;
/**
 * Reject leave request
 */
const rejectLeaveRequest = async (req, res, next) => {
    try {
        const { id } = req.params;
        const { approvedBy } = req.body;
        // Check if leave request exists
        const leaveRequest = await database_1.prisma.leaveRequest.findUnique({
            where: { id }
        });
        if (!leaveRequest) {
            return next(new appError_1.AppError('Leave request not found', 404));
        }
        // Check if already processed
        if (leaveRequest.status !== 'PENDING') {
            return next(new appError_1.AppError('Leave request is not pending approval', 400));
        }
        const updatedLeaveRequest = await database_1.prisma.leaveRequest.update({
            where: { id },
            data: {
                status: 'REJECTED',
                approvedBy,
                approvedAt: new Date()
            }
        });
        // Create notification for employee
        await database_1.prisma.notification.create({
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
    }
    catch (error) {
        next(error);
    }
};
exports.rejectLeaveRequest = rejectLeaveRequest;
/**
 * Get leave statistics
 */
const getLeaveStats = async (req, res, next) => {
    try {
        const { startDate, endDate } = req.query;
        // Build date filter
        const dateFilter = {};
        if (startDate)
            dateFilter.gte = new Date(startDate);
        if (endDate)
            dateFilter.lte = new Date(endDate);
        const where = startDate || endDate ? { startDate: dateFilter } : {};
        const leaveRequests = await database_1.prisma.leaveRequest.findMany({
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
        // Calculate statistics
        const totalRequests = leaveRequests.length;
        const pendingRequests = leaveRequests.filter(r => r.status === 'PENDING').length;
        const approvedRequests = leaveRequests.filter(r => r.status === 'APPROVED').length;
        const rejectedRequests = leaveRequests.filter(r => r.status === 'REJECTED').length;
        const cancelledRequests = leaveRequests.filter(r => r.status === 'CANCELLED').length;
        // Calculate total days
        const totalDaysRequested = leaveRequests.reduce((sum, r) => sum + (r.daysRequested || 0), 0);
        const totalDaysApproved = leaveRequests.filter(r => r.status === 'APPROVED').reduce((sum, r) => sum + (r.daysRequested || 0), 0);
        // Group by leave type
        const leaveTypeBreakdown = {};
        leaveRequests.forEach(request => {
            const type = request.leaveType || 'UNKNOWN';
            leaveTypeBreakdown[type] = (leaveTypeBreakdown[type] || 0) + 1;
        });
        // Group by department
        const deptBreakdown = {};
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
    }
    catch (error) {
        next(error);
    }
};
exports.getLeaveStats = getLeaveStats;
exports.default = {
    getLeaveRequests: exports.getLeaveRequests,
    getLeaveRequestById: exports.getLeaveRequestById,
    createLeaveRequest: exports.createLeaveRequest,
    updateLeaveRequest: exports.updateLeaveRequest,
    deleteLeaveRequest: exports.deleteLeaveRequest,
    approveLeaveRequest: exports.approveLeaveRequest,
    rejectLeaveRequest: exports.rejectLeaveRequest,
    getLeaveStats: exports.getLeaveStats
};
