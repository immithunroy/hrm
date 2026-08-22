// Imports ZKT device users as Employee records so attendance sync can match punches.
// Usage (inside backend container): node scripts/import-device-users.cjs
// Prereqs: DATABASE_URL set (via compose), patched zk-attendance-sdk in node_modules.
const sdkModule = require('zk-attendance-sdk');
const ZKAttendanceClient = sdkModule.default || sdkModule;
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

const deviceIp = process.env.ZKT_DEVICE_IP || '192.168.31.5';
const devicePort = parseInt(process.env.ZKT_DEVICE_PORT || '4370', 10);

const splitName = (name) => {
  const trimmed = (name || '').trim().replace(/\u0000/g, '');
  const parts = trimmed.split(/\s+/).filter(Boolean);
  if (parts.length === 0) return { firstName: 'Unknown', lastName: '' };
  if (parts.length === 1) return { firstName: parts[0], lastName: '' };
  const lastName = parts.pop();
  return { firstName: parts.join(' '), lastName };
};

const makeEmail = (fullName, userId) => {
  const base = fullName
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '')
    .slice(0, 40);
  return `${base || 'user'}${userId}@company.com`;
};

async function main() {
  const client = new ZKAttendanceClient(deviceIp, devicePort, 8000);
  let deviceUsers;
  try {
    await client.createSocket();
    const result = await client.getUsers();
    deviceUsers = (result && result.data) || result || [];
  } finally {
    try { await client.disconnect(); } catch {}
  }

  if (!deviceUsers.length) {
    console.error('No device users fetched — aborting.');
    process.exit(1);
  }

  const departments = await prisma.department.findMany({ orderBy: { code: 'asc' } });
  const positions = await prisma.position.findMany({ orderBy: { title: 'asc' } });
  const departmentId = departments.find((d) => d.code === 'OPS')?.id || departments[0]?.id;
  const positionId = positions.find((p) => p.title.includes('Manager'))?.id || positions[0]?.id;
  if (!departmentId || !positionId) {
    console.error('No department/position found to assign employees — aborting.');
    process.exit(1);
  }

  const existing = await prisma.employee.findMany({ select: { employeeId: true } });
  const existingIds = new Set(existing.map((e) => e.employeeId));
  const usedEmails = new Set((await prisma.employee.findMany({ select: { email: true } })).map((e) => e.email));

  let created = 0;
  for (const user of deviceUsers) {
    const userId = String(user.userId ?? user.uid ?? '').trim();
    if (!userId || existingIds.has(userId)) continue;
    const fullName = String(user.name || '').trim();
    const { firstName, lastName } = splitName(fullName);
    let email = makeEmail(fullName, userId);
    let suffix = 2;
    while (usedEmails.has(email)) {
      email = makeEmail(fullName, userId) + suffix++;
    }
    await prisma.employee.create({
      data: {
        employeeId: userId,
        firstName: firstName || `User ${userId}`,
        lastName,
        email,
        hireDate: new Date('2023-01-01'),
        departmentId,
        positionId,
        employmentType: 'FULL_TIME',
        status: 'ACTIVE',
        salary: 0,
        address: 'Imported from ZKT device',
      },
    });
    usedEmails.add(email);
    existingIds.add(userId);
    created++;
    console.log(`Created employee: employeeId=${userId} name="${fullName || `${firstName} ${lastName}`}" email=${email}`);
  }

  console.log(`Done. Created ${created} employee(s) from ${deviceUsers.length} device user(s).`);
}

main()
  .catch((err) => {
    console.error('Import failed:', err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());