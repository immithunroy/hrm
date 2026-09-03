/**
 * Recruitment validation schemas
 * - recruitmentSchema: job posting with title, openings, salary range, and dates
 * - applicantSchema: job applicant with personal info, education, and resume
 * - updateApplicantSchema: partial update; includes status tracking (NEW -> HIRED/REJECTED)
 */

import { z } from 'zod';

export const recruitmentSchema = z.object({
  positionId: z.string().min(1, 'Position ID is required'),
  departmentId: z.string().min(1, 'Department ID is required'),
  jobTitle: z.string().min(1, 'Job title is required'),
  openings: z.number().int().positive('Openings must be a positive number'),
  description: z.string().optional(),
  requirements: z.string().optional(),
  responsibilities: z.string().optional(),
  location: z.string().optional(),
  employmentType: z.enum(['FULL_TIME', 'PART_TIME', 'CONTRACT', 'INTERN', 'TEMPORARY']),
  // Salary range; min/max are optional independently
  salaryRangeMin: z.number().min(0, 'Minimum salary must be positive').optional(),
  salaryRangeMax: z.number().min(0, 'Maximum salary must be positive').optional(),
  postedDate: z.string().datetime().optional(),
  closingDate: z.string().datetime().optional()
});

export const updateRecruitmentSchema = recruitmentSchema.partial();

// Education history entry used within applicant schema
export const educationEntrySchema = z.object({
  degree: z.string().optional(),
  institution: z.string().optional(),
  field: z.string().optional(),
  startYear: z.number().int().optional(),
  endYear: z.number().int().optional()
});

export const applicantSchema = z.object({
  firstName: z.string().min(1, 'First name is required'),
  lastName: z.string().min(1, 'Last name is required'),
  email: z.string().email('Invalid email format'),
  phone: z.string().optional(),
  education: z.array(educationEntrySchema).optional(),
  address: z.string().optional(),
  city: z.string().optional(),
  state: z.string().optional(),
  zipCode: z.string().optional(),
  country: z.string().optional(),
  resumeUrl: z.string().url('Invalid URL format').optional(),
  coverLetter: z.string().optional(),
  notes: z.string().optional()
});

// Full update of an applicant (any subset of editable fields).
export const updateApplicantSchema = z.object({
  status: z.enum(['NEW', 'REVIEWED', 'INTERVIEWED', 'OFFERED', 'HIRED', 'REJECTED']).optional(),
  firstName: z.string().min(1).optional(),
  lastName: z.string().min(1).optional(),
  email: z.string().email().optional(),
  phone: z.string().optional(),
  education: z.array(educationEntrySchema).optional(),
  address: z.string().optional(),
  city: z.string().optional(),
  state: z.string().optional(),
  zipCode: z.string().optional(),
  country: z.string().optional(),
  resumeUrl: z.string().url().optional(),
  coverLetter: z.string().optional(),
  notes: z.string().optional(),
  interviewedBy: z.string().optional()
});

export default { 
  recruitmentSchema, 
  updateRecruitmentSchema,
  applicantSchema,
  updateApplicantSchema
};