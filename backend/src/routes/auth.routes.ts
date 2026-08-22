import { Router } from 'express';
import { register, login, logout, refreshToken, getProfile } from '../controllers/auth.controller';
import { authenticateToken } from '../middleware/authenticateToken';
import { validateRequest } from '../middleware/validateRequest';
import { registerSchema, loginSchema } from '../schemas/auth.schema';
import { authRateLimit } from '../middleware/rateLimiter';

const router = Router();

router.post('/register', authRateLimit, validateRequest(registerSchema), register);
router.post('/login', authRateLimit, validateRequest(loginSchema), login);
router.post('/logout', authenticateToken, logout);
router.post('/refresh-token', refreshToken);
router.get('/me', authenticateToken, getProfile);

export default router;
