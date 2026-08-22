"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getProfile = exports.refreshToken = exports.logout = exports.login = exports.register = void 0;
const bcryptjs_1 = require("bcryptjs");
const jsonwebtoken_1 = require("jsonwebtoken");
const database_1 = require("../config/database");
const appError_1 = require("../utils/appError");
const JWT_SECRET = process.env.JWT_SECRET;
const JWT_EXPIRES_IN = (process.env.JWT_EXPIRES_IN || '7d');
const JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET;
const JWT_REFRESH_EXPIRES_IN = (process.env.JWT_REFRESH_EXPIRES_IN || '30d');
if (!JWT_SECRET || !JWT_REFRESH_SECRET) {
    console.error('FATAL: JWT_SECRET and JWT_REFRESH_SECRET must be set');
    process.exit(1);
}
/**
 * Register a new user
 */
const register = async (req, res, next) => {
    try {
        const { firstName, lastName, email, password, employeeId } = req.body;
        const existingUser = await database_1.prisma.employee.findUnique({
            where: { email }
        });
        if (existingUser) {
            return next(new appError_1.AppError('User already exists with this email', 400));
        }
        const hashedPassword = await (0, bcryptjs_1.hash)(password, 12);
        let department = await database_1.prisma.department.findFirst();
        if (!department) {
            department = await database_1.prisma.department.create({
                data: { name: 'General', code: 'GEN' }
            });
        }
        let position = await database_1.prisma.position.findFirst({ where: { departmentId: department.id } });
        if (!position) {
            position = await database_1.prisma.position.create({
                data: {
                    title: 'Employee',
                    departmentId: department.id,
                    level: 'ENTRY',
                    minSalary: 0,
                    maxSalary: 0
                }
            });
        }
        const employee = await database_1.prisma.employee.create({
            data: {
                firstName,
                lastName,
                email,
                password: hashedPassword,
                employeeId: employeeId || `EMP${Date.now()}`,
                hireDate: new Date(),
                employmentType: 'FULL_TIME',
                status: 'ACTIVE',
                departmentId: department.id,
                positionId: position.id
            }
        });
        const accessToken = (0, jsonwebtoken_1.sign)({ id: employee.id, email: employee.email, role: employee.role }, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });
        const refreshToken = (0, jsonwebtoken_1.sign)({ id: employee.id }, JWT_REFRESH_SECRET, { expiresIn: JWT_REFRESH_EXPIRES_IN });
        const isSecure = req.headers['x-forwarded-proto'] === 'https' || process.env.NODE_ENV === 'production';
        res.cookie('refreshToken', refreshToken, {
            httpOnly: true,
            secure: isSecure,
            sameSite: 'strict',
            maxAge: 30 * 24 * 60 * 60 * 1000
        });
        res.status(201).json({
            success: true,
            data: {
                accessToken,
                employee: {
                    id: employee.id,
                    firstName: employee.firstName,
                    lastName: employee.lastName,
                    email: employee.email,
                    employeeId: employee.employeeId,
                    role: employee.role
                }
            }
        });
    }
    catch (error) {
        next(error);
    }
};
exports.register = register;
/**
 * Login user
 */
const login = async (req, res, next) => {
    try {
        const { email, password } = req.body;
        const employee = await database_1.prisma.employee.findUnique({
            where: { email }
        });
        if (!employee || !employee.password) {
            return next(new appError_1.AppError('Invalid credentials', 401));
        }
        const isPasswordValid = await (0, bcryptjs_1.compare)(password, employee.password);
        if (!isPasswordValid) {
            return next(new appError_1.AppError('Invalid credentials', 401));
        }
        const accessToken = (0, jsonwebtoken_1.sign)({ id: employee.id, email: employee.email, role: employee.role }, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });
        const refreshToken = (0, jsonwebtoken_1.sign)({ id: employee.id }, JWT_REFRESH_SECRET, { expiresIn: JWT_REFRESH_EXPIRES_IN });
        const isSecure = req.headers['x-forwarded-proto'] === 'https' || process.env.NODE_ENV === 'production';
        res.cookie('refreshToken', refreshToken, {
            httpOnly: true,
            secure: isSecure,
            sameSite: 'strict',
            maxAge: 30 * 24 * 60 * 60 * 1000
        });
        res.status(200).json({
            success: true,
            data: {
                accessToken,
                employee: {
                    id: employee.id,
                    firstName: employee.firstName,
                    lastName: employee.lastName,
                    email: employee.email,
                    employeeId: employee.employeeId,
                    role: employee.role
                }
            }
        });
    }
    catch (error) {
        next(error);
    }
};
exports.login = login;
// Revocation set for refresh tokens (in-memory; survives until restart).
// For true persistence, store hashed tokens in DB.
const revokedRefreshTokens = new Set();
/**
 * Logout user
 */
const logout = (req, res) => {
    const token = req.cookies?.refreshToken;
    if (token) {
        revokedRefreshTokens.add(token);
    }
    const isSecure = req.headers['x-forwarded-proto'] === 'https' || process.env.NODE_ENV === 'production';
    res.clearCookie('refreshToken', {
        httpOnly: true,
        secure: isSecure,
        sameSite: 'strict'
    });
    res.status(200).json({
        success: true,
        message: 'Logged out successfully'
    });
};
exports.logout = logout;
/**
 * Refresh access token
 */
const refreshToken = async (req, res, next) => {
    try {
        const { refreshToken: token } = req.cookies;
        if (!token) {
            return next(new appError_1.AppError('Refresh token not provided', 401));
        }
        if (revokedRefreshTokens.has(token)) {
            return next(new appError_1.AppError('Refresh token has been revoked', 401));
        }
        try {
            const decoded = (0, jsonwebtoken_1.verify)(token, JWT_REFRESH_SECRET);
            const employee = await database_1.prisma.employee.findUnique({
                where: { id: decoded.id }
            });
            if (!employee) {
                return next(new appError_1.AppError('Invalid refresh token', 401));
            }
            const accessToken = (0, jsonwebtoken_1.sign)({ id: employee.id, email: employee.email, role: employee.role }, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });
            res.status(200).json({
                success: true,
                data: {
                    accessToken
                }
            });
        }
        catch (error) {
            return next(new appError_1.AppError('Invalid or expired refresh token', 401));
        }
    }
    catch (error) {
        next(error);
    }
};
exports.refreshToken = refreshToken;
/**
 * Get current user profile
 */
const getProfile = async (req, res, next) => {
    try {
        const employeeId = req.userId;
        const employee = await database_1.prisma.employee.findUnique({
            where: { id: employeeId },
            select: {
                id: true,
                firstName: true,
                lastName: true,
                middleName: true,
                email: true,
                phone: true,
                employeeId: true,
                dateOfBirth: true,
                gender: true,
                maritalStatus: true,
                hireDate: true,
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
                },
                employmentType: true,
                status: true,
                salary: true,
                role: true
            }
        });
        if (!employee) {
            return next(new appError_1.AppError('Employee not found', 404));
        }
        res.status(200).json({
            success: true,
            data: employee
        });
    }
    catch (error) {
        next(error);
    }
};
exports.getProfile = getProfile;
