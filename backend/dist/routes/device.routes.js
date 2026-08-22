"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const device_controller_1 = require("../controllers/device.controller");
const authenticateToken_1 = require("../middleware/authenticateToken");
const authenticateToken_2 = require("../middleware/authenticateToken");
const validateRequest_1 = require("../middleware/validateRequest");
const device_schema_1 = require("../schemas/device.schema");
const router = (0, express_1.Router)();
// Protect all routes
router.use(authenticateToken_1.authenticateToken);
// Device routes
router.get('/', (0, authenticateToken_2.authorize)('ADMIN', 'MANAGER', 'HR', 'EMPLOYEE'), device_controller_1.getDevices);
router.post('/', (0, authenticateToken_2.authorize)('ADMIN', 'HR'), (0, validateRequest_1.validateRequest)(device_schema_1.deviceSchema), device_controller_1.createDevice);
router.post('/sync', (0, authenticateToken_2.authorize)('ADMIN', 'MANAGER', 'HR'), device_controller_1.syncDeviceAttendance);
router.post('/clear-old-logs', (0, authenticateToken_2.authorize)('ADMIN', 'HR'), device_controller_1.clearDeviceLogs);
// Device user provisioning (must be registered before /:id)
router.get('/users', (0, authenticateToken_2.authorize)('ADMIN', 'MANAGER', 'HR', 'EMPLOYEE'), device_controller_1.listDeviceUsers);
router.post('/users/sync-all', (0, authenticateToken_2.authorize)('ADMIN', 'HR'), device_controller_1.pushAllUsers);
router.post('/users/:employeeId/sync', (0, authenticateToken_2.authorize)('ADMIN', 'HR'), device_controller_1.pushSingleUser);
router.post('/users/:employeeId/enroll', (0, authenticateToken_2.authorize)('ADMIN', 'HR'), device_controller_1.enrollUserFingerprint);
router.delete('/users/:uid', (0, authenticateToken_2.authorize)('ADMIN', 'HR'), device_controller_1.removeDeviceUser);
// Device resource routes
router.get('/:id', (0, authenticateToken_2.authorize)('ADMIN', 'MANAGER', 'HR', 'EMPLOYEE'), device_controller_1.getDeviceById);
router.put('/:id', (0, authenticateToken_2.authorize)('ADMIN', 'HR'), (0, validateRequest_1.validateRequest)(device_schema_1.updateDeviceSchema), device_controller_1.updateDevice);
router.delete('/:id', (0, authenticateToken_2.authorize)('ADMIN', 'HR'), device_controller_1.deleteDevice);
router.post('/:id/test', (0, authenticateToken_2.authorize)('ADMIN', 'MANAGER', 'HR'), device_controller_1.testDeviceConnection);
router.get('/:id/logs', (0, authenticateToken_2.authorize)('ADMIN', 'MANAGER', 'HR'), device_controller_1.getDeviceLogs);
exports.default = router;
