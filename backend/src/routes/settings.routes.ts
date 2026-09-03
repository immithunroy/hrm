/**
 * Settings Routes
 * 
 * Manages system-wide settings including payroll configuration and role management.
 * 
 * All routes require authentication. Authorization varies by endpoint:
 *   - Payroll settings: ADMIN/HR/FINANCE can update, all roles can read
 *   - Role management: ADMIN/HR only
 * 
 * Endpoints:
 *   GET  /         - Get system settings (all roles)
 *   PUT  /         - Update system settings (admin/HR/finance only)
 *   GET  /roles    - Get role definitions (admin/HR only)
 *   PUT  /roles    - Update role definitions (admin/HR only)
 */

import { Router } from 'express';
import { getSettings, updateSettings, getRoles, updateRole } from '../controllers/settings.controller';
import { authenticateToken, authorize } from '../middleware/authenticateToken';
import { validateRequest } from '../middleware/validateRequest';
import { updateSettingsSchema, updateRoleSchema } from '../schemas/settings.schema';

const router = Router();

// Protect all routes — authentication required for every endpoint
router.use(authenticateToken);

// Payroll and system settings
router.get('/', authorize('ADMIN', 'MANAGER', 'HR', 'FINANCE', 'EMPLOYEE'), getSettings);
router.put('/', authorize('ADMIN', 'HR', 'FINANCE'), validateRequest(updateSettingsSchema), updateSettings);

// Role management (admin/HR only)
router.get('/roles', authorize('ADMIN', 'HR'), getRoles);
router.put('/roles', authorize('ADMIN', 'HR'), validateRequest(updateRoleSchema), updateRole);

export default router;
