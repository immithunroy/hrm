import dotenv from 'dotenv';
import { prisma } from '../config/database';
import { recomputeAllAttendance } from '../services/zktService';

dotenv.config();

async function main() {
  await prisma.$connect();
  const result = await recomputeAllAttendance();
  console.log(`Recomputed ${result.updated}/${result.total} attendance records`);
}

main()
  .catch((err) => { console.error('Recompute failed:', err); process.exit(1); })
  .finally(() => prisma.$disconnect());