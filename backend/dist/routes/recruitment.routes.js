"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const recruitment_controller_1 = require("../controllers/recruitment.controller");
const authenticateToken_1 = require("../middleware/authenticateToken");
const authenticateToken_2 = require("../middleware/authenticateToken");
const validateRequest_1 = require("../middleware/validateRequest");
const recruitment_schema_1 = require("../schemas/recruitment.schema");
const router = (0, express_1.Router)();
// Protect all routes
router.use(authenticateToken_1.authenticateToken);
// Recruitment routes
router.get('/', (0, authenticateToken_2.authorize)('ADMIN', 'MANAGER', 'HR', 'EMPLOYEE'), recruitment_controller_1.getRecruitments);
router.get('/:id', (0, authenticateToken_2.authorize)('ADMIN', 'MANAGER', 'HR', 'EMPLOYEE'), recruitment_controller_1.getRecruitmentById);
router.post('/', (0, authenticateToken_2.authorize)('ADMIN', 'HR'), (0, validateRequest_1.validateRequest)(recruitment_schema_1.recruitmentSchema), recruitment_controller_1.createRecruitment);
router.put('/:id', (0, authenticateToken_2.authorize)('ADMIN', 'HR'), (0, validateRequest_1.validateRequest)(recruitment_schema_1.updateRecruitmentSchema), recruitment_controller_1.updateRecruitment);
router.delete('/:id', (0, authenticateToken_2.authorize)('ADMIN', 'HR'), recruitment_controller_1.deleteRecruitment);
// Applicant routes under recruitment
router.get('/:recruitmentId/applicants', (0, authenticateToken_2.authorize)('ADMIN', 'MANAGER', 'HR', 'EMPLOYEE'), recruitment_controller_1.getApplicants);
router.post('/:recruitmentId/applicants', (0, authenticateToken_2.authorize)('ADMIN', 'HR'), (0, validateRequest_1.validateRequest)(recruitment_schema_1.applicantSchema), recruitment_controller_1.createApplicant);
router.put('/:recruitmentId/applicants/:applicantId', (0, authenticateToken_2.authorize)('ADMIN', 'HR'), (0, validateRequest_1.validateRequest)(recruitment_schema_1.updateApplicantSchema), recruitment_controller_1.updateApplicant);
router.delete('/:recruitmentId/applicants/:applicantId', (0, authenticateToken_2.authorize)('ADMIN', 'HR'), recruitment_controller_1.deleteApplicant);
router.post('/:recruitmentId/applicants/:applicantId/cv', (0, authenticateToken_2.authorize)('ADMIN', 'HR'), recruitment_controller_1.uploadApplicantCv);
exports.default = router;
