import { Request, Response, NextFunction } from 'express';
import { compare, hash } from 'bcryptjs';
import { sign, verify, type SignOptions } from 'jsonwebtoken';
import { prisma } from '../config/database';
import { AppError } from '../utils/appError';

const JWT_SECRET = process.env.JWT_SECRET;
const JWT_EXPIRES_IN: SignOptions['expiresIn'] = (process.env.JWT_EXPIRES_IN || '7d') as SignOptions['expiresIn'];
const JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET;
const JWT_REFRESH_EXPIRES_IN: SignOptions['expiresIn'] = (process.env.JWT_REFRESH_EXPIRES_IN || '30d') as SignOptions['expiresIn'];

if (!JWT_SECRET || !JWT_REFRESH_SECRET) {
  console.error('FATAL: JWT_SECRET and JWT_REFRESH_SECRET must be set');
  process.exit(1);
}

interface JwtPayload {
  id: string;
  email: string;
  role: string;
}

/**
 * Register a new user (EMPLOYEE role only — used by mobile or self-service).
 * For creating ADMIN/MANAGER/HR/FINANCE accounts, use POST /api/employees.
 */
export const register = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { firstName, lastName, email, username, password, employeeId } = req.body;

    const existingEmail = await prisma.employee.findUnique({ where: { email } });
    if (existingEmail) {
      return next(new AppError('User already exists with this email', 400));
    }

    const existingUsername = await prisma.employee.findUnique({ where: { username } });
    if (existingUsername) {
      return next(new AppError('Username already taken', 400));
    }

    const hashedPassword = await hash(password, 12);

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

    // Self-registration always creates EMPLOYEE role only.
    const employee = await prisma.employee.create({
      data: {
        firstName,
        lastName,
        email,
        username: username.toLowerCase().trim(),
        password: hashedPassword,
        employeeId: employeeId || `EMP${Date.now()}`,
        hireDate: new Date(),
        employmentType: 'FULL_TIME',
        status: 'ACTIVE',
        role: 'EMPLOYEE',
        departmentId: department.id,
        positionId: position.id
      }
    });

    const accessToken = sign(
      { id: employee.id, email: employee.email, role: employee.role },
      JWT_SECRET,
      { expiresIn: JWT_EXPIRES_IN }
    );

    const refreshToken = sign(
      { id: employee.id },
      JWT_REFRESH_SECRET,
      { expiresIn: JWT_REFRESH_EXPIRES_IN }
    );

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
          username: employee.username,
          employeeId: employee.employeeId,
          role: employee.role
        }
      }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Login user — authenticates by username
 */
export const login = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { username, password } = req.body;

    const employee = await prisma.employee.findUnique({
      where: { username: username.toLowerCase().trim() }
    });

    if (!employee || !employee.password) {
      return next(new AppError('Invalid username or password', 401));
    }

    const isPasswordValid = await compare(password, employee.password);
    if (!isPasswordValid) {
      return next(new AppError('Invalid username or password', 401));
    }

    const accessToken = sign(
      { id: employee.id, email: employee.email, role: employee.role },
      JWT_SECRET,
      { expiresIn: JWT_EXPIRES_IN }
    );

    const refreshToken = sign(
      { id: employee.id },
      JWT_REFRESH_SECRET,
      { expiresIn: JWT_REFRESH_EXPIRES_IN }
    );

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
          username: employee.username,
          employeeId: employee.employeeId,
          role: employee.role
        }
      }
    });
  } catch (error) {
    next(error);
  }
};

// Revocation set for refresh tokens (in-memory; survives until restart).
// For true persistence, store hashed tokens in DB.
const revokedRefreshTokens = new Set<string>();

/**
 * Logout user
 */
export const logout = (req: Request, res: Response) => {
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

/**
 * Refresh access token
 */
export const refreshToken = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { refreshToken: token } = req.cookies;

    if (!token) {
      return next(new AppError('Refresh token not provided', 401));
    }

    if (revokedRefreshTokens.has(token)) {
      return next(new AppError('Refresh token has been revoked', 401));
    }

    try {
      const decoded = verify(token, JWT_REFRESH_SECRET) as JwtPayload;
      
      const employee = await prisma.employee.findUnique({
        where: { id: decoded.id }
      });

      if (!employee) {
        return next(new AppError('Invalid refresh token', 401));
      }

      const accessToken = sign(
        { id: employee.id, email: employee.email, role: employee.role },
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
 * Change current user's password
 */
export const changePassword = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const employeeId = req.userId;
    const { currentPassword, newPassword } = req.body;

    const employee = await prisma.employee.findUnique({ where: { id: employeeId } });
    if (!employee || !employee.password) {
      return next(new AppError('Employee not found', 404));
    }

    const isMatch = await compare(currentPassword, employee.password);
    if (!isMatch) {
      return next(new AppError('Current password is incorrect', 401));
    }

    await prisma.employee.update({
      where: { id: employeeId },
      data: { password: await hash(newPassword, 12) }
    });

    res.status(200).json({
      success: true,
      message: 'Password changed successfully'
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get current user profile
 */
export const getProfile = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const employeeId = req.userId;

    const employee = await prisma.employee.findUnique({
      where: { id: employeeId },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        middleName: true,
        email: true,
        username: true,
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
