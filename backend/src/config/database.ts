/**
 * Prisma Database Client (Singleton)
 *
 * Exports a single PrismaClient instance used across the entire app.
 * In development: logs every SQL query + duration to stdout for debugging.
 * In production: logs only errors and warnings to stdout.
 *
 * The singleton pattern prevents exhausting the DB connection pool when
 * hot-reloading or importing this module from multiple places.
 *
 * Note: Query params are intentionally NOT logged to avoid leaking
 * password hashes or other sensitive data.
 */
import { PrismaClient } from '@prisma/client';

// Configure logging per environment:
//  - Production: errors + warnings only (keeps logs clean)
//  - Development: adds query-level logging for debugging (emitted as events below)
const logConfig = process.env.NODE_ENV === 'production'
  ? [
      { emit: 'stdout' as const, level: 'error' as const },
      { emit: 'stdout' as const, level: 'warn' as const },
    ]
  : [
      { emit: 'event' as const, level: 'query' as const },
      { emit: 'stdout' as const, level: 'error' as const },
      { emit: 'stdout' as const, level: 'warn' as const },
    ];

export const prisma = new PrismaClient({ log: logConfig });

// Register query event listener in dev only — logs SQL + execution time
// Never log query params: they may contain passwords, tokens, or PII
if (process.env.NODE_ENV !== 'production') {
  prisma.$on('query', (e) => {
    console.log('Query: ' + e.query);
    console.log('Duration: ' + e.duration + 'ms');
  });
}

// Re-export as default for convenient `import prisma from '...'` usage
export default prisma;
