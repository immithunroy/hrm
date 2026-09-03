/**
 * Holiday Routes
 * 
 * Manages company holidays including creation, bulk operations, and Google Calendar sync.
 * 
 * All routes require authentication. Authorization varies by role:
 *   - ADMIN/HR: Full CRUD access, bulk creation, and Google sync
 *   - MANAGER: Read access to holidays
 *   - EMPLOYEE: Read access to holidays
 * 
 * Endpoints:
 *   GET  /            - List all holidays (paginated, filterable)
 *   POST /            - Create single holiday (admin/HR only)
 *   POST /bulk        - Bulk create holidays (admin/HR only)
 *   POST /sync-google - Sync holidays from Google Calendar (admin/HR only)
 *   PUT  /:id         - Update holiday (admin/HR only)
 *   DELETE /:id       - Delete holiday (admin/HR only)
 */

import { Router } from 'express';
import {
  getHolidays,
  createHoliday,
  bulkCreateHolidays,
  updateHoliday,
  deleteHoliday,
  syncGoogleHolidays
} from '../controllers/holiday.controller';
import { authenticateToken, authorize } from '../middleware/authenticateToken';

const router = Router();

// Protect all routes — authentication required for every endpoint
router.use(authenticateToken);

// Holiday routes
router.get('/', authorize('ADMIN', 'MANAGER', 'HR', 'EMPLOYEE'), getHolidays);
router.post('/', authorize('ADMIN', 'HR'), createHoliday);
router.post('/bulk', authorize('ADMIN', 'HR'), bulkCreateHolidays);
router.post('/sync-google', authorize('ADMIN', 'HR'), syncGoogleHolidays);
router.put('/:id', authorize('ADMIN', 'HR'), updateHoliday);
router.delete('/:id', authorize('ADMIN', 'HR'), deleteHoliday);

export default router;