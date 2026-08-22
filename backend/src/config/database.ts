import { PrismaClient } from '@prisma/client';

// Prisma Client Instance — log queries only in development
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

// Log queries only in development (never log params which may contain password hashes)
if (process.env.NODE_ENV !== 'production') {
  prisma.$on('query', (e) => {
    console.log('Query: ' + e.query);
    console.log('Duration: ' + e.duration + 'ms');
  });
}

// Export for use in other files
export default prisma;
