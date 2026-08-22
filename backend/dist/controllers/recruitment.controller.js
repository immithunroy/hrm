"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.uploadApplicantCv = exports.deleteApplicant = exports.updateApplicant = exports.createApplicant = exports.getApplicants = exports.deleteRecruitment = exports.updateRecruitment = exports.createRecruitment = exports.getRecruitmentById = exports.getRecruitments = void 0;
const database_1 = require("../config/database");
const appError_1 = require("../utils/appError");
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
// Uploaded files live under /uploads and are served at /api/uploads.
const UPLOADS_DIR = path_1.default.join(process.cwd(), 'uploads');
const CV_DIR = path_1.default.join(UPLOADS_DIR, 'cv');
const ensureUploadDirs = () => {
    fs_1.default.mkdirSync(CV_DIR, { recursive: true });
};
const ALLOWED_CV_MIME = {
    'application/pdf': 'pdf',
    'image/jpeg': 'jpg',
    'image/pjpeg': 'jpg'
};
/**
 * Get recruitment listings with filtering and pagination
 */
const getRecruitments = async (req, res, next) => {
    try {
        const { page = 1, limit = 10, search, departmentId, status, employmentType } = req.query;
        const skip = (parseInt(page) - 1) * parseInt(limit);
        const take = parseInt(limit);
        // Build where clause
        const where = {};
        if (search) {
            where.OR = [
                { jobTitle: { contains: search, mode: 'insensitive' } },
                { description: { contains: search, mode: 'insensitive' } }
            ];
        }
        if (departmentId)
            where.departmentId = departmentId;
        if (status)
            where.status = status;
        if (employmentType)
            where.employmentType = employmentType;
        const [recruitments, totalCount] = await database_1.prisma.$transaction([
            database_1.prisma.recruitment.findMany({
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
            database_1.prisma.recruitment.count({ where })
        ]);
        res.status(200).json({
            success: true,
            data: {
                recruitments,
                pagination: {
                    page: parseInt(page),
                    limit: parseInt(limit),
                    total: totalCount,
                    totalPages: Math.ceil(totalCount / parseInt(limit))
                }
            }
        });
    }
    catch (error) {
        next(error);
    }
};
exports.getRecruitments = getRecruitments;
/**
 * Get recruitment by ID
 */
const getRecruitmentById = async (req, res, next) => {
    try {
        const { id } = req.params;
        const recruitment = await database_1.prisma.recruitment.findUnique({
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
            return next(new appError_1.AppError('Recruitment not found', 404));
        }
        res.status(200).json({
            success: true,
            data: recruitment
        });
    }
    catch (error) {
        next(error);
    }
};
exports.getRecruitmentById = getRecruitmentById;
/**
 * Create recruitment listing
 */
const createRecruitment = async (req, res, next) => {
    try {
        const recruitmentData = req.body;
        // Validate department exists
        const department = await database_1.prisma.department.findUnique({
            where: { id: recruitmentData.departmentId }
        });
        if (!department) {
            return next(new appError_1.AppError('Department not found', 404));
        }
        // Validate position exists
        const position = await database_1.prisma.position.findUnique({
            where: { id: recruitmentData.positionId }
        });
        if (!position) {
            return next(new appError_1.AppError('Position not found', 404));
        }
        const recruitment = await database_1.prisma.recruitment.create({
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
    }
    catch (error) {
        next(error);
    }
};
exports.createRecruitment = createRecruitment;
/**
 * Update recruitment listing
 */
const updateRecruitment = async (req, res, next) => {
    try {
        const { id } = req.params;
        const updateData = req.body;
        // Check if recruitment exists
        const recruitment = await database_1.prisma.recruitment.findUnique({
            where: { id }
        });
        if (!recruitment) {
            return next(new appError_1.AppError('Recruitment not found', 404));
        }
        // Validate department if being updated
        if (updateData.departmentId) {
            const department = await database_1.prisma.department.findUnique({
                where: { id: updateData.departmentId }
            });
            if (!department) {
                return next(new appError_1.AppError('Department not found', 404));
            }
        }
        // Validate position if being updated
        if (updateData.positionId) {
            const position = await database_1.prisma.position.findUnique({
                where: { id: updateData.positionId }
            });
            if (!position) {
                return next(new appError_1.AppError('Position not found', 404));
            }
        }
        const updatedRecruitment = await database_1.prisma.recruitment.update({
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
    }
    catch (error) {
        next(error);
    }
};
exports.updateRecruitment = updateRecruitment;
/**
 * Delete recruitment listing
 */
const deleteRecruitment = async (req, res, next) => {
    try {
        const { id } = req.params;
        // Check if recruitment exists
        const recruitment = await database_1.prisma.recruitment.findUnique({
            where: { id }
        });
        if (!recruitment) {
            return next(new appError_1.AppError('Recruitment not found', 404));
        }
        await database_1.prisma.recruitment.delete({
            where: { id }
        });
        res.status(200).json({
            success: true,
            message: 'Recruitment listing deleted successfully'
        });
    }
    catch (error) {
        next(error);
    }
};
exports.deleteRecruitment = deleteRecruitment;
/**
 * Get applicants for a recruitment
 */
const getApplicants = async (req, res, next) => {
    try {
        const { recruitmentId } = req.params;
        const { page = 1, limit = 20, status } = req.query;
        const skip = (parseInt(page) - 1) * parseInt(limit);
        const take = parseInt(limit);
        // Build where clause
        const where = { recruitmentId };
        if (status)
            where.status = status;
        const [applicants, totalCount] = await database_1.prisma.$transaction([
            database_1.prisma.applicant.findMany({
                where,
                skip,
                take,
                orderBy: { appliedDate: 'desc' }
            }),
            database_1.prisma.applicant.count({ where })
        ]);
        res.status(200).json({
            success: true,
            data: {
                applicants,
                pagination: {
                    page: parseInt(page),
                    limit: parseInt(limit),
                    total: totalCount,
                    totalPages: Math.ceil(totalCount / parseInt(limit))
                }
            }
        });
    }
    catch (error) {
        next(error);
    }
};
exports.getApplicants = getApplicants;
/**
 * Create applicant
 */
const createApplicant = async (req, res, next) => {
    try {
        const { recruitmentId } = req.params;
        const applicantData = req.body;
        // Validate recruitment exists
        const recruitment = await database_1.prisma.recruitment.findUnique({
            where: { id: recruitmentId }
        });
        if (!recruitment) {
            return next(new appError_1.AppError('Recruitment not found', 404));
        }
        // Check if recruitment is still open
        if (recruitment.status !== 'OPEN') {
            return next(new appError_1.AppError('Recruitment is not open for applications', 400));
        }
        // Check if closing date has passed
        if (recruitment.closingDate && new Date() > recruitment.closingDate) {
            return next(new appError_1.AppError('Recruitment application period has ended', 400));
        }
        const applicant = await database_1.prisma.applicant.create({
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
    }
    catch (error) {
        next(error);
    }
};
exports.createApplicant = createApplicant;
/**
 * Update applicant (full profile + status)
 */
const updateApplicant = async (req, res, next) => {
    try {
        const { recruitmentId, applicantId } = req.params;
        const { status, ...profileData } = req.body;
        // Check if applicant exists
        const applicant = await database_1.prisma.applicant.findUnique({
            where: { id: applicantId, recruitmentId }
        });
        if (!applicant) {
            return next(new appError_1.AppError('Applicant not found', 404));
        }
        const updatedApplicant = await database_1.prisma.applicant.update({
            where: { id: applicantId },
            data: {
                ...profileData,
                status: status ?? applicant.status,
                interviewedAt: status === 'INTERVIEWED' || status === 'HIRED'
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
    }
    catch (error) {
        next(error);
    }
};
exports.updateApplicant = updateApplicant;
/**
 * Delete applicant
 */
const deleteApplicant = async (req, res, next) => {
    try {
        const { recruitmentId, applicantId } = req.params;
        const applicant = await database_1.prisma.applicant.findUnique({
            where: { id: applicantId, recruitmentId }
        });
        if (!applicant) {
            return next(new appError_1.AppError('Applicant not found', 404));
        }
        await database_1.prisma.applicant.delete({
            where: { id: applicantId }
        });
        res.status(200).json({
            success: true,
            message: 'Applicant deleted successfully'
        });
    }
    catch (error) {
        next(error);
    }
};
exports.deleteApplicant = deleteApplicant;
/**
 * Upload a candidate CV (pdf or jpg) as base64 JSON: { data, filename }.
 * Saves the file under uploads/cv and stores the relative path in applicant.cvUrl.
 */
const uploadApplicantCv = async (req, res, next) => {
    try {
        const { recruitmentId, applicantId } = req.params;
        const { data, filename } = req.body;
        const applicant = await database_1.prisma.applicant.findUnique({
            where: { id: applicantId, recruitmentId }
        });
        if (!applicant) {
            return next(new appError_1.AppError('Applicant not found', 404));
        }
        if (!data || typeof data !== 'string') {
            return next(new appError_1.AppError('CV file data (base64) is required', 400));
        }
        // Detect MIME from the base64 prefix if a filename was not provided/recognized.
        let mime = 'application/octet-stream';
        const match = /^data:([a-zA-Z0-9./+-]+);base64,/.exec(data);
        const base64 = match ? data.slice(match[0].length) : data.replace(/\s+/g, '');
        if (match)
            mime = match[1];
        else if (/^%PDF/.test(Buffer.from(base64, 'base64').slice(0, 5).toString('latin1')))
            mime = 'application/pdf';
        else if (/^\xFF\xD8\xFF/.test(Buffer.from(base64, 'base64').slice(0, 3).toString('latin1')))
            mime = 'image/jpeg';
        const ext = ALLOWED_CV_MIME[mime];
        if (!ext) {
            return next(new appError_1.AppError('CV must be a PDF or JPG file', 400));
        }
        const buffer = Buffer.from(base64, 'base64');
        if (buffer.length === 0) {
            return next(new appError_1.AppError('CV file is empty', 400));
        }
        if (buffer.length > 8 * 1024 * 1024) {
            return next(new appError_1.AppError('CV file must be 8MB or smaller', 400));
        }
        const safeBase = (filename || 'cv').replace(/[^a-zA-Z0-9._-]/g, '').replace(/\.(pdf|jpg|jpeg)$/i, '') || 'cv';
        const savedName = `${applicantId}-${Date.now()}-${safeBase}.${ext}`;
        ensureUploadDirs();
        fs_1.default.writeFileSync(path_1.default.join(CV_DIR, savedName), buffer);
        const cvUrl = `cv/${savedName}`;
        const updatedApplicant = await database_1.prisma.applicant.update({
            where: { id: applicantId },
            data: { cvUrl }
        });
        res.status(200).json({
            success: true,
            data: updatedApplicant,
            url: `/api/uploads/${cvUrl}`
        });
    }
    catch (error) {
        next(error);
    }
};
exports.uploadApplicantCv = uploadApplicantCv;
exports.default = {
    getRecruitments: exports.getRecruitments,
    getRecruitmentById: exports.getRecruitmentById,
    createRecruitment: exports.createRecruitment,
    updateRecruitment: exports.updateRecruitment,
    deleteRecruitment: exports.deleteRecruitment,
    getApplicants: exports.getApplicants,
    createApplicant: exports.createApplicant,
    updateApplicant: exports.updateApplicant,
    deleteApplicant: exports.deleteApplicant,
    uploadApplicantCv: exports.uploadApplicantCv
};
