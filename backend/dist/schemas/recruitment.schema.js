"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.updateApplicantSchema = exports.applicantSchema = exports.educationEntrySchema = exports.updateRecruitmentSchema = exports.recruitmentSchema = void 0;
const zod_1 = require("zod");
exports.recruitmentSchema = zod_1.z.object({
    positionId: zod_1.z.string().min(1, 'Position ID is required'),
    departmentId: zod_1.z.string().min(1, 'Department ID is required'),
    jobTitle: zod_1.z.string().min(1, 'Job title is required'),
    openings: zod_1.z.number().int().positive('Openings must be a positive number'),
    description: zod_1.z.string().optional(),
    requirements: zod_1.z.string().optional(),
    responsibilities: zod_1.z.string().optional(),
    location: zod_1.z.string().optional(),
    employmentType: zod_1.z.enum(['FULL_TIME', 'PART_TIME', 'CONTRACT', 'INTERN', 'TEMPORARY']),
    salaryRangeMin: zod_1.z.number().min(0, 'Minimum salary must be positive').optional(),
    salaryRangeMax: zod_1.z.number().min(0, 'Maximum salary must be positive').optional(),
    postedDate: zod_1.z.string().datetime().optional(),
    closingDate: zod_1.z.string().datetime().optional()
});
exports.updateRecruitmentSchema = exports.recruitmentSchema.partial();
exports.educationEntrySchema = zod_1.z.object({
    degree: zod_1.z.string().optional(),
    institution: zod_1.z.string().optional(),
    field: zod_1.z.string().optional(),
    startYear: zod_1.z.number().int().optional(),
    endYear: zod_1.z.number().int().optional()
});
exports.applicantSchema = zod_1.z.object({
    firstName: zod_1.z.string().min(1, 'First name is required'),
    lastName: zod_1.z.string().min(1, 'Last name is required'),
    email: zod_1.z.string().email('Invalid email format'),
    phone: zod_1.z.string().optional(),
    education: zod_1.z.array(exports.educationEntrySchema).optional(),
    address: zod_1.z.string().optional(),
    city: zod_1.z.string().optional(),
    state: zod_1.z.string().optional(),
    zipCode: zod_1.z.string().optional(),
    country: zod_1.z.string().optional(),
    resumeUrl: zod_1.z.string().url('Invalid URL format').optional(),
    coverLetter: zod_1.z.string().optional(),
    notes: zod_1.z.string().optional()
});
// Full update of an applicant (any subset of editable fields).
exports.updateApplicantSchema = zod_1.z.object({
    status: zod_1.z.enum(['NEW', 'REVIEWED', 'INTERVIEWED', 'OFFERED', 'HIRED', 'REJECTED']).optional(),
    firstName: zod_1.z.string().min(1).optional(),
    lastName: zod_1.z.string().min(1).optional(),
    email: zod_1.z.string().email().optional(),
    phone: zod_1.z.string().optional(),
    education: zod_1.z.array(exports.educationEntrySchema).optional(),
    address: zod_1.z.string().optional(),
    city: zod_1.z.string().optional(),
    state: zod_1.z.string().optional(),
    zipCode: zod_1.z.string().optional(),
    country: zod_1.z.string().optional(),
    resumeUrl: zod_1.z.string().url().optional(),
    coverLetter: zod_1.z.string().optional(),
    notes: zod_1.z.string().optional(),
    interviewedBy: zod_1.z.string().optional()
});
exports.default = {
    recruitmentSchema: exports.recruitmentSchema,
    updateRecruitmentSchema: exports.updateRecruitmentSchema,
    applicantSchema: exports.applicantSchema,
    updateApplicantSchema: exports.updateApplicantSchema
};
