/**
 * Attendance Recomputation CLI Script
 *
 * One-shot script that recalculates all attendance records from raw
 * ZKT biometric punch data. Useful after:
 *   - Importing historical punch data
 *   - Changing attendance calculation rules
 *   - Fixing data inconsistencies
 *
 * Usage:
 *   npx ts-node src/scripts/recompute-attendance.ts
 *
 * Reads DATABASE_URL from .env file. Disconnects cleanly on success or failure.
 */
import dotenv from 'dotenv';
import { prisma } from '../config/database';
import { recomputeAllAttendance } from '../services/zktService';

dotenv.config();

async function main() {
  await prisma.$connect();
  const result = await recomputeAllAttendance();
  console.log(`Recomputed ${result.updated}/${result.total} attendance records`);
}

// Run with proper cleanup — exit(1) on failure so CI/scripts can detect errors
main()
  .catch((err) => { console.error('Recompute failed:', err); process.exit(1); })
  .finally(() => prisma.$disconnect());