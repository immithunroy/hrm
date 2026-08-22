"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.updateDeviceSchema = exports.deviceSchema = void 0;
const zod_1 = require("zod");
exports.deviceSchema = zod_1.z.object({
    deviceId: zod_1.z.string().min(1, 'Device ID is required').optional(),
    name: zod_1.z.string().min(1, 'Device name is required'),
    ipAddress: zod_1.z.string().ip('Invalid IP address'),
    port: zod_1.z.number().int().min(1).max(65535).default(4370),
    location: zod_1.z.string().optional(),
    description: zod_1.z.string().optional(),
    isActive: zod_1.z.boolean().optional().default(true)
});
exports.updateDeviceSchema = exports.deviceSchema.partial();
exports.default = { deviceSchema: exports.deviceSchema, updateDeviceSchema: exports.updateDeviceSchema };
