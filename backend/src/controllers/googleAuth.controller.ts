import { Request, Response, NextFunction } from 'express';
import { sign, type SignOptions } from 'jsonwebtoken';
import { prisma } from '../config/database';

const JWT_SECRET = process.env.JWT_SECRET!;
const JWT_EXPIRES_IN: SignOptions['expiresIn'] = (process.env.JWT_EXPIRES_IN || '7d') as SignOptions['expiresIn'];
const JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET!;
const JWT_REFRESH_EXPIRES_IN: SignOptions['expiresIn'] = (process.env.JWT_REFRESH_EXPIRES_IN || '30d') as SignOptions['expiresIn'];

if (!process.env.JWT_SECRET || !process.env.JWT_REFRESH_SECRET) {
  console.error('FATAL: JWT_SECRET and JWT_REFRESH_SECRET must be set');
  process.exit(1);
}

const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:5173';

/**
 * Generate JWT tokens for a given employee
 */
function generateTokens(employee: { id: string; email: string; role: string }) {
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

  return { accessToken, refreshToken };
}

/**
 * Handle successful Google OAuth callback.
 * Passport attaches the user info from google.ts strategy.
 * We issue our own JWT and redirect to the frontend with the token.
 */
export const googleCallback = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const user = req.user as any;

    if (!user || !user.id) {
      return res.redirect(`${FRONTEND_URL}/login?error=google_auth_failed`);
    }

    const employee = await prisma.employee.findUnique({
      where: { id: user.id },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        email: true,
        employeeId: true,
        role: true,
        status: true,
      },
    });

    if (!employee) {
      return res.redirect(`${FRONTEND_URL}/login?error=google_auth_failed`);
    }

    if (employee.status !== 'ACTIVE') {
      return res.redirect(`${FRONTEND_URL}/login?error=account_disabled`);
    }

    const { accessToken, refreshToken } = generateTokens(employee);

    // Set refresh token as httpOnly cookie
    const isSecure = req.headers['x-forwarded-proto'] === 'https' || process.env.NODE_ENV === 'production';
    res.cookie('refreshToken', refreshToken, {
      httpOnly: true,
      secure: isSecure,
      sameSite: 'strict',
      maxAge: 30 * 24 * 60 * 60 * 1000, // 30 days
    });

    // Redirect to frontend with access token in URL fragment (hash)
    // Using hash (#) because it's not sent to the server
    res.redirect(`${FRONTEND_URL}/auth/callback#token=${accessToken}`);
  } catch (error) {
    next(error);
  }
};

/**
 * Exchange refresh token for new access token (web-specific endpoint).
 * This also validates the client type to ensure Android tokens are handled separately.
 */
export const exchangeRefreshToken = async (req: Request, res: Response, next: NextFunction) => {
  // This is handled by the existing refresh-token endpoint in auth.controller.ts
  // No separate endpoint needed - we reuse the existing one
  next();
};
