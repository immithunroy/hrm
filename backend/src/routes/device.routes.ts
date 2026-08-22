import { Router } from 'express';
import {
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
} from '../controllers/device.controller';
import { authenticateToken } from '../middleware/authenticateToken';
import { authorize } from '../middleware/authenticateToken';
import { validateRequest } from '../middleware/validateRequest';
import { deviceSchema, updateDeviceSchema } from '../schemas/device.schema';

const router = Router();

// Protect all routes
router.use(authenticateToken);

// Device routes
router.get('/', authorize('ADMIN', 'MANAGER', 'HR', 'EMPLOYEE'), getDevices);
router.post('/', authorize('ADMIN', 'HR'), validateRequest(deviceSchema), createDevice);
router.post('/sync', authorize('ADMIN', 'MANAGER', 'HR'), syncDeviceAttendance);
router.post('/clear-old-logs', authorize('ADMIN', 'HR'), clearDeviceLogs);

// Device user provisioning (must be registered before /:id)
router.get('/users', authorize('ADMIN', 'MANAGER', 'HR', 'EMPLOYEE'), listDeviceUsers);
router.post('/users/sync-all', authorize('ADMIN', 'HR'), pushAllUsers);
router.post('/users/:employeeId/sync', authorize('ADMIN', 'HR'), pushSingleUser);
router.post('/users/:employeeId/enroll', authorize('ADMIN', 'HR'), enrollUserFingerprint);
router.delete('/users/:uid', authorize('ADMIN', 'HR'), removeDeviceUser);

// Device resource routes
router.get('/:id', authorize('ADMIN', 'MANAGER', 'HR', 'EMPLOYEE'), getDeviceById);
router.put('/:id', authorize('ADMIN', 'HR'), validateRequest(updateDeviceSchema), updateDevice);
router.delete('/:id', authorize('ADMIN', 'HR'), deleteDevice);
router.post('/:id/test', authorize('ADMIN', 'MANAGER', 'HR'), testDeviceConnection);
router.get('/:id/logs', authorize('ADMIN', 'MANAGER', 'HR'), getDeviceLogs);

export default router;