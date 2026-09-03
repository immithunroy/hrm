/**
 * Recruitment Controller
 * ----------------------
 * Manages job postings and applicant tracking: CRUD for recruitment listings,
 * applicant management (including CV uploads), and filtering by department,
 * status, and employment type. CV files are stored under uploads/cv/.
 */
import { Request, Response, NextFunction } from 'express';
import { prisma } from '../config/database';
import { AppError } from '../utils/appError';
import { z } from 'zod';
import fs from 'fs';
import path from 'path';

// Uploaded files live under /uploads and are served at /api/uploads.
const UPLOADS_DIR = path.join(process.cwd(), 'uploads');
const CV_DIR = path.join(UPLOADS_DIR, 'cv');

const ensureUploadDirs = () => {
  fs.mkdirSync(CV_DIR, { recursive: true });
};

const ALLOWED_CV_MIME: Record<string, string> = {
  'application/pdf': 'pdf',
  'image/jpeg': 'jpg',
  'image/pjpeg': 'jpg'
};

/**
 * Get recruitment listings with filtering and pagination
 */
export const getRecruitments = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const {
      page = 1,
      limit = 10,
      search,
      departmentId,
      status,
      employmentType
    } = req.query;

    const skip = (parseInt(page as string) - 1) * parseInt(limit as string);
    const take = parseInt(limit as string);

    // Build where clause
    const where: any = {};
    
    if (search) {
      where.OR = [
        { jobTitle: { contains: search as string, mode: 'insensitive' } },
        { description: { contains: search as string, mode: 'insensitive' } }
      ];
    }
    
    if (departmentId) where.departmentId = departmentId as string;
    if (status) where.status = status as string;
    if (employmentType) where.employmentType = employmentType as string;

    const [recruitments, totalCount] = await prisma.$transaction([
      prisma.recruitment.findMany({
        where,
        include: {
          department: {
            select: {
              id: true,
              name: true
            }
          },
          position: {
            select: {
              id: true,
              title: true
            }
          }
        },
        skip,
        take,
        orderBy: { postedDate: 'desc' }
      }),
      prisma.recruitment.count({ where })
    ]);

    res.status(200).json({
      success: true,
      data: {
        recruitments,
        pagination: {
          page: parseInt(page as string),
          limit: parseInt(limit as string),
          total: totalCount,
          totalPages: Math.ceil(totalCount / parseInt(limit as string))
        }
      }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get recruitment by ID
 */
export const getRecruitmentById = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;

    const recruitment = await prisma.recruitment.findUnique({
      where: { id },
      include: {
        department: {
          select: {
            id: true,
            name: true
          }
        },
        position: {
          select: {
            id: true,
            title: true
          }
        }
      }
    });

    if (!recruitment) {
      return next(new AppError('Recruitment not found', 404));
    }

    res.status(200).json({
      success: true,
      data: recruitment
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Create recruitment listing
 */
export const createRecruitment = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const recruitmentData = req.body;

    // Validate department exists
    const department = await prisma.department.findUnique({
      where: { id: recruitmentData.departmentId }
    });

    if (!department) {
      return next(new AppError('Department not found', 404));
    }

    // Validate position exists
    const position = await prisma.position.findUnique({
      where: { id: recruitmentData.positionId }
    });

    if (!position) {
      return next(new AppError('Position not found', 404));
    }

    const recruitment = await prisma.recruitment.create({
      data: {
        ...recruitmentData,
        postedDate: recruitmentData.postedDate ? new Date(recruitmentData.postedDate) : new Date(),
        closingDate: recruitmentData.closingDate ? new Date(recruitmentData.closingDate) : undefined
      }
    });

    res.status(201).json({
      success: true,
      data: recruitment
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Update recruitment listing
 */
export const updateRecruitment = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const updateData = req.body;

    // Check if recruitment exists
    const recruitment = await prisma.recruitment.findUnique({
      where: { id }
    });

    if (!recruitment) {
      return next(new AppError('Recruitment not found', 404));
    }

    // Validate department if being updated
    if (updateData.departmentId) {
      const department = await prisma.department.findUnique({
        where: { id: updateData.departmentId }
      });
      
      if (!department) {
        return next(new AppError('Department not found', 404));
      }
    }

    // Validate position if being updated
    if (updateData.positionId) {
      const position = await prisma.position.findUnique({
        where: { id: updateData.positionId }
      });
      
      if (!position) {
        return next(new AppError('Position not found', 404));
      }
    }

    const updatedRecruitment = await prisma.recruitment.update({
      where: { id },
      data: {
        ...updateData,
        postedDate: updateData.postedDate ? new Date(updateData.postedDate) : undefined,
        closingDate: updateData.closingDate ? new Date(updateData.closingDate) : undefined
      }
    });

    res.status(200).json({
      success: true,
      data: updatedRecruitment
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Delete recruitment listing
 */
export const deleteRecruitment = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;

    // Check if recruitment exists
    const recruitment = await prisma.recruitment.findUnique({
      where: { id }
    });

    if (!recruitment) {
      return next(new AppError('Recruitment not found', 404));
    }

    await prisma.recruitment.delete({
      where: { id }
    });

    res.status(200).json({
      success: true,
      message: 'Recruitment listing deleted successfully'
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get applicants for a recruitment
 */
export const getApplicants = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { recruitmentId } = req.params;
    const { page = 1, limit = 20, status } = req.query;

    const skip = (parseInt(page as string) - 1) * parseInt(limit as string);
    const take = parseInt(limit as string);

    // Build where clause
    const where: any = { recruitmentId };
    if (status) where.status = status as string;

    const [applicants, totalCount] = await prisma.$transaction([
      prisma.applicant.findMany({
        where,
        skip,
        take,
        orderBy: { appliedDate: 'desc' }
      }),
      prisma.applicant.count({ where })
    ]);

    res.status(200).json({
      success: true,
      data: {
        applicants,
        pagination: {
          page: parseInt(page as string),
          limit: parseInt(limit as string),
          total: totalCount,
          totalPages: Math.ceil(totalCount / parseInt(limit as string))
        }
      }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Create applicant
 */
export const createApplicant = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { recruitmentId } = req.params;
    const applicantData = req.body;

    // Validate recruitment exists
    const recruitment = await prisma.recruitment.findUnique({
      where: { id: recruitmentId }
    });

    if (!recruitment) {
      return next(new AppError('Recruitment not found', 404));
    }

    // Only accept applications while the posting is open and before the deadline
    if (recruitment.status !== 'OPEN') {
      return next(new AppError('Recruitment is not open for applications', 400));
    }

    if (recruitment.closingDate && new Date() > recruitment.closingDate) {
    if (recruitment.closingDate && new Date() > recruitment.closingDate) {
      return next(new AppError('Recruitment application period has ended', 400));
    }

    const applicant = await prisma.applicant.create({
      data: {
        ...applicantData,
        recruitmentId,
        appliedDate: new Date()
      }
    });

    res.status(201).json({
      success: true,
      data: applicant
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Update applicant (full profile + status)
 */
export const updateApplicant = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { recruitmentId, applicantId } = req.params;
    const { status, ...profileData } = req.body;

    // Check if applicant exists
    const applicant = await prisma.applicant.findUnique({
      where: { id: applicantId, recruitmentId }
    });

    if (!applicant) {
      return next(new AppError('Applicant not found', 404));
    }

    // Auto-set interviewedAt timestamp when status transitions to INTERVIEWED
    // or HIRED; clear it when reverted to NEW.
    const updatedApplicant = await prisma.applicant.update({
      where: { id: applicantId },
      data: {
        ...profileData,
        status: status ?? applicant.status,
        interviewedAt:
          status === 'INTERVIEWED' || status === 'HIRED'
            ? new Date()
            : status === 'NEW'
            ? null
            : undefined
      }
    });

    res.status(200).json({
      success: true,
      data: updatedApplicant
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Delete applicant
 */
export const deleteApplicant = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { recruitmentId, applicantId } = req.params;

    const applicant = await prisma.applicant.findUnique({
      where: { id: applicantId, recruitmentId }
    });

    if (!applicant) {
      return next(new AppError('Applicant not found', 404));
    }

    await prisma.applicant.delete({
      where: { id: applicantId }
    });

    res.status(200).json({
      success: true,
      message: 'Applicant deleted successfully'
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Upload a candidate CV (pdf or jpg) as base64 JSON: { data, filename }.
 * Saves the file under uploads/cv and stores the relative path in applicant.cvUrl.
 */
export const uploadApplicantCv = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { recruitmentId, applicantId } = req.params;
    const { data, filename } = req.body;

    const applicant = await prisma.applicant.findUnique({
      where: { id: applicantId, recruitmentId }
    });
    if (!applicant) {
      return next(new AppError('Applicant not found', 404));
    }
    if (!data || typeof data !== 'string') {
      return next(new AppError('CV file data (base64) is required', 400));
    }

    // Detect MIME type: first try the data-URI prefix, then check magic bytes
    let mime = 'application/octet-stream';
    const match = /^data:([a-zA-Z0-9./+-]+);base64,/.exec(data);
    const base64 = match ? data.slice(match[0].length) : data.replace(/\s+/g, '');
    if (match) mime = match[1];
    else if (/^%PDF/.test(Buffer.from(base64, 'base64').slice(0, 5).toString('latin1'))) mime = 'application/pdf';
    else if (/^\xFF\xD8\xFF/.test(Buffer.from(base64, 'base64').slice(0, 3).toString('latin1'))) mime = 'image/jpeg';

    const ext = ALLOWED_CV_MIME[mime];
    if (!ext) {
      return next(new AppError('CV must be a PDF or JPG file', 400));
    }

    const buffer = Buffer.from(base64, 'base64');
    if (buffer.length === 0) {
      return next(new AppError('CV file is empty', 400));
    }
    if (buffer.length > 8 * 1024 * 1024) {
      return next(new AppError('CV file must be 8MB or smaller', 400));
    }

    const safeBase = (filename || 'cv').replace(/[^a-zA-Z0-9._-]/g, '').replace(/\.(pdf|jpg|jpeg)$/i, '') || 'cv';
    const savedName = `${applicantId}-${Date.now()}-${safeBase}.${ext}`;
    ensureUploadDirs();
    fs.writeFileSync(path.join(CV_DIR, savedName), buffer);

    const cvUrl = `cv/${savedName}`;
    const updatedApplicant = await prisma.applicant.update({
      where: { id: applicantId },
      data: { cvUrl }
    });

    res.status(200).json({
      success: true,
      data: updatedApplicant,
      url: `/api/uploads/${cvUrl}`
    });
  } catch (error) {
    next(error);
  }
};

export default {
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
};