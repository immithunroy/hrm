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

// Protect all routes
router.use(authenticateToken);

// Recruitment routes
router.get('/', authorize('ADMIN', 'MANAGER', 'HR', 'EMPLOYEE'), getRecruitments);
router.get('/:id', authorize('ADMIN', 'MANAGER', 'HR', 'EMPLOYEE'), getRecruitmentById);
router.post('/', authorize('ADMIN', 'HR'), validateRequest(recruitmentSchema), createRecruitment);
router.put('/:id', authorize('ADMIN', 'HR'), validateRequest(updateRecruitmentSchema), updateRecruitment);
router.delete('/:id', authorize('ADMIN', 'HR'), deleteRecruitment);

// Applicant routes under recruitment
router.get('/:recruitmentId/applicants', authorize('ADMIN', 'MANAGER', 'HR', 'EMPLOYEE'), getApplicants);
router.post('/:recruitmentId/applicants', authorize('ADMIN', 'HR'), validateRequest(applicantSchema), createApplicant);
router.put('/:recruitmentId/applicants/:applicantId', authorize('ADMIN', 'HR'), validateRequest(updateApplicantSchema), updateApplicant);
router.delete('/:recruitmentId/applicants/:applicantId', authorize('ADMIN', 'HR'), deleteApplicant);
router.post('/:recruitmentId/applicants/:applicantId/cv', authorize('ADMIN', 'HR'), uploadApplicantCv);

export default router;