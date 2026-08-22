const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

(async () => {
  const shifts = await prisma.shift.findMany({ select: { id: true, name: true, isActive: true } });
  console.log('BEFORE:', JSON.stringify(shifts, null, 2));

  const result = await prisma.shift.deleteMany({
    where: { name: { in: ['Morning', 'Evening'] } }
  });
  console.log('Deleted:', result.count);

  const remaining = await prisma.shift.findMany({ select: { id: true, name: true, isActive: true } });
  console.log('AFTER:', JSON.stringify(remaining, null, 2));

  await prisma.$disconnect();
})().catch(async (error) => {
  console.error('ERROR:', error?.message || error);
  await prisma.$disconnect();
  process.exit(1);
});