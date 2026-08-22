"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.deleteShiftAssignment = exports.updateShiftAssignment = exports.createShiftAssignment = exports.getShiftAssignments = exports.deleteShift = exports.updateShift = exports.createShift = exports.getShiftById = exports.getShifts = void 0;
const database_1 = require("../config/database");
const appError_1 = require("../utils/appError");
/**
 * Get shifts with filtering and pagination
 */
const getShifts = async (req, res, next) => {
    try {
        const { page = 1, limit = 20, name, isActive } = req.query;
        const skip = (parseInt(page) - 1) * parseInt(limit);
        const take = parseInt(limit);
        // Build where clause
        const where = {};
        if (name)
            where.name = { contains: name, mode: 'insensitive' };
        if (isActive !== undefined)
            where.isActive = isActive === 'true';
        const [shifts, totalCount] = await database_1.prisma.$transaction([
            database_1.prisma.shift.findMany({
                where,
                skip,
                take,
                orderBy: { name: 'asc' }
            }),
            database_1.prisma.shift.count({ where })
        ]);
        res.status(200).json({
            success: true,
            data: {
                shifts,
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
exports.getShifts = getShifts;
/**
 * Get shift by ID
 */
const getShiftById = async (req, res, next) => {
    try {
        const { id } = req.params;
        const shift = await database_1.prisma.shift.findUnique({
            where: { id }
        });
        if (!shift) {
            return next(new appError_1.AppError('Shift not found', 404));
        }
        res.status(200).json({
            success: true,
            data: shift
        });
    }
    catch (error) {
        next(error);
    }
};
exports.getShiftById = getShiftById;
/**
 * Create shift
 */
const createShift = async (req, res, next) => {
    try {
        const shiftData = req.body;
        // Validate time format
        const startTimeRegex = /^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/;
        const endTimeRegex = /^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/;
        if (!startTimeRegex.test(shiftData.startTime)) {
            return next(new appError_1.AppError('Invalid start time format. Use HH:mm', 400));
        }
        if (!endTimeRegex.test(shiftData.endTime)) {
            return next(new appError_1.AppError('Invalid end time format. Use HH:mm', 400));
        }
        const shift = await database_1.prisma.shift.create({
            data: {
                ...shiftData,
                breakTime: shiftData.breakTime || 0
            }
        });
        res.status(201).json({
            success: true,
            data: shift
        });
    }
    catch (error) {
        next(error);
    }
};
exports.createShift = createShift;
/**
 * Update shift
 */
const updateShift = async (req, res, next) => {
    try {
        const { id } = req.params;
        const updateData = req.body;
        // Check if shift exists
        const shift = await database_1.prisma.shift.findUnique({
            where: { id }
        });
        if (!shift) {
            return next(new appError_1.AppError('Shift not found', 404));
        }
        // Validate time format if being updated
        if (updateData.startTime) {
            const startTimeRegex = /^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/;
            if (!startTimeRegex.test(updateData.startTime)) {
                return next(new appError_1.AppError('Invalid start time format. Use HH:mm', 400));
            }
        }
        if (updateData.endTime) {
            const endTimeRegex = /^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/;
            if (!endTimeRegex.test(updateData.endTime)) {
                return next(new appError_1.AppError('Invalid end time format. Use HH:mm', 400));
            }
        }
        const updatedShift = await database_1.prisma.shift.update({
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
    }
    catch (error) {
        next(error);
    }
};
exports.updateShift = updateShift;
/**
 * Delete shift
 */
const deleteShift = async (req, res, next) => {
    try {
        const { id } = req.params;
        // Check if shift exists
        const shift = await database_1.prisma.shift.findUnique({
            where: { id }
        });
        if (!shift) {
            return next(new appError_1.AppError('Shift not found', 404));
        }
        // Check if shift has active assignments
        const activeAssignments = await database_1.prisma.shiftAssignment.count({
            where: {
                shiftId: id,
                date: { gte: new Date() }
            }
        });
        if (activeAssignments > 0) {
            return next(new appError_1.AppError('Cannot delete shift with active assignments', 400));
        }
        await database_1.prisma.shift.delete({
            where: { id }
        });
        res.status(200).json({
            success: true,
            message: 'Shift deleted successfully'
        });
    }
    catch (error) {
        next(error);
    }
};
exports.deleteShift = deleteShift;
/**
 * Get shift assignments with filtering
 */
const getShiftAssignments = async (req, res, next) => {
    try {
        const { shiftId, employeeId, startDate, endDate, page = 1, limit = 50 } = req.query;
        const skip = (parseInt(page) - 1) * parseInt(limit);
        const take = parseInt(limit);
        // Build where clause
        const where = {};
        if (shiftId)
            where.shiftId = shiftId;
        if (employeeId)
            where.employeeId = employeeId;
        if (startDate)
            where.date = { gte: new Date(startDate) };
        if (endDate) {
            if (where.date) {
                where.date.lte = new Date(endDate);
            }
            else {
                where.date = { lte: new Date(endDate) };
            }
        }
        const [assignments, totalCount] = await database_1.prisma.$transaction([
            database_1.prisma.shiftAssignment.findMany({
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
            database_1.prisma.shiftAssignment.count({ where })
        ]);
        res.status(200).json({
            success: true,
            data: {
                assignments,
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
exports.getShiftAssignments = getShiftAssignments;
/**
 * Create shift assignment
 */
const createShiftAssignment = async (req, res, next) => {
    try {
        const assignmentData = req.body;
        // Validate employee exists
        const employee = await database_1.prisma.employee.findUnique({
            where: { id: assignmentData.employeeId }
        });
        if (!employee) {
            return next(new appError_1.AppError('Employee not found', 404));
        }
        // Validate shift exists
        const shift = await database_1.prisma.shift.findUnique({
            where: { id: assignmentData.shiftId }
        });
        if (!shift) {
            return next(new appError_1.AppError('Shift not found', 404));
        }
        // Validate date
        const date = new Date(assignmentData.date);
        if (isNaN(date.getTime())) {
            return next(new appError_1.AppError('Invalid date format', 400));
        }
        // Check for duplicate assignment on same date
        const existingAssignment = await database_1.prisma.shiftAssignment.findFirst({
            where: {
                employeeId: assignmentData.employeeId,
                date
            }
        });
        if (existingAssignment) {
            return next(new appError_1.AppError('Employee already has a shift assignment for this date', 400));
        }
        const assignment = await database_1.prisma.shiftAssignment.create({
            data: {
                ...assignmentData,
                date
            }
        });
        res.status(201).json({
            success: true,
            data: assignment
        });
    }
    catch (error) {
        next(error);
    }
};
exports.createShiftAssignment = createShiftAssignment;
/**
 * Update shift assignment
 */
const updateShiftAssignment = async (req, res, next) => {
    try {
        const { assignmentId } = req.params;
        const updateData = req.body;
        // Check if shift assignment exists
        const assignment = await database_1.prisma.shiftAssignment.findUnique({
            where: { id: assignmentId }
        });
        if (!assignment) {
            return next(new appError_1.AppError('Shift assignment not found', 404));
        }
        // Validate date if being updated
        let date = assignment.date;
        if (updateData.date) {
            date = new Date(updateData.date);
            if (isNaN(date.getTime())) {
                return next(new appError_1.AppError('Invalid date format', 400));
            }
        }
        // Check for duplicate assignment on same date (excluding current record)
        if (updateData.employeeId || updateData.date) {
            const employeeId = updateData.employeeId || assignment.employeeId;
            const checkDate = updateData.date ? new Date(updateData.date) : assignment.date;
            const existingAssignment = await database_1.prisma.shiftAssignment.findFirst({
                where: {
                    employeeId,
                    date: checkDate,
                    id: { not: assignmentId }
                }
            });
            if (existingAssignment) {
                return next(new appError_1.AppError('Employee already has a shift assignment for this date', 400));
            }
        }
        const updatedAssignment = await database_1.prisma.shiftAssignment.update({
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
    }
    catch (error) {
        next(error);
    }
};
exports.updateShiftAssignment = updateShiftAssignment;
/**
 * Delete shift assignment
 */
const deleteShiftAssignment = async (req, res, next) => {
    try {
        const { assignmentId } = req.params;
        // Check if shift assignment exists
        const assignment = await database_1.prisma.shiftAssignment.findUnique({
            where: { id: assignmentId }
        });
        if (!assignment) {
            return next(new appError_1.AppError('Shift assignment not found', 404));
        }
        await database_1.prisma.shiftAssignment.delete({
            where: { id: assignmentId }
        });
        res.status(200).json({
            success: true,
            message: 'Shift assignment deleted successfully'
        });
    }
    catch (error) {
        next(error);
    }
};
exports.deleteShiftAssignment = deleteShiftAssignment;
exports.default = {
    getShifts: exports.getShifts,
    getShiftById: exports.getShiftById,
    createShift: exports.createShift,
    updateShift: exports.updateShift,
    deleteShift: exports.deleteShift,
    getShiftAssignments: exports.getShiftAssignments,
    createShiftAssignment: exports.createShiftAssignment,
    updateShiftAssignment: exports.updateShiftAssignment,
    deleteShiftAssignment: exports.deleteShiftAssignment
};
