import { Request, Response, NextFunction } from 'express';
import { prisma } from '../config/database';
import { AppError } from '../utils/appError';
import {
  testConnection,
  syncAttendanceNow,
  clearOldDeviceLogs,
  getDeviceUsers,
  pushUserToDevice,
  syncAllUsersToDevice,
  deleteDeviceUser,
  enrollFingerprint,
  cancelCapture
} from '../services/zktService';
import { z } from 'zod';

/**
 * Get devices with filtering and pagination
 */
export const getDevices = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const {
      page = 1,
      limit = 20,
      name,
      ipAddress,
      isActive
    } = req.query;

    const skip = (parseInt(page as string) - 1) * parseInt(limit as string);
    const take = parseInt(limit as string);

    // Build where clause
    const where: any = {};
    
    if (name) where.name = { contains: name as string, mode: 'insensitive' };
    if (ipAddress) where.ipAddress = { contains: ipAddress as string };
    if (isActive !== undefined) where.isActive = isActive === 'true';

    const [devices, totalCount] = await prisma.$transaction([
      prisma.device.findMany({
        where,
        skip,
        take,
        orderBy: { name: 'asc' }
      }),
      prisma.device.count({ where })
    ]);

    res.status(200).json({
      success: true,
      data: {
        devices,
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
 * Get device by ID
 */
export const getDeviceById = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;

    const device = await prisma.device.findUnique({
      where: { id }
    });

    if (!device) {
      return next(new AppError('Device not found', 404));
    }

    res.status(200).json({
      success: true,
      data: device
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Create device
 */
export const createDevice = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const deviceData = req.body;

    // Check if deviceId already exists
    if (deviceData.deviceId) {
      const existingDevice = await prisma.device.findUnique({
        where: { deviceId: deviceData.deviceId }
      });
      
      if (existingDevice) {
        return next(new AppError('Device ID already exists', 400));
      }
    }

    // Check if IP address already exists
    if (deviceData.ipAddress) {
      const existingDevice = await prisma.device.findFirst({
        where: { ipAddress: deviceData.ipAddress }
      });
      
      if (existingDevice) {
        return next(new AppError('IP address already exists', 400));
      }
    }

    const device = await prisma.device.create({
      data: {
        ...deviceData,
        lastSeen: deviceData.isActive ? new Date() : undefined
      }
    });

    res.status(201).json({
      success: true,
      data: device
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Update device
 */
export const updateDevice = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const updateData = req.body;

    // Check if device exists
    const device = await prisma.device.findUnique({
      where: { id }
    });

    if (!device) {
      return next(new AppError('Device not found', 404));
    }

    // Check if deviceId is being changed and already exists
    if (updateData.deviceId && updateData.deviceId !== device.deviceId) {
      const existingDevice = await prisma.device.findUnique({
        where: { deviceId: updateData.deviceId }
      });
      
      if (existingDevice) {
        return next(new AppError('Device ID already exists', 400));
      }
    }

    // Check if IP address is being changed and already exists
    if (updateData.ipAddress && updateData.ipAddress !== device.ipAddress) {
      const existingDevice = await prisma.device.findFirst({
        where: { ipAddress: updateData.ipAddress }
      });
      
      if (existingDevice) {
        return next(new AppError('IP address already exists', 400));
      }
    }

    const updatedDevice = await prisma.device.update({
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
  } catch (error) {
    next(error);
  }
};

/**
 * Delete device
 */
export const deleteDevice = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;

    // Check if device exists
    const device = await prisma.device.findUnique({
      where: { id }
    });

    if (!device) {
      return next(new AppError('Device not found', 404));
    }

    await prisma.device.delete({
      where: { id }
    });

    res.status(200).json({
      success: true,
      message: 'Device deleted successfully'
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Test device connection
 */
export const testDeviceConnection = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;

    // Get device from database
    const device = await prisma.device.findUnique({
      where: { id }
    });

    if (!device) {
      return next(new AppError('Device not found', 404));
    }

    // Test connection using ZKT service
    const isConnected = await testConnection(
      device.ipAddress,
      device.port,
      process.env.ZKT_DEVICE_USERNAME,
      process.env.ZKT_DEVICE_PASSWD
    );

    // Update device status
    await prisma.device.update({
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
  } catch (error) {
    next(error);
  }
};

/**
 * Get device logs
 */
export const getDeviceLogs = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const { page = 1, limit = 50, startDate, endDate } = req.query;

    const skip = (parseInt(page as string) - 1) * parseInt(limit as string);
    const take = parseInt(limit as string);

    // Build where clause
    const where: any = { deviceId: id };
    
    if (startDate) where.checkIn = { gte: new Date(startDate as string) };
    if (endDate) {
      if (where.checkIn) {
        where.checkOut = { lte: new Date(endDate as string) };
      } else {
        where.checkOut = { lte: new Date(endDate as string) };
      }
    }

    const [logs, totalCount] = await prisma.$transaction([
      prisma.attendance.findMany({
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
      prisma.attendance.count({ where })
    ]);

    res.status(200).json({
      success: true,
      data: {
        logs,
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
 * Manually trigger an attendance sync from the ZKT device.
 * Runs in the background (a full sync can take a couple of minutes).
 */
export const syncDeviceAttendance = async (req: Request, res: Response, next: NextFunction) => {
  try {
    syncAttendanceNow()
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
  } catch (error: any) {
    res.status(400).json({
      success: false,
      message: error?.message || 'Failed to start attendance sync'
    });
  }
};

/**
 * Clear old attendance logs from the device (data stays archived in the DB).
 * Runs in the background (a full sync + clear can take a couple of minutes).
 */
export const clearDeviceLogs = async (req: Request, res: Response, next: NextFunction) => {
  try {
    clearOldDeviceLogs()
      .then((result) => {
        console.log(`Manual device log clear result: cleared=${result.cleared} reason=${result.reason}`);
      })
      .catch((error: any) => {
        console.error('Manual device log clear error:', error?.message || error);
      });
    res.status(202).json({
      success: true,
      data: { message: 'Device attendance log clear started in the background (DB archive retained)' }
    });
  } catch (error: any) {
    res.status(400).json({
      success: false,
      message: error?.message || 'Failed to start device attendance log clear'
    });
  }
};

/**
 * GET /api/devices/users — list users currently on the device.
 */
export const listDeviceUsers = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const users = await getDeviceUsers();
    res.status(200).json({ success: true, data: { users, total: users.length } });
  } catch (error: any) {
    res.status(400).json({ success: false, message: error?.message || 'Failed to read device users' });
  }
};

/**
 * POST /api/devices/users/sync-all — push every ACTIVE employee to the device.
 */
export const pushAllUsers = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await syncAllUsersToDevice();
    res.status(200).json({ success: true, data: result });
  } catch (error: any) {
    res.status(400).json({ success: false, message: error?.message || 'Failed to sync users to device' });
  }
};

/**
 * POST /api/devices/users/:employeeId/sync — push a single employee to the device.
 */
export const pushSingleUser = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const employee = await prisma.employee.findUnique({ where: { id: req.params.employeeId } });
    if (!employee) return next(new AppError('Employee not found', 404));

    const pushed = await pushUserToDevice(employee);
    res.status(200).json({ success: true, data: pushed });
  } catch (error: any) {
    res.status(400).json({ success: false, message: error?.message || 'Failed to push user to device' });
  }
};

/**
 * POST /api/devices/users/:employeeId/enroll — start fingerprint enrollment on the device.
 * The employee must press their finger on the scanner within the timeout.
 */
export const enrollUserFingerprint = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const fingerIndex = parseInt(req.body?.fingerIndex as string) || 0;
    const result = await enrollFingerprint(req.params.employeeId, fingerIndex);
    res.status(200).json({ success: true, data: result });
  } catch (error: any) {
    // Cancel any in-progress capture so the device returns to normal state.
    cancelCapture().catch(() => undefined);
    res.status(400).json({ success: false, message: error?.message || 'Fingerprint enrollment failed' });
  }
};

/**
 * DELETE /api/devices/users/:uid — remove a user from the device.
 */
export const removeDeviceUser = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const uid = parseInt(req.params.uid, 10);
    if (Number.isNaN(uid) || uid <= 0) return next(new AppError('Invalid uid', 400));
    const result = await deleteDeviceUser(uid);
    res.status(200).json({ success: true, data: result });
  } catch (error: any) {
    res.status(400).json({ success: false, message: error?.message || 'Failed to delete device user' });
  }
};

export default {
  getDevices,
  getDeviceById,
  createDevice,
  updateDevice,
  deleteDevice,
  testDeviceConnection,
  getDeviceLogs,
  syncDeviceAttendance,
  clearDeviceLogs,
  listDeviceUsers,
  pushAllUsers,
  pushSingleUser,
  enrollUserFingerprint,
  removeDeviceUser
};