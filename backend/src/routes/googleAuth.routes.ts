import { Router } from 'express';
import { passport } from '../config/google';
import { googleCallback } from '../controllers/googleAuth.controller';
import { authRateLimit } from '../middleware/rateLimiter';

const router = Router();

// Only configure routes if Google OAuth is configured
if (process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET) {
  // Initiate Google OAuth login
  router.get(
    '/google',
    authRateLimit,
    passport.authenticate('google', {
      scope: ['profile', 'email'],
      prompt: 'select_account',
    })
  );

  // Google OAuth callback
  router.get(
    '/google/callback',
    passport.authenticate('google', {
      failureRedirect: '/login?error=google_auth_failed',
      session: false,
    }),
    googleCallback
  );
}

export default router;
