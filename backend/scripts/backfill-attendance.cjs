// One-time backfill: reads the full ATTLOG from the device on a fresh connection
// and imports every punch into Attendance using the same logic as the app's
// processAttendanceData (single-punch model, dedupe by employeeId+deviceLogId).
const sdkModule = require('zk-attendance-sdk');
const ZK = sdkModule.default || sdkModule;
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function main() {
  const client = new ZK('192.168.31.5', 4370, 8000);
  let logs;
  try {
    await client.createSocket();
    const r = await client.getAttendances();
    logs = (r && r.data) || [];
  } finally {
    try { await client.disconnect(); } catch {}
  }
  console.log('Read', logs.length, 'logs from device');

  const employees = await prisma.employee.findMany({ select: { id: true, employeeId: true } });
  const byUserId = new Map(employees.map((e) => [String(e.employeeId), e.id]));

  let created = 0, skippedNoEmp = 0, skippedDup = 0;
  for (const log of logs) {
    const userId = String(log.userId ?? log.deviceUserId ?? log.uid ?? '').trim();
    if (!userId || !byUserId.has(userId)) { skippedNoEmp++; continue; }

    const timestamp = log.attTime || log.recordTime || new Date();
    const punchTime = new Date(timestamp);
    const isMorning = punchTime.getHours() < 12;
    const checkIn = isMorning ? punchTime : undefined;
    const checkOut = isMorning ? undefined : punchTime;
    let status = 'PRESENT';
    let lateMinutes;
    if (checkIn) {
      const totalMinutes = punchTime.getHours() * 60 + punchTime.getMinutes();
      if (totalMinutes > 9 * 60) {
        status = 'LATE';
        lateMinutes = totalMinutes - 9 * 60;
      }
    }
    const deviceLogId = `${userId}-${punchTime.getTime()}`;

    const existing = await prisma.attendance.findFirst({
      where: { employeeId: byUserId.get(userId), deviceLogId }
    });
    if (existing) { skippedDup++; continue; }

    await prisma.attendance.create({
      data: {
        employeeId: byUserId.get(userId),
        checkIn,
        checkOut,
        date: new Date(punchTime.getFullYear(), punchTime.getMonth(), punchTime.getDate()),
        status,
        lateMinutes,
        deviceId: '192.168.31.5',
        deviceLogId,
      },
    });
    created++;
  }

  console.log(`Done. created=${created} dup=${skippedDup} noEmployee=${skippedNoEmp}`);
  console.log('Total attendance rows now:', await prisma.attendance.count());
}

main()
  .catch((err) => { console.error('Backfill failed:', err); process.exit(1); })
  .finally(() => prisma.$disconnect());