/**
 * Recruitment Routes
 * 
 * Manages job postings (recruitments) and applicants for each posting.
 * 
 * All routes require authentication. Authorization varies by role:
 *   - ADMIN/HR: Full CRUD access to recruitments and applicants
 *   - MANAGER: Read access to recruitments and applicants
 *   - EMPLOYEE: Read access to recruitments and applicants
 * 
 * Endpoints:
 *   GET    /                                         - List all recruitments (paginated, filterable)
 *   GET    /:id                                      - Get recruitment by ID
 *   POST   /                                         - Create new recruitment (admin/HR only)
 *   PUT    /:id                                      - Update recruitment (admin/HR only)
 *   DELETE /:id                                      - Delete recruitment (admin/HR only)
 *   GET    /:recruitmentId/applicants                - List applicants for a recruitment
 *   POST   /:recruitmentId/applicants                - Create applicant (admin/HR only)
 *   PUT    /:recruitmentId/applicants/:applicantId   - Update applicant (admin/HR only)
 *   DELETE /:recruitmentId/applicants/:applicantId   - Delete applicant (admin/HR only)
 *   POST   /:recruitmentId/applicants/:applicantId/cv - Upload applicant CV (admin/HR only)
 */

import { Router } from 'express';
import { 
  getRecruitments, 
  getRecruitmentById, 
  createRecruitment,
  updateRecruitment,
  deleteRecruitment,
  getApplicants,
  createApplicant,
  updateApplicant,
  deleteApplicant,
  uploadApplicantCv
} from '../controllers/recruitment.controller';
import { authenticateToken } from '../middleware/authenticateToken';
import { authorize } from '../middleware/authenticateToken';
import { validateRequest } from '../middleware/validateRequest';
import { recruitmentSchema, updateRecruitmentSchema, applicantSchema, updateApplicantSchema } from '../schemas/recruitment.schema';

const router = Router();

// Protect all routes — authentication required for every endpoint
router.use(authenticateToken);

// Recruitment routes
router.get('/', authorize('ADMIN', 'MANAGER', 'HR', 'EMPLOYEE'), getRecruitments);
router.get('/:id', authorize('ADMIN', 'MANAGER', 'HR', 'EMPLOYEE'), getRecruitmentById);
router.post('/', authorize('ADMIN', 'HR'), validateRequest(recruitmentSchema), createRecruitment);
router.put('/:id', authorize('ADMIN', 'HR'), validateRequest(updateRecruitmentSchema), updateRecruitment);
router.delete('/:id', authorize('ADMIN', 'HR'), deleteRecruitment);

// Applicant routes under recruitment (nested resource)
router.get('/:recruitmentId/applicants', authorize('ADMIN', 'MANAGER', 'HR', 'EMPLOYEE'), getApplicants);
router.post('/:recruitmentId/applicants', authorize('ADMIN', 'HR'), validateRequest(applicantSchema), createApplicant);
router.put('/:recruitmentId/applicants/:applicantId', authorize('ADMIN', 'HR'), validateRequest(updateApplicantSchema), updateApplicant);
router.delete('/:recruitmentId/applicants/:applicantId', authorize('ADMIN', 'HR'), deleteApplicant);
router.post('/:recruitmentId/applicants/:applicantId/cv', authorize('ADMIN', 'HR'), uploadApplicantCv);

export default router;