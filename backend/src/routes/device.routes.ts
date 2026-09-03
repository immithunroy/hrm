/**
 * Device Routes
 * 
 * Manages biometric devices (fingerprint scanners, etc.) including device
 * CRUD, user provisioning, attendance sync, and connection testing.
 * 
 * All routes require authentication. Authorization varies by role:
 *   - ADMIN/HR: Full device management and user provisioning
 *   - MANAGER: Read access, sync, and test connections
 *   - EMPLOYEE: Read-only access to devices
 * 
 * Endpoints:
 *   GET    /                                - List all devices (paginated, filterable)
 *   POST   /                                - Create new device (admin/HR only)
 *   POST   /sync                            - Sync attendance from devices (admin/manager/HR)
 *   POST   /clear-old-logs                  - Clear old device logs (admin/HR only)
 *   GET    /users                           - List all device users
 *   POST   /users/sync-all                  - Push all users to devices (admin/HR only)
 *   POST   /users/:employeeId/sync          - Push single user to devices (admin/HR only)
 *   POST   /users/:employeeId/enroll        - Enroll user fingerprint (admin/HR only)
 *   DELETE /users/:uid                      - Remove user from device (admin/HR only)
 *   GET    /:id                             - Get device by ID
 *   PUT    /:id                             - Update device (admin/HR only)
 *   DELETE /:id                             - Delete device (admin/HR only)
 *   POST   /:id/test                        - Test device connection (admin/manager/HR)
 *   GET    /:id/logs                        - Get device logs (admin/manager/HR)
 */

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

// Protect all routes — authentication required for every endpoint
router.use(authenticateToken);

// Device routes
router.get('/', authorize('ADMIN', 'MANAGER', 'HR', 'EMPLOYEE'), getDevices);
router.post('/', authorize('ADMIN', 'HR'), validateRequest(deviceSchema), createDevice);
router.post('/sync', authorize('ADMIN', 'MANAGER', 'HR'), syncDeviceAttendance);
router.post('/clear-old-logs', authorize('ADMIN', 'HR'), clearDeviceLogs);

// Device user provisioning (must be registered before /:id to avoid param collision)
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