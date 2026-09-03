/**
 * Dashboard Routes
 * 
 * Provides aggregated dashboard data for the HRM system.
 * 
 * All routes require authentication. All roles (ADMIN, MANAGER, HR, EMPLOYEE)
 * can access the dashboard — data is filtered by role on the controller side.
 * 
 * Endpoints:
 *   GET / - Get dashboard summary (employee counts, attendance stats, etc.)
 */

import { Router } from 'express';
import { getDashboard } from '../controllers/dashboard.controller';
import { authenticateToken, authorize } from '../middleware/authenticateToken';

const router = Router();

// Protect all routes — authentication required for every endpoint
router.use(authenticateToken);

router.get('/', authorize('ADMIN', 'MANAGER', 'HR', 'EMPLOYEE'), getDashboard);

export default router;