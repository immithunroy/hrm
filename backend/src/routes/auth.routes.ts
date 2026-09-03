/**
 * Authentication Routes
 * 
 * Handles user authentication, registration, and session management.
 * 
 * Endpoints:
 *   POST /register       - Register a new user account (rate-limited, validated)
 *   POST /login          - Authenticate and receive tokens (rate-limited, validated)
 *   POST /logout         - Invalidate current session (requires auth)
 *   POST /refresh-token  - Refresh access token (rate-limited)
 *   GET  /me             - Get current user profile (requires auth)
 *   POST /change-password - Change password for current user (requires auth, validated)
 */

import { Router } from 'express';
import { register, login, logout, refreshToken, getProfile, changePassword } from '../controllers/auth.controller';
import { authenticateToken } from '../middleware/authenticateToken';
import { validateRequest } from '../middleware/validateRequest';
import { registerSchema, loginSchema, changePasswordSchema } from '../schemas/auth.schema';
import { authRateLimit } from '../middleware/rateLimiter';

const router = Router();

// Public routes with rate limiting to prevent brute-force attacks
router.post('/register', authRateLimit, validateRequest(registerSchema), register);
router.post('/login', authRateLimit, validateRequest(loginSchema), login);

// Protected routes (require valid JWT)
router.post('/logout', authenticateToken, logout);
router.get('/me', authenticateToken, getProfile);
router.post('/change-password', authenticateToken, validateRequest(changePasswordSchema), changePassword);

// Rate-limited but no auth required (token refresh)
router.post('/refresh-token', authRateLimit, refreshToken);

export default router;
