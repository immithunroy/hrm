/**
 * Announcement Routes
 * 
 * Manages company announcements for internal communications.
 * 
 * All routes require authentication. Authorization varies by role:
 *   - ADMIN: Full CRUD access (create, update, delete announcements)
 *   - HR: Full CRUD access (create, update, delete announcements)
 *   - MANAGER: Read-only access to announcements
 *   - EMPLOYEE: Read-only access to announcements
 * 
 * Endpoints:
 *   GET  /     - List all announcements (paginated, filterable)
 *   GET  /:id  - Get announcement by ID
 *   POST /     - Create new announcement (admin/HR only)
 *   PUT  /:id  - Update announcement (admin/HR only)
 *   DELETE /:id - Delete announcement (admin only)
 */

import { Router } from 'express';
import {
  getAnnouncements,
  getAnnouncementById,
  createAnnouncement,
  updateAnnouncement,
  deleteAnnouncement
} from '../controllers/announcement.controller';
import { authenticateToken, authorize } from '../middleware/authenticateToken';
import { validateRequest } from '../middleware/validateRequest';
import { createAnnouncementSchema, updateAnnouncementSchema } from '../schemas/announcement.schema';

const router = Router();

// Protect all routes — authentication required for every endpoint
router.use(authenticateToken);

// Announcement listing (all roles can view)
router.get('/', authorize('ADMIN', 'MANAGER', 'HR', 'EMPLOYEE'), getAnnouncements);
router.get('/:id', authorize('ADMIN', 'MANAGER', 'HR', 'EMPLOYEE'), getAnnouncementById);

// Announcement management (admin/HR only)
router.post('/', authorize('ADMIN', 'HR'), validateRequest(createAnnouncementSchema), createAnnouncement);
router.put('/:id', authorize('ADMIN', 'HR'), validateRequest(updateAnnouncementSchema), updateAnnouncement);
router.delete('/:id', authorize('ADMIN'), deleteAnnouncement);

export default router;
