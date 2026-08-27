import passport from 'passport';
import { Strategy as GoogleStrategy } from 'passport-google-oauth20';
import { prisma } from './database';

const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET;
const GOOGLE_CALLBACK_URL = process.env.GOOGLE_CALLBACK_URL || 'http://localhost:5000/api/auth/google/callback';

export function configureGooglePassport(): void {
  if (!GOOGLE_CLIENT_ID || !GOOGLE_CLIENT_SECRET) {
    console.warn('⚠️ Google OAuth not configured (missing GOOGLE_CLIENT_ID or GOOGLE_CLIENT_SECRET)');
    return;
  }

  passport.use(
    new GoogleStrategy(
      {
        clientID: GOOGLE_CLIENT_ID,
        clientSecret: GOOGLE_CLIENT_SECRET,
        callbackURL: GOOGLE_CALLBACK_URL,
        scope: ['profile', 'email'],
        passReqToCallback: false,
      },
      async (
        _accessToken: string,
        _refreshToken: string,
        profile: any,
        done: (err: Error | null, user?: any) => void
      ) => {
        try {
          const googleId = profile.id;
          const googleEmail = profile.emails?.[0]?.value;
          const emailVerified = profile.emails?.[0]?.verified;

          if (!googleEmail) {
            return done(new Error('No email found in Google profile'), undefined);
          }

          if (!emailVerified) {
            return done(new Error('Google email is not verified'), undefined);
          }

          // Case A: Employee already linked to this Google account
          const existingGoogleUser = await prisma.employee.findUnique({
            where: { googleId },
          });
          if (existingGoogleUser) {
            if (existingGoogleUser.status !== 'ACTIVE') {
              return done(new Error('Your account has been disabled. Please contact the administrator.'), undefined);
            }
            return done(null, {
              id: existingGoogleUser.id,
              email: existingGoogleUser.email,
              role: existingGoogleUser.role,
              authMethod: 'google' as const,
            });
          }

          // Case: Google account linked to a different employee
          const emailUser = await prisma.employee.findUnique({
            where: { email: googleEmail },
          });

          if (emailUser) {
            if (emailUser.status !== 'ACTIVE') {
              return done(new Error('Your account has been disabled. Please contact the administrator.'), undefined);
            }

            // Check if this employee already has a different googleId
            if (emailUser.googleId && emailUser.googleId !== googleId) {
              return done(new Error('This email is already linked to another Google account. Please contact the administrator.'), undefined);
            }

            // Link Google account to existing employee
            await prisma.employee.update({
              where: { id: emailUser.id },
              data: {
                googleId,
                googleEmail,
                googleLinkedAt: new Date(),
              },
            });

            return done(null, {
              id: emailUser.id,
              email: emailUser.email,
              role: emailUser.role,
              authMethod: 'google' as const,
            });
          }

          // Case B: Google account not associated with any HRM user
          return done(new Error('Your Google account is not registered in the HRM system. Please contact the administrator.'), undefined);
        } catch (error) {
          return done(error as Error, undefined);
        }
      }
    )
  );

  passport.serializeUser((user: any, done) => {
    done(null, user);
  });

  passport.deserializeUser((user: any, done) => {
    done(null, user);
  });
}

export { passport };
