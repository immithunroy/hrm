"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.removeDeviceUser = exports.enrollUserFingerprint = exports.pushSingleUser = exports.pushAllUsers = exports.listDeviceUsers = exports.clearDeviceLogs = exports.syncDeviceAttendance = exports.getDeviceLogs = exports.testDeviceConnection = exports.deleteDevice = exports.updateDevice = exports.createDevice = exports.getDeviceById = exports.getDevices = void 0;
const database_1 = require("../config/database");
const appError_1 = require("../utils/appError");
const zktService_1 = require("../services/zktService");
/**
 * Get devices with filtering and pagination
 */
const getDevices = async (req, res, next) => {
    try {
        const { page = 1, limit = 20, name, ipAddress, isActive } = req.query;
        const skip = (parseInt(page) - 1) * parseInt(limit);
        const take = parseInt(limit);
        // Build where clause
        const where = {};
        if (name)
            where.name = { contains: name, mode: 'insensitive' };
        if (ipAddress)
            where.ipAddress = { contains: ipAddress };
        if (isActive !== undefined)
            where.isActive = isActive === 'true';
        const [devices, totalCount] = await database_1.prisma.$transaction([
            database_1.prisma.device.findMany({
                where,
                skip,
                take,
                orderBy: { name: 'asc' }
            }),
            database_1.prisma.device.count({ where })
        ]);
        res.status(200).json({
            success: true,
            data: {
                devices,
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
exports.getDevices = getDevices;
/**
 * Get device by ID
 */
const getDeviceById = async (req, res, next) => {
    try {
        const { id } = req.params;
        const device = await database_1.prisma.device.findUnique({
            where: { id }
        });
        if (!device) {
            return next(new appError_1.AppError('Device not found', 404));
        }
        res.status(200).json({
            success: true,
            data: device
        });
    }
    catch (error) {
        next(error);
    }
};
exports.getDeviceById = getDeviceById;
/**
 * Create device
 */
const createDevice = async (req, res, next) => {
    try {
        const deviceData = req.body;
        // Check if deviceId already exists
        if (deviceData.deviceId) {
            const existingDevice = await database_1.prisma.device.findUnique({
                where: { deviceId: deviceData.deviceId }
            });
            if (existingDevice) {
                return next(new appError_1.AppError('Device ID already exists', 400));
            }
        }
        // Check if IP address already exists
        if (deviceData.ipAddress) {
            const existingDevice = await database_1.prisma.device.findFirst({
                where: { ipAddress: deviceData.ipAddress }
            });
            if (existingDevice) {
                return next(new appError_1.AppError('IP address already exists', 400));
            }
        }
        const device = await database_1.prisma.device.create({
            data: {
                ...deviceData,
                lastSeen: deviceData.isActive ? new Date() : undefined
            }
        });
        res.status(201).json({
            success: true,
            data: device
        });
    }
    catch (error) {
        next(error);
    }
};
exports.createDevice = createDevice;
/**
 * Update device
 */
const updateDevice = async (req, res, next) => {
    try {
        const { id } = req.params;
        const updateData = req.body;
        // Check if device exists
        const device = await database_1.prisma.device.findUnique({
            where: { id }
        });
        if (!device) {
            return next(new appError_1.AppError('Device not found', 404));
        }
        // Check if deviceId is being changed and already exists
        if (updateData.deviceId && updateData.deviceId !== device.deviceId) {
            const existingDevice = await database_1.prisma.device.findUnique({
                where: { deviceId: updateData.deviceId }
            });
            if (existingDevice) {
                return next(new appError_1.AppError('Device ID already exists', 400));
            }
        }
        // Check if IP address is being changed and already exists
        if (updateData.ipAddress && updateData.ipAddress !== device.ipAddress) {
            const existingDevice = await database_1.prisma.device.findFirst({
                where: { ipAddress: updateData.ipAddress }
            });
            if (existingDevice) {
                return next(new appError_1.AppError('IP address already exists', 400));
            }
        }
        const updatedDevice = await database_1.prisma.device.update({
            where: { id },
            data: {
                ...updateData,
                lastSeen: updateData.isActive ? new Date() : device.lastSeen
            }
        });
        res.status(200).json({
            success: true,
            data: updatedDevice
        });
    }
    catch (error) {
        next(error);
    }
};
exports.updateDevice = updateDevice;
/**
 * Delete device
 */
const deleteDevice = async (req, res, next) => {
    try {
        const { id } = req.params;
        // Check if device exists
        const device = await database_1.prisma.device.findUnique({
            where: { id }
        });
        if (!device) {
            return next(new appError_1.AppError('Device not found', 404));
        }
        await database_1.prisma.device.delete({
            where: { id }
        });
        res.status(200).json({
            success: true,
            message: 'Device deleted successfully'
        });
    }
    catch (error) {
        next(error);
    }
};
exports.deleteDevice = deleteDevice;
/**
 * Test device connection
 */
const testDeviceConnection = async (req, res, next) => {
    try {
        const { id } = req.params;
        // Get device from database
        const device = await database_1.prisma.device.findUnique({
            where: { id }
        });
        if (!device) {
            return next(new appError_1.AppError('Device not found', 404));
        }
        // Test connection using ZKT service
        const isConnected = await (0, zktService_1.testConnection)(device.ipAddress, device.port, process.env.ZKT_DEVICE_USERNAME, process.env.ZKT_DEVICE_PASSWD);
        // Update device status
        await database_1.prisma.device.update({
            where: { id },
            data: {
                isActive: isConnected,
                lastSeen: isConnected ? new Date() : device.lastSeen
            }
        });
        res.status(200).json({
            success: true,
            data: {
                deviceId: device.id,
                isConnected,
                message: isConnected
                    ? 'Device connection successful'
                    : 'Failed to connect to device'
            }
        });
    }
    catch (error) {
        next(error);
    }
};
exports.testDeviceConnection = testDeviceConnection;
/**
 * Get device logs
 */
const getDeviceLogs = async (req, res, next) => {
    try {
        const { id } = req.params;
        const { page = 1, limit = 50, startDate, endDate } = req.query;
        const skip = (parseInt(page) - 1) * parseInt(limit);
        const take = parseInt(limit);
        // Build where clause
        const where = { deviceId: id };
        if (startDate)
            where.checkIn = { gte: new Date(startDate) };
        if (endDate) {
            if (where.checkIn) {
                where.checkOut = { lte: new Date(endDate) };
            }
            else {
                where.checkOut = { lte: new Date(endDate) };
            }
        }
        const [logs, totalCount] = await database_1.prisma.$transaction([
            database_1.prisma.attendance.findMany({
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
                orderBy: { checkIn: 'desc' }
            }),
            database_1.prisma.attendance.count({ where })
        ]);
        res.status(200).json({
            success: true,
            data: {
                logs,
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
exports.getDeviceLogs = getDeviceLogs;
/**
 * Manually trigger an attendance sync from the ZKT device.
 * Runs in the background (a full sync can take a couple of minutes).
 */
const syncDeviceAttendance = async (req, res, next) => {
    try {
        (0, zktService_1.syncAttendanceNow)()
            .then((result) => {
            console.log(`Manual sync complete: ${result.imported} new of ${result.total}`);
        })
            .catch((error) => {
            console.error('Manual sync error:', error?.message || error);
        });
        res.status(202).json({
            success: true,
            data: { message: 'Attendance sync started in the background' }
        });
    }
    catch (error) {
        res.status(400).json({
            success: false,
            message: error?.message || 'Failed to start attendance sync'
        });
    }
};
exports.syncDeviceAttendance = syncDeviceAttendance;
/**
 * Clear old attendance logs from the device (data stays archived in the DB).
 * Runs in the background (a full sync + clear can take a couple of minutes).
 */
const clearDeviceLogs = async (req, res, next) => {
    try {
        (0, zktService_1.clearOldDeviceLogs)()
            .then((result) => {
            console.log(`Manual device log clear result: cleared=${result.cleared} reason=${result.reason}`);
        })
            .catch((error) => {
            console.error('Manual device log clear error:', error?.message || error);
        });
        res.status(202).json({
            success: true,
            data: { message: 'Device attendance log clear started in the background (DB archive retained)' }
        });
    }
    catch (error) {
        res.status(400).json({
            success: false,
            message: error?.message || 'Failed to start device attendance log clear'
        });
    }
};
exports.clearDeviceLogs = clearDeviceLogs;
/**
 * GET /api/devices/users — list users currently on the device.
 */
const listDeviceUsers = async (req, res, next) => {
    try {
        const users = await (0, zktService_1.getDeviceUsers)();
        res.status(200).json({ success: true, data: { users, total: users.length } });
    }
    catch (error) {
        res.status(400).json({ success: false, message: error?.message || 'Failed to read device users' });
    }
};
exports.listDeviceUsers = listDeviceUsers;
/**
 * POST /api/devices/users/sync-all — push every ACTIVE employee to the device.
 */
const pushAllUsers = async (req, res, next) => {
    try {
        const result = await (0, zktService_1.syncAllUsersToDevice)();
        res.status(200).json({ success: true, data: result });
    }
    catch (error) {
        res.status(400).json({ success: false, message: error?.message || 'Failed to sync users to device' });
    }
};
exports.pushAllUsers = pushAllUsers;
/**
 * POST /api/devices/users/:employeeId/sync — push a single employee to the device.
 */
const pushSingleUser = async (req, res, next) => {
    try {
        const employee = await database_1.prisma.employee.findUnique({ where: { id: req.params.employeeId } });
        if (!employee)
            return next(new appError_1.AppError('Employee not found', 404));
        const pushed = await (0, zktService_1.pushUserToDevice)(employee);
        res.status(200).json({ success: true, data: pushed });
    }
    catch (error) {
        res.status(400).json({ success: false, message: error?.message || 'Failed to push user to device' });
    }
};
exports.pushSingleUser = pushSingleUser;
/**
 * POST /api/devices/users/:employeeId/enroll — start fingerprint enrollment on the device.
 * The employee must press their finger on the scanner within the timeout.
 */
const enrollUserFingerprint = async (req, res, next) => {
    try {
        const fingerIndex = parseInt(req.body?.fingerIndex) || 0;
        const result = await (0, zktService_1.enrollFingerprint)(req.params.employeeId, fingerIndex);
        res.status(200).json({ success: true, data: result });
    }
    catch (error) {
        // Cancel any in-progress capture so the device returns to normal state.
        (0, zktService_1.cancelCapture)().catch(() => undefined);
        res.status(400).json({ success: false, message: error?.message || 'Fingerprint enrollment failed' });
    }
};
exports.enrollUserFingerprint = enrollUserFingerprint;
/**
 * DELETE /api/devices/users/:uid — remove a user from the device.
 */
const removeDeviceUser = async (req, res, next) => {
    try {
        const uid = parseInt(req.params.uid, 10);
        if (Number.isNaN(uid) || uid <= 0)
            return next(new appError_1.AppError('Invalid uid', 400));
        const result = await (0, zktService_1.deleteDeviceUser)(uid);
        res.status(200).json({ success: true, data: result });
    }
    catch (error) {
        res.status(400).json({ success: false, message: error?.message || 'Failed to delete device user' });
    }
};
exports.removeDeviceUser = removeDeviceUser;
exports.default = {
    getDevices: exports.getDevices,
    getDeviceById: exports.getDeviceById,
    createDevice: exports.createDevice,
    updateDevice: exports.updateDevice,
    deleteDevice: exports.deleteDevice,
    testDeviceConnection: exports.testDeviceConnection,
    getDeviceLogs: exports.getDeviceLogs,
    syncDeviceAttendance: exports.syncDeviceAttendance,
    clearDeviceLogs: exports.clearDeviceLogs,
    listDeviceUsers: exports.listDeviceUsers,
    pushAllUsers: exports.pushAllUsers,
    pushSingleUser: exports.pushSingleUser,
    enrollUserFingerprint: exports.enrollUserFingerprint,
    removeDeviceUser: exports.removeDeviceUser
};
