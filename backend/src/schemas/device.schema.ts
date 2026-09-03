/**
 * Device validation schemas (biometric/time-clock devices)
 * - deviceSchema: device registration with IP, port, and location
 * - updateDeviceSchema: partial update of device fields
 */

import { z } from 'zod';

export const deviceSchema = z.object({
  deviceId: z.string().min(1, 'Device ID is required').optional(),
  name: z.string().min(1, 'Device name is required'),
  ipAddress: z.string().ip('Invalid IP address'),
  // Valid port range 1-65535; default 4370 (ZKTeco standard port)
  port: z.number().int().min(1).max(65535).default(4370),
  location: z.string().optional(),
  description: z.string().optional(),
  isActive: z.boolean().optional().default(true)
});

export const updateDeviceSchema = deviceSchema.partial();

export default { deviceSchema, updateDeviceSchema };