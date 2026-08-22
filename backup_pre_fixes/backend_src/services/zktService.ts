import ZKAttendanceClient from 'zk-attendance-sdk';
import { prisma } from '../config/database';
import { Server } from 'socket.io';

let zkClient: ZKAttendanceClient | null = null;
let isConnected = false;
let isConnecting = false;
let isSyncing = false;

// Device clock maintenance (Asia/Dhaka)
const DEVICE_CLOCK_CHECK_INTERVAL = 60 * 60 * 1000; // 1 hour
const DEVICE_CLOCK_TOLERANCE_SECONDS = 60;

// Device log retention
const DEVICE_LOG_RETENTION_DAYS = 180;

// Active shift (the currently-running one). Used to classify punches and compute
// lateness / early departure / work hours. Loaded from the DB so it follows the
// running shift (Regular: 10:00-19:00, 60m break).
interface ShiftWindow {
  id: string;
  name: string;
  startMinutes: number;
  endMinutes: number;
  breakMinutes: number;
}

let activeShift: ShiftWindow = { id: '', name: 'Regular', startMinutes: 10 * 60, endMinutes: 19 * 60, breakMinutes: 60 };
let hasShiftAssignments = false;

const DEFAULT_SHIFT: ShiftWindow = { id: '', name: 'Regular', startMinutes: 10 * 60, endMinutes: 19 * 60, breakMinutes: 60 };

const toMinutes = (hhmm: string): number => {
  const [h, m] = hhmm.split(':').map(Number);
  return (h || 0) * 60 + (m || 0);
};

export const loadActiveShift = async (): Promise<void> => {
  try {
    const shift = await prisma.shift.findFirst({ where: { isActive: true }, orderBy: { name: 'asc' } });
    if (shift?.startTime && shift?.endTime) {
      activeShift = {
        id: shift.id,
        name: shift.name,
        startMinutes: toMinutes(shift.startTime),
        endMinutes: toMinutes(shift.endTime),
        breakMinutes: shift.breakTime || 0
      };
    } else {
      activeShift = { ...DEFAULT_SHIFT };
    }
    const assignmentCount = await prisma.shiftAssignment.count();
    hasShiftAssignments = assignmentCount > 0;
  } catch (error) {
    console.error('Failed to load active shift:', error);
    activeShift = { ...DEFAULT_SHIFT };
  }
};

// ---------------------------------------------------------------------------
// Daily punch model (Asia/Dhaka)
// A work day runs 04:00 to 04:00 (Dhaka). The FIRST punch of the day is the
// sign-in, the LAST punch is the sign-out. Punches in between are personal-out
// (errand) trips tracked in a separate column. Anyone who forgets to sign out
// is auto-signed-out at 04:00 by the system. Overtime is the time punched
// before the shift start plus the time punched after the shift end.
// ---------------------------------------------------------------------------

const DHAKA_OFFSET_MS = 6 * 3600 * 1000;
const DAY_END_HOUR = 4; // 4:00 AM rollover

const dhakaMidnight = (y: number, m: number, d: number): Date =>
  new Date(Date.UTC(y, m, d) - DHAKA_OFFSET_MS);

// Which work-day a punch belongs to (Dhaka, 04:00 boundary).
const getPunchDay = (punchMs: number): { date: Date; dayEnd: Date; nowClosed: boolean } => {
  const local = new Date(punchMs + DHAKA_OFFSET_MS);
  let y = local.getUTCFullYear();
  let m = local.getUTCMonth();
  let d = local.getUTCDate();
  if (local.getUTCHours() < DAY_END_HOUR) {
    const prev = new Date(Date.UTC(y, m, d - 1));
    y = prev.getUTCFullYear();
    m = prev.getUTCMonth();
    d = prev.getUTCDate();
  }
  const date = dhakaMidnight(y, m, d);
  const dayEnd = dhakaMidnight(y, m, d + 1); // next day 04:00 Dhaka
  return { date, dayEnd, nowClosed: Date.now() >= dayEnd.getTime() };
};

const dhakaMinutes = (punchMs: number): number => {
  const local = new Date(punchMs + DHAKA_OFFSET_MS);
  return local.getUTCHours() * 60 + local.getUTCMinutes();
};

// Compute the daily summary from a sorted list of punch timestamps (ms).
const computeDailySummary = (
  punchesMs: number[],
  shift: ShiftWindow,
  dayEndMs: number,
  autoCheckOut: boolean
) => {
  const sorted = [...new Set(punchesMs)].sort((a, b) => a - b);
  if (sorted.length === 0) return null;

  // A single punch is just the sign-in — the day is still open with no real
  // sign-out yet, so it must not be flagged as an early departure. It resolves
  // when the employee punches out, or is auto-signed-out at the 04:00 rollover
  // (that path passes two punches + autoCheckOut=true).
  const openSinglePunch = sorted.length === 1 && !autoCheckOut;

  let checkIn = new Date(sorted[0]);
  let checkOut = openSinglePunch ? null : new Date(sorted[sorted.length - 1]);

  // Personal-out (errand) gaps: punches alternate in/out, so gaps at odd
  // indexes (out -> back in) are time away on personal work.
  let breakMinutes = 0;
  let errandCount = 0;
  for (let i = 1; i < sorted.length - 1; i++) {
    if (i % 2 === 1) {
      const gap = sorted[i + 1] - sorted[i];
      if (gap > 0) {
        breakMinutes += Math.round(gap / 60000);
        errandCount++;
      }
    }
  }

  let shiftEnd = shift.endMinutes;
  if (shiftEnd < shift.startMinutes) shiftEnd += 24 * 60;

  const spanMinutes = (sorted[sorted.length - 1] - sorted[0]) / 60000;
  const checkInMin = dhakaMinutes(checkIn.getTime());
  const checkOutMin = checkOut ? dhakaMinutes(checkOut.getTime()) : null;

  // The shift break (lunch, e.g. 60 min) is only counted when the employee
  // signed out after 4:00 PM — a partial day (leaving before 4 PM) should not
  // lose a full lunch break. Auto sign-outs count as a full day.
  const signedOutAfter4PM = autoCheckOut || (checkOutMin != null && checkOutMin > 16 * 60);
  const shiftBreakApplied = signedOutAfter4PM ? (shift.breakMinutes || 0) : 0;
  const netMinutes = Math.max(0, spanMinutes - breakMinutes - shiftBreakApplied);
  const workHours = Math.round((netMinutes / 60) * 100) / 100;

  const lateMinutes = checkInMin > shift.startMinutes ? checkInMin - shift.startMinutes : null;

  const earlyDepartureMinutes =
    !autoCheckOut && !openSinglePunch && checkOutMin != null && checkOutMin < shiftEnd
      ? shiftEnd - checkOutMin
      : null;

  // Regular OT only counts when the employee actually signed out after the
  // shift ended. Early arrival alone (leaving before shift end) earns no OT.
  const signedOutAfterShiftEnd = !autoCheckOut && !openSinglePunch && checkOutMin != null && checkOutMin > shiftEnd;
  const overtimeAfter = signedOutAfterShiftEnd ? Math.max(0, checkOutMin - shiftEnd) : 0;
  const overtimeHours = Math.round((overtimeAfter / 60) * 100) / 100;

  // Early-attendance OT: time punched before the shift start, capped at 10
  // minutes. Only credited when the shift was completed (signed out after end).
  const earlyArrivalMinutes = Math.max(0, shift.startMinutes - checkInMin);
  const earlyOvertimeMinutes = signedOutAfterShiftEnd ? Math.min(10, earlyArrivalMinutes) : 0;
  const earlyOvertimeHours = Math.round((earlyOvertimeMinutes / 60) * 100) / 100;

  const status =
    lateMinutes != null ? 'LATE' : earlyDepartureMinutes != null ? 'EARLY' : 'PRESENT';

  return {
    checkIn,
    checkOut,
    status,
    workHours,
    overtimeHours,
    earlyOvertimeHours,
    lateMinutes,
    earlyDepartureMinutes,
    breakMinutes,
    errandCount,
    punches: sorted,
    autoCheckOut
  };
};

const applySummaryToRecord = (record: any, summary: any) => {
  record.checkIn = summary.checkIn;
  record.checkOut = summary.checkOut;
  record.status = summary.status;
  record.workHours = summary.workHours;
  record.overtimeHours = summary.overtimeHours;
  record.earlyOvertimeHours = summary.earlyOvertimeHours;
  record.lateMinutes = summary.lateMinutes;
  record.earlyDepartureMinutes = summary.earlyDepartureMinutes;
  record.breakMinutes = summary.breakMinutes;
  record.errandCount = summary.errandCount;
  record.punches = summary.punches;
  record.autoCheckOut = summary.autoCheckOut;
  return record;
};

const resolveEmployee = async (userId: string) => {
  const uid = Number(userId);
  return prisma.employee.findFirst({
    where: {
      OR: [
        { employeeId: userId },
        { id: userId },
        ...(Number.isInteger(uid) && uid > 0 ? [{ deviceUid: uid } as any] : [])
      ]
    }
  });
};

const getShiftForEmployee = async (employeeId: string, date: Date): Promise<ShiftWindow> => {
  if (!hasShiftAssignments) return activeShift;
  try {
    const assignment = await prisma.shiftAssignment.findFirst({
      where: { employeeId, date },
      include: { shift: true }
    });
    if (assignment?.shift?.startTime && assignment?.shift?.endTime) {
      return {
        id: assignment.shift.id,
        name: assignment.shift.name,
        startMinutes: toMinutes(assignment.shift.startTime),
        endMinutes: toMinutes(assignment.shift.endTime),
        breakMinutes: assignment.shift.breakTime || 0
      };
    }
  } catch (error) {
    console.error('Failed to resolve employee shift assignment:', error);
  }
  return activeShift;
};

// Insert a punch (ms) into the employee's daily record and recompute the summary.
export const processPunch = async (userId: string, punchMs: number): Promise<any | null> => {
  try {
    const employee = await resolveEmployee(userId);
    if (!employee) {
      console.warn(`Employee not found for user ID: ${userId}`);
      return null;
    }

    // Co-founders / admin staff are exempt from punching attendance.
    if (employee.attendanceExempt) {
      console.log(`Employee ${employee.employeeId} is attendance-exempt; ignoring punch`);
      return null;
    }

    const { date, dayEnd, nowClosed } = getPunchDay(punchMs);

    // If an earlier day was left open (forgot to sign out) and its 04:00
    // rollover has passed, close it automatically before the new punch lands.
    if (nowClosed) {
      await autoSignOutIfNeeded(employee.id);
    }

    const shift = await getShiftForEmployee(employee.id, date);

    let record = await prisma.attendance.findFirst({
      where: { employeeId: employee.id, date }
    });

    const punchesMs = new Set<number>((record?.punches as number[]) || []);
    punchesMs.add(punchMs);
    const sorted = [...punchesMs].sort((a, b) => a - b);

    const summary = computeDailySummary(sorted, shift, dayEnd.getTime(), false);

    if (!summary) return null;

    const data = {
      employeeId: employee.id,
      checkIn: summary.checkIn,
      checkOut: summary.checkOut,
      date,
      status: summary.status as any,
      workHours: summary.workHours,
      overtimeHours: summary.overtimeHours,
      earlyOvertimeHours: summary.earlyOvertimeHours,
      lateMinutes: summary.lateMinutes,
      earlyDepartureMinutes: summary.earlyDepartureMinutes,
      breakMinutes: summary.breakMinutes,
      errandCount: summary.errandCount,
      punches: sorted,
      autoCheckOut: false,
      deviceId: process.env.ZKT_DEVICE_IP,
      deviceLogId: `${userId}-${punchMs}`
    };

    let isNew = false;
    if (!record) {
      isNew = true;
      record = await prisma.attendance.create({ data });
    } else {
      record = await prisma.attendance.update({
        where: { id: record.id },
        data: {
          checkIn: summary.checkIn,
          checkOut: summary.checkOut,
          status: summary.status as any,
          workHours: summary.workHours,
          overtimeHours: summary.overtimeHours,
          earlyOvertimeHours: summary.earlyOvertimeHours,
          lateMinutes: summary.lateMinutes,
          earlyDepartureMinutes: summary.earlyDepartureMinutes,
          breakMinutes: summary.breakMinutes,
          errandCount: summary.errandCount,
          punches: sorted,
          deviceLogId: data.deviceLogId
        }
      });
    }

    return { record, isNew };
  } catch (error) {
    console.error('Error processing punch:', error);
    return null;
  }
};

// Auto sign-out: close yesterday's open single-punch days at their 04:00 rollover.
export const autoSignOutIfNeeded = async (employeeId?: string) => {
  try {
    const todayStart = getPunchDay(Date.now()).date;
    const where: any = {
      autoCheckOut: { not: true },
      date: { lt: todayStart }
    };
    if (employeeId) where.employeeId = employeeId;

    const openRecords = await prisma.attendance.findMany({ where });
    let signedOut = 0;

    for (const rec of openRecords) {
      const punchesMs: number[] = (rec.punches as number[]) || [];
      if (punchesMs.length === 0) continue;

      // The record's day ends at 04:00 the next Dhaka day.
      const local = new Date(rec.date.getTime() + DHAKA_OFFSET_MS);
      const dayEnd = dhakaMidnight(local.getUTCFullYear(), local.getUTCMonth(), local.getUTCDate() + 1);

      // Only auto sign-out when there was exactly one punch (the sign-in).
      if (punchesMs.length === 1) {
        const shift = await getShiftForEmployee(rec.employeeId, rec.date);
        const summary = computeDailySummary(
          [...punchesMs, dayEnd.getTime()],
          shift,
          dayEnd.getTime(),
          true
        );
        if (summary) {
          await prisma.attendance.update({
            where: { id: rec.id },
            data: {
              checkIn: summary.checkIn,
              checkOut: summary.checkOut,
              status: summary.status as any,
              workHours: summary.workHours,
              overtimeHours: summary.overtimeHours,
              earlyOvertimeHours: summary.earlyOvertimeHours,
              lateMinutes: summary.lateMinutes,
              earlyDepartureMinutes: summary.earlyDepartureMinutes,
              breakMinutes: summary.breakMinutes,
              errandCount: summary.errandCount,
              punches: [...punchesMs, dayEnd.getTime()],
              autoCheckOut: true
            }
          });
          signedOut++;
        }
      }
    }

    if (signedOut > 0) console.log(`Auto signed out ${signedOut} open attendance record(s)`);
    return signedOut;
  } catch (error) {
    console.error('Auto sign-out error:', error);
    return 0;
  }
};

// Recompute every stored attendance record using the current shift + rules.
// Used to bring historical records in line after rule/config changes (e.g. OT
// only after shift end, early-attendance OT cap, paid lunch => breakTime 0).
export const recomputeAllAttendance = async (): Promise<{ total: number; updated: number }> => {
  await loadActiveShift();
  const records = await prisma.attendance.findMany({
    where: { employee: { attendanceExempt: false } },
    select: { id: true, employeeId: true, date: true, punches: true, autoCheckOut: true }
  });
  let updated = 0;
  for (const rec of records) {
    const punchesMs: number[] = (rec.punches as number[]) || [];
    if (punchesMs.length === 0) continue;
    const shift = await getShiftForEmployee(rec.employeeId, rec.date);
    const local = new Date(rec.date.getTime() + DHAKA_OFFSET_MS);
    const dayEnd = dhakaMidnight(local.getUTCFullYear(), local.getUTCMonth(), local.getUTCDate() + 1);
    const summary = computeDailySummary(punchesMs, shift, dayEnd.getTime(), Boolean(rec.autoCheckOut));
    if (!summary) continue;
    await prisma.attendance.update({
      where: { id: rec.id },
      data: {
        checkIn: summary.checkIn,
        checkOut: summary.checkOut,
        status: summary.status as any,
        workHours: summary.workHours,
        overtimeHours: summary.overtimeHours,
        earlyOvertimeHours: summary.earlyOvertimeHours,
        lateMinutes: summary.lateMinutes,
        earlyDepartureMinutes: summary.earlyDepartureMinutes,
        breakMinutes: summary.breakMinutes,
        errandCount: summary.errandCount,
        punches: summary.punches
      }
    });
    updated++;
  }
  return { total: records.length, updated };
};

// Clear attendance logs from the device once they are safely archived in the DB.
// ZKT devices only support clearing ALL attendance logs (no per-record delete), so
// this syncs first (DB is the archive) then clears the device, keeping it lean.
export const clearOldDeviceLogs = async () => {
  if (!zkClient || !isConnected) return { cleared: false, reason: 'not-connected' };
  try {
    // 1. Make sure the DB has the latest punches before anything is cleared
    const synced = await syncAttendanceNow();

    // 2. Clear all attendance logs on the device
    await zkClient.clearAttendanceLog();

    // 3. Verify the device now reports no attendance logs
    let logCounts = 0;
    try {
      const info = await zkClient.getInfo();
      logCounts = info?.logCounts || 0;
    } catch {
      logCounts = 0;
    }

    console.log(
      `Device attendance log cleared (retention ${DEVICE_LOG_RETENTION_DAYS} days). ` +
      `Device logCounts now: ${logCounts}. DB holds ${synced.imported} new + full archive.`
    );
    return { cleared: true, reason: 'cleared', logCounts };
  } catch (error: any) {
    console.error('Error clearing device attendance log:', error?.message || error);
    return { cleared: false, reason: error?.message || 'error' };
  }
};

// Check the ZKT device clock hourly and correct it to the server's Asia/Dhaka time
export const checkAndFixDeviceClock = async (retries = 3): Promise<void> => {
  if (!zkClient || !isConnected || isSyncing) return;
  try {
    const deviceTime = await zkClient.getTime();
    const serverTime = new Date();
    const diffSeconds = Math.round((serverTime.getTime() - deviceTime.getTime()) / 1000);

    if (Math.abs(diffSeconds) <= DEVICE_CLOCK_TOLERANCE_SECONDS) {
      console.log(`Device clock OK (drift ${diffSeconds}s)`);
      return;
    }

    console.log(
      `Device clock off by ${diffSeconds}s. Device: ${deviceTime.toString()} | Server (Asia/Dhaka): ${serverTime.toString()}. Setting device time...`
    );
    await zkClient.setTime(serverTime);
    const afterFix = await zkClient.getTime();
    console.log(`Device clock fixed. New device time: ${afterFix.toString()}`);
  } catch (error: any) {
    const isBusy = /busy/i.test(error?.message || String(error));
    if (isBusy && retries > 0) {
      console.warn(`Device busy, retrying clock check in 10s (${retries} retries left)...`);
      await new Promise((resolve) => setTimeout(resolve, 10000));
      return checkAndFixDeviceClock(retries - 1);
    }
    console.error('Error checking/fixing device clock:', error);
  }
};

// auth() is added by scripts/patch-zk-sdk.cjs (not in the upstream type defs)
interface ZKAuthable {
  auth(username: string, password: string): Promise<boolean>;
}

const authDevice = async (client: ZKAttendanceClient, username: string, password: string) => {
  return (client as unknown as ZKAuthable).auth(username, password);
};

// Initialize ZKT device connection
export const connectZKTDevice = async (io: Server) => {
  if (isConnecting) return;
  isConnecting = true;

  try {
    const deviceIp = process.env.ZKT_DEVICE_IP || '192.168.31.5';
    const devicePort = parseInt(process.env.ZKT_DEVICE_PORT || '4370', 10);
    const timeout = parseInt(process.env.ZKT_DEVICE_TIMEOUT || '5000', 10);
    const deviceUsername = process.env.ZKT_DEVICE_USERNAME || '';
    const devicePassword = process.env.ZKT_DEVICE_PASSWD || '';

    console.log(`Connecting to ZKT device at ${deviceIp}:${devicePort}...`);

    zkClient = new ZKAttendanceClient(deviceIp, devicePort, timeout);

    await zkClient.createSocket(
      (error) => {
        console.error('ZKT socket error:', error);
        isConnected = false;
        io.emit('device:status', { connected: false, message: 'Device error' });
      },
      () => {
        console.log('ZKT device disconnected');
        isConnected = false;
        io.emit('device:status', { connected: false, message: 'Device disconnected' });
        scheduleReconnect(io);
      }
    );

    if (devicePassword) {
      console.log('Authenticating with device credentials...');
      const authed = await authDevice(zkClient, deviceUsername, devicePassword);
      if (!authed) {
        throw new Error('Device rejected credentials (CMD_AUTH failed)');
      }
      console.log('Device authentication successful');
    }

    await zkClient.enableDevice();

    const rawSerial = await zkClient.getSerialNumber();
    const serial = Buffer.isBuffer(rawSerial)
      ? rawSerial.toString().replace(/\u0000/g, '').trim()
      : String(rawSerial).replace(/\u0000/g, '').trim();
    const deviceInfo = await zkClient.getInfo();

    isConnected = true;
    console.log(`Connected to ZKT device. Serial: ${serial}`);
    io.emit('device:status', { connected: true, message: 'Device connected' });

    await registerDeviceInDatabase(serial, deviceInfo);

    await loadActiveShift();

    setupRealTimeAttendance(io);
    setupPeriodicSync();

    // Check and correct the device clock to Asia/Dhaka on startup
    // (delayed so the device has settled after the real-time listener starts)
    setTimeout(() => {
      checkAndFixDeviceClock().catch((error: any) =>
        console.error('Initial device clock check failed:', error)
      );
    }, 15000);

    return zkClient;
  } catch (error) {
    console.error('Failed to connect to ZKT device:', error);
    isConnected = false;
    scheduleReconnect(io);
    throw error;
  } finally {
    isConnecting = false;
  }
};

// Test connection to a device
export const testConnection = async (
  ip: string,
  port: number = 4370,
  username?: string,
  password?: string
): Promise<boolean> => {
  const client = new ZKAttendanceClient(ip, port, 5000);
  try {
    await client.createSocket();
    if (password) {
      await authDevice(client, username || '', password);
    }
    await client.disconnect();
    return true;
  } catch (error) {
    return false;
  }
};

// Register device in database
const registerDeviceInDatabase = async (serial: string, deviceInfo: any) => {
  try {
    const deviceIp = process.env.ZKT_DEVICE_IP || '192.168.31.5';
    const devicePort = parseInt(process.env.ZKT_DEVICE_PORT || '4370', 10);
    const cleanSerial = String(serial || '').replace(/\u0000/g, '').trim();
    const deviceId = cleanSerial || `${deviceIp}:${devicePort}`;

    const existingDevice = await prisma.device.findUnique({
      where: { deviceId }
    });

    if (!existingDevice) {
      await prisma.device.create({
        data: {
          deviceId,
          name: `ZKT F22 Device ${deviceIp}`,
          ipAddress: deviceIp,
          port: devicePort,
          location: 'Main Office',
          description: `ZKT F22 Fingerprint Terminal - Serial: ${cleanSerial}`,
          isActive: true,
          totalUsers: deviceInfo.userCounts || 0,
          totalLogs: deviceInfo.logCounts || 0
        }
      });
      console.log('Device registered in database');
    } else {
      await prisma.device.update({
        where: { id: existingDevice.id },
        data: {
          isActive: true,
          lastSeen: new Date(),
          totalUsers: deviceInfo.userCounts || existingDevice.totalUsers,
          totalLogs: deviceInfo.logCounts || existingDevice.totalLogs
        }
      });
    }
  } catch (error) {
    console.error('Error registering device:', error);
  }
};

// Setup real-time attendance monitoring
const setupRealTimeAttendance = (io: Server) => {
  if (!zkClient) return;

  console.log('Setting up real-time attendance monitoring...');

  zkClient.getRealTimeLogs(async (log: any) => {
    try {
      console.log('Real-time attendance received:', log);

      const userId =
        log.userId?.toString() ||
        log.deviceUserId?.toString() ||
        log.uid?.toString();
      const timestamp = log.attTime || log.recordTime || new Date();
      const punchTime = new Date(timestamp).getTime();

      if (!userId) {
        console.warn('No user ID in attendance data:', log);
        return;
      }

      const result = await processPunch(userId, punchTime);

      if (result?.record) {
        const attendanceRecord = await prisma.attendance.findUnique({
          where: { id: result.record.id },
          include: {
            employee: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                employeeId: true,
                department: {
                  select: {
                    name: true
                  }
                }
              }
            }
          }
        });

        if (attendanceRecord) {
          io.emit('attendance:new', attendanceRecord);
          await sendAttendanceNotification(attendanceRecord);
        }
      }
    } catch (error) {
      console.error('Error processing real-time attendance:', error);
    }
  });
};

// Run one full attendance sync pass (shared by periodic sync and manual trigger)
export const syncAttendanceNow = async (): Promise<{ imported: number; total: number }> => {
  if (!zkClient || !isConnected) {
    throw new Error('ZKT device is not connected');
  }
  if (isSyncing) {
    throw new Error('Attendance sync is already running');
  }
  isSyncing = true;

  try {
    console.log('Starting attendance sync...');

    await loadActiveShift();

    // After a device log clear, the ATTLOG may be empty; a read then times out.
    // Guard with the device's reported attendance count so we skip the read gracefully.
    let size = 0;
    try {
      size = await zkClient.getAttendanceSize();
    } catch {
      size = -1; // unknown -> attempt the read anyway
    }
    if (size === 0) {
      console.log('Device reports 0 attendance logs; nothing to sync');
      return { imported: 0, total: 0 };
    }

    let attendances: any[] = [];
    try {
      const result = await zkClient.getAttendances();
      attendances = result?.data || [];
    } catch (error: any) {
      console.warn('Attendance read returned nothing (device empty or busy):', error?.message || error);
      return { imported: 0, total: 0 };
    }

    let imported = 0;
    if (attendances.length > 0) {
      console.log(`Found ${attendances.length} attendance logs from device`);

      for (const log of attendances) {
        const userId =
          log.userId?.toString() ||
          log.deviceUserId?.toString() ||
          log.uid?.toString();
        const timestamp = log.attTime || log.recordTime || new Date();
        const punchTime = new Date(timestamp).getTime();

        if (!userId) continue;

        const result = await processPunch(userId, punchTime);
        if (result?.isNew) imported++;
      }

      await prisma.device.updateMany({
        where: { isActive: true },
        data: { lastSeen: new Date() }
      });
    }

    // Close any open single-punch days whose 04:00 rollover has passed.
    const signedOut = await autoSignOutIfNeeded();

    return { imported, total: attendances.length };
  } catch (error) {
    console.error('Error during attendance sync:', error);
    throw error;
  } finally {
    isSyncing = false;
  }
};

// Setup periodic sync (fallback for missed real-time events)
const setupPeriodicSync = () => {
  // Sync every 5 minutes
  setInterval(() => {
    syncAttendanceNow().catch((error) => {
      console.warn('Periodic sync failed:', error?.message || error);
    });
  }, 5 * 60 * 1000); // 5 minutes

  // Check and correct the device clock every hour
  setInterval(() => {
    checkAndFixDeviceClock().catch((error: any) => {
      console.warn('Hourly device clock check failed:', error?.message || error);
    });
  }, DEVICE_CLOCK_CHECK_INTERVAL);

  // Auto sign-out: everyone who forgot to punch out gets signed out at 04:00.
  // Runs every 10 minutes plus once on startup.
  const runAutoSignOut = () => {
    autoSignOutIfNeeded().catch((error) => {
      console.warn('Auto sign-out run failed:', error?.message || error);
    });
  };
  setTimeout(runAutoSignOut, 20000);
  setInterval(runAutoSignOut, 10 * 60 * 1000);
};

// Send notification for attendance events
const sendAttendanceNotification = async (attendanceRecord: any) => {
  try {
    if (attendanceRecord.status === 'LATE' || attendanceRecord.status === 'EARLY') {
      await prisma.notification.create({
        data: {
          recipientId: attendanceRecord.employeeId,
          title: attendanceRecord.status === 'LATE' ? 'Late Arrival' : 'Early Departure',
          message:
            attendanceRecord.status === 'LATE'
              ? 'You arrived late today. Please check in with your supervisor.'
              : 'You departed early today. Please ensure this is approved.',
          type: 'WARNING',
          relatedId: attendanceRecord.id,
          relatedType: 'ATTENDANCE'
        }
      });
    }
  } catch (error) {
    console.error('Error sending attendance notification:', error);
  }
};

// Schedule reconnection attempts
const scheduleReconnect = (io: Server) => {
  setTimeout(() => {
    connectZKTDevice(io).catch((error) => {
      console.warn('ZKT reconnect attempt failed (will retry):', error?.message || error);
    });
  }, 30000);
};

// Get ZKT client instance
export const getZKTClient = (): ZKAttendanceClient | null => {
  return zkClient;
};

// Check if device is connected
export const isDeviceConnected = (): boolean => {
  return isConnected;
};

// Disconnect from device
export const disconnectZKTDevice = async () => {
  if (zkClient) {
    try {
      await zkClient.disconnect();
      isConnected = false;
      console.log('Disconnected from ZKT device');
    } catch (error) {
      console.error('Error disconnecting from ZKT device:', error);
    }
  }
};

// ---------------------------------------------------------------------------
// Device user management (create/update users + PIN, list, delete, fingerprint)
// ---------------------------------------------------------------------------

// Serialize device commands so the SDK's single TCP socket never runs two
// commands at once (the SDK raises [BUSY] if you fire while one is running).
let deviceOpChain: Promise<any> = Promise.resolve();
const withDeviceOp = <T>(fn: () => Promise<T>): Promise<T> => {
  const run = deviceOpChain.then(fn, fn);
  deviceOpChain = run.catch(() => undefined);
  return run;
};

const nextFreeDeviceUid = async (): Promise<number> => {
  const employees = await prisma.employee.findMany({
    where: { deviceUid: { not: null } },
    select: { deviceUid: true }
  });
  const used = new Set(employees.map((e) => e.deviceUid));
  for (let uid = 1; uid <= 3000; uid++) {
    if (!used.has(uid)) return uid;
  }
  return 3000;
};

const ensureConnected = () => {
  if (!zkClient || !isConnected) throw new Error('ZKT device is not connected');
  return zkClient;
};

/**
 * List users currently on the device.
 */
export const getDeviceUsers = async () => {
  return withDeviceOp(async () => {
    const client = ensureConnected();
    const result = await client.getUsers();
    const data = result?.data || [];
    return data.map((u: any) => ({
      uid: u.uid,
      userId: u.userId?.toString() || '',
      name: u.name || '',
      role: u.role,
      password: u.password || '',
      cardno: u.cardno
    }));
  });
};

/**
 * Create/update a user on the device via CMD_USER_WRQ. Sets User ID + PIN +
 * privilege. The device userId is set to the employee's employeeId so punches
 * resolve back to the right employee.
 */
export const pushUserToDevice = async (employee: any) => {
  return withDeviceOp(async () => {
    const client = ensureConnected();
    const userId = String(employee.employeeId || '').slice(0, 9);
    const name = `${employee.firstName || ''} ${employee.lastName || ''}`.trim().slice(0, 24);
    const pin = String(employee.pin || '').slice(0, 8);
    const role = 0; // normal user

    if (!userId) throw new Error('Employee needs an employee ID to be pushed to the device');
    if (!pin) throw new Error(`Employee ${userId} needs a PIN before being pushed to the device`);

    let uid = employee.deviceUid;
    if (!uid) {
      uid = await nextFreeDeviceUid();
      await prisma.employee.update({ where: { id: employee.id }, data: { deviceUid: uid } });
    }

    const ok = await client.setUser(uid, userId, name, pin, role, 0);
    if (ok === false) {
      throw new Error('Device rejected the user record (check ID/name/PIN length)');
    }
    return { uid, userId, name, pin, ok: true };
  });
};

/**
 * Push all ACTIVE employees to the device. Returns per-employee results.
 */
export const syncAllUsersToDevice = async () => {
  const employees = await prisma.employee.findMany({
    where: { status: 'ACTIVE' },
    orderBy: { createdAt: 'asc' }
  });
  const results: Array<{ employeeId: string; name: string; ok: boolean; error?: string }> = [];
  for (const emp of employees) {
    try {
      const pushed = await pushUserToDevice(emp);
      results.push({ employeeId: emp.employeeId, name: `${emp.firstName} ${emp.lastName}`, ok: true });
    } catch (error: any) {
      results.push({
        employeeId: emp.employeeId,
        name: `${emp.firstName} ${emp.lastName}`,
        ok: false,
        error: error?.message || 'Failed'
      });
    }
  }
  const okCount = results.filter((r) => r.ok).length;
  return { total: results.length, pushed: okCount, failed: results.length - okCount, results };
};

/**
 * Delete a user from the device by numeric uid.
 */
export const deleteDeviceUser = async (uid: number) => {
  return withDeviceOp(async () => {
    const client = ensureConnected();
    await client.deleteUser(uid);
    // If a local employee maps to this uid, clear the link so the next push
    // assigns a fresh uid instead of writing over someone else.
    await prisma.employee.updateMany({
      where: { deviceUid: uid },
      data: { deviceUid: null }
    });
    return { uid, deleted: true };
  });
};

/**
 * Fingerprint enrollment on the device.
 *
 * Flow: STARTENROLL -> CAPTUREFINGER (employee presses finger on the scanner)
 * -> the device replies with the captured template (CMD_USERTEMP_WRQ) -> we
 * echo that template back via CMD_USERTEMP_WRQ to save it to the user record.
 *
 * The employee must physically press a finger on the terminal within
 * `timeoutMs` of calling this endpoint.
 */
export const enrollFingerprint = async (employeeId: string, fingerIndex = 0, timeoutMs = 20000) => {
  return withDeviceOp(async () => {
    const client = ensureConnected();
    const employee = await prisma.employee.findUnique({ where: { id: employeeId } });
    if (!employee) throw new Error('Employee not found');

    let uid = employee.deviceUid;
    if (!uid) {
      uid = await nextFreeDeviceUid();
      await prisma.employee.update({ where: { id: employee.id }, data: { deviceUid: uid } });
      // Make sure the user exists on the device first (so the template can attach).
      const userId = String(employee.employeeId || '').slice(0, 9);
      const name = `${employee.firstName || ''} ${employee.lastName || ''}`.trim().slice(0, 24);
      const pin = String(employee.pin || '').slice(0, 8);
      if (!pin) throw new Error(`Employee ${userId} needs a PIN before enrollment`);
      await client.setUser(uid, userId, name, pin, 0, 0);
    }

    // 1. Begin enrollment for uid + finger index.
    const enrollPayload = Buffer.alloc(5);
    enrollPayload.writeUInt16LE(uid, 0);
    enrollPayload.writeUInt8(fingerIndex & 0xff, 2);
    enrollPayload.writeUInt16LE(0, 3); // flags: normal enroll
    await client.executeCmd(61, enrollPayload); // CMD_STARTENROLL

    // 2. Ask the device to capture. The employee must press a finger.
    const capture = await client.executeCmd(1009, Buffer.alloc(0)); // CMD_CAPTUREFINGER

    // 3. Parse the captured template payload (data after the 8-byte reply header).
    //    Format: [uid(2)][finger(1)][flag(1)][reserved(1)][checksum(1)] + template
    let templateData: Buffer = capture;
    if (capture.length >= 8) {
      const cmdId = capture.readUInt16LE(0);
      if (cmdId === 10) {
        templateData = capture.subarray(8); // CMD_USERTEMP_WRQ payload
      } else if (cmdId === 2001) {
        throw new Error('Device reported an error during fingerprint capture');
      }
    }
    if (templateData.length <= 6) {
      throw new Error('No fingerprint captured. Ask the employee to press their finger on the scanner.');
    }

    // 4. Save the template back to the user (echo what the device returned).
    const save = await client.executeCmd(10, templateData); // CMD_USERTEMP_WRQ
    const saveCmdId = save.length >= 2 ? save.readUInt16LE(0) : -1;
    if (saveCmdId === 2001 || saveCmdId === 65533) {
      throw new Error('Device rejected the fingerprint template');
    }

    return { uid, fingerIndex, saved: true, templateSize: templateData.length };
  });
};

// Cancel an in-progress capture (safety cleanup).
export const cancelCapture = async () => {
  return withDeviceOp(async () => {
    if (!zkClient || !isConnected) return { cancelled: false };
    await zkClient.executeCmd(62, Buffer.alloc(0)); // CMD_CANCELCAPTURE
    return { cancelled: true };
  });
};

// ---------------------------------------------------------------------------
// Manual attendance entry / adjustment
// ---------------------------------------------------------------------------

/**
 * Compute a daily attendance summary from an admin-provided date + punches.
 * Uses the active shift to derive work hours, overtime, lateness, status.
 * Returns the data payload for create/update (without employeeId).
 */
export const computeManualAttendance = async (
  dateStr: string,
  checkInISO?: string,
  checkOutISO?: string,
  breakMinutesInput = 0
): Promise<any> => {
  const [y, m, d] = dateStr.split('-').map(Number);
  if (!y || !m || !d) throw new Error('date must be YYYY-MM-DD');
  const date = dhakaMidnight(y, m - 1, d);

  const punchesMs: number[] = [];
  if (checkInISO) punchesMs.push(new Date(checkInISO).getTime());
  if (checkOutISO) punchesMs.push(new Date(checkOutISO).getTime());
  if (punchesMs.length === 0) throw new Error('Provide at least a sign-in time');

  const shift = activeShift;
  const dayEnd = dhakaMidnight(y, m - 1, d + 1);
  const summary = computeDailySummary(punchesMs, shift, dayEnd.getTime(), false);
  if (!summary) throw new Error('Unable to compute attendance for the given values');

  const breakMinutes = Math.max(0, parseInt(String(breakMinutesInput)) || 0);
  const spanMinutes = punchesMs.length >= 2 ? (punchesMs[punchesMs.length - 1] - punchesMs[0]) / 60000 : 0;
  const checkOutMin = summary.checkOut ? dhakaMinutes(summary.checkOut.getTime()) : null;
  const shiftBreakApplied = checkOutMin != null && checkOutMin > 16 * 60 ? (shift.breakMinutes || 0) : 0;
  const netMinutes = Math.max(0, spanMinutes - breakMinutes - shiftBreakApplied);
  const workHours = Math.round((netMinutes / 60) * 100) / 100;

  return {
    date,
    checkIn: summary.checkIn,
    checkOut: summary.checkOut,
    status: summary.status as any,
    workHours,
    overtimeHours: summary.overtimeHours,
    earlyOvertimeHours: summary.earlyOvertimeHours,
    lateMinutes: summary.lateMinutes,
    earlyDepartureMinutes: summary.earlyDepartureMinutes,
    breakMinutes,
    errandCount: breakMinutes > 0 ? 1 : 0,
    punches: punchesMs,
    autoCheckOut: false
  };
};

export default {
  connectZKTDevice,
  testConnection,
  getZKTClient,
  isDeviceConnected,
  disconnectZKTDevice,
  syncAttendanceNow,
  checkAndFixDeviceClock,
  clearOldDeviceLogs,
  processPunch,
  autoSignOutIfNeeded,
  getDeviceUsers,
  pushUserToDevice,
  syncAllUsersToDevice,
  deleteDeviceUser,
  enrollFingerprint,
  cancelCapture,
  computeManualAttendance
};
