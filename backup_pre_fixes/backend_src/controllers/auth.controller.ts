import { Request, Response, NextFunction } from 'express';
import { compare, hash } from 'bcryptjs';
import { sign, verify, type SignOptions } from 'jsonwebtoken';
import { prisma } from '../config/database';
import { AppError } from '../utils/appError';

const JWT_SECRET = process.env.JWT_SECRET || 'your-super-secret-jwt-key-change-in-production';
const JWT_EXPIRES_IN: SignOptions['expiresIn'] = (process.env.JWT_EXPIRES_IN || '7d') as SignOptions['expiresIn'];
const JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET || 'your-super-secret-refresh-key-change-in-production';
const JWT_REFRESH_EXPIRES_IN: SignOptions['expiresIn'] = (process.env.JWT_REFRESH_EXPIRES_IN || '30d') as SignOptions['expiresIn'];

interface JwtPayload {
  id: string;
  email: string;
}

/**
 * Register a new user
 */
export const register = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { firstName, lastName, email, password, employeeId } = req.body;

    // Check if user already exists
    const existingUser = await prisma.employee.findUnique({
      where: { email }
    });

    if (existingUser) {
      return next(new AppError('User already exists with this email', 400));
    }

    // Hash password
    const hashedPassword = await hash(password, 12);

    // Resolve department and position for the new employee
    let department = await prisma.department.findFirst();
    if (!department) {
      department = await prisma.department.create({
        data: { name: 'General', code: 'GEN' }
      });
    }

    let position = await prisma.position.findFirst({ where: { departmentId: department.id } });
    if (!position) {
      position = await prisma.position.create({
        data: {
          title: 'Employee',
          departmentId: department.id,
          level: 'ENTRY',
          minSalary: 0,
          maxSalary: 0
        }
      });
    }

    // Create employee record
    const employee = await prisma.employee.create({
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

    // Generate tokens
    const accessToken = sign(
      { id: employee.id, email: employee.email },
      JWT_SECRET,
      { expiresIn: JWT_EXPIRES_IN }
    );

    const refreshToken = sign(
      { id: employee.id },
      JWT_REFRESH_SECRET,
      { expiresIn: JWT_REFRESH_EXPIRES_IN }
    );

    // Set refresh token as HTTP-only cookie
    // Check X-Forwarded-Proto header (set by nginx) to determine if original request was HTTPS
    const isSecure = req.headers['x-forwarded-proto'] === 'https' || process.env.NODE_ENV === 'production';
    res.cookie('refreshToken', refreshToken, {
      httpOnly: true,
      secure: isSecure,
      sameSite: 'strict',
      maxAge: 30 * 24 * 60 * 60 * 1000 // 30 days
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
          employeeId: employee.employeeId
        }
      }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Login user
 */
export const login = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { email, password } = req.body;

    // Find employee by email
    const employee = await prisma.employee.findUnique({
      where: { email }
    });

    if (!employee || !employee.password) {
      return next(new AppError('Invalid credentials', 401));
    }

    // Verify password
    const isPasswordValid = await compare(password, employee.password);
    if (!isPasswordValid) {
      return next(new AppError('Invalid credentials', 401));
    }

    // Generate tokens
    const accessToken = sign(
      { id: employee.id, email: employee.email },
      JWT_SECRET,
      { expiresIn: JWT_EXPIRES_IN }
    );

    const refreshToken = sign(
      { id: employee.id },
      JWT_REFRESH_SECRET,
      { expiresIn: JWT_REFRESH_EXPIRES_IN }
    );

    // Set refresh token as HTTP-only cookie
    // Check X-Forwarded-Proto header (set by nginx) to determine if original request was HTTPS
    const isSecure = req.headers['x-forwarded-proto'] === 'https' || process.env.NODE_ENV === 'production';
    res.cookie('refreshToken', refreshToken, {
      httpOnly: true,
      secure: isSecure,
      sameSite: 'strict',
      maxAge: 30 * 24 * 60 * 60 * 1000 // 30 days
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
          employeeId: employee.employeeId
        }
      }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Logout user
 */
export const logout = (req: Request, res: Response) => {
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

/**
 * Refresh access token
 */
export const refreshToken = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { refreshToken: token } = req.cookies;

    if (!token) {
      return next(new AppError('Refresh token not provided', 401));
    }

    try {
      const decoded = verify(token, JWT_REFRESH_SECRET) as JwtPayload;
      
      // Find employee
      const employee = await prisma.employee.findUnique({
        where: { id: decoded.id }
      });

      if (!employee) {
        return next(new AppError('Invalid refresh token', 401));
      }

      // Generate new access token
      const accessToken = sign(
        { id: employee.id, email: employee.email },
        JWT_SECRET,
        { expiresIn: JWT_EXPIRES_IN }
      );

      res.status(200).json({
        success: true,
        data: {
          accessToken
        }
      });
    } catch (error) {
      return next(new AppError('Invalid or expired refresh token', 401));
    }
  } catch (error) {
    next(error);
  }
};

/**
 * Get current user profile
 */
export const getProfile = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const employeeId = req.userId; // Set by authenticateToken middleware

    const employee = await prisma.employee.findUnique({
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
        salary: true
      }
    });

    if (!employee) {
      return next(new AppError('Employee not found', 404));
    }

    res.status(200).json({
      success: true,
      data: employee
    });
  } catch (error) {
    next(error);
  }
};