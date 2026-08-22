import { buildAttendanceWorkbook, buildAttendancePdf, AttendanceExportRow } from '../src/services/export.service';
import * as fs from 'fs';
import * as path from 'path';

const rows: AttendanceExportRow[] = [
  {
    employee: { firstName: 'Pritom', lastName: 'Paul', employeeId: '107', department: { name: 'Accounts' } },
    date: new Date('2026-08-01'),
    checkIn: new Date('2026-08-01T01:00:00Z'),
    checkOut: new Date('2026-08-01T09:00:00Z'),
    workHours: 8, overtimeHours: 0, earlyOvertimeHours: 0, lateMinutes: 15, earlyDepartureMinutes: 0,
    breakMinutes: 30, errandCount: 1, autoCheckOut: false, status: 'LATE'
  },
  {
    employee: { firstName: 'Pritom', lastName: 'Paul', employeeId: '107', department: { name: 'Accounts' } },
    date: new Date('2026-08-02'),
    checkIn: new Date('2026-08-02T00:30:00Z'),
    checkOut: new Date('2026-08-02T08:30:00Z'),
    workHours: 8, overtimeHours: 1, earlyOvertimeHours: 0, lateMinutes: 0, earlyDepartureMinutes: 0,
    breakMinutes: 0, errandCount: 0, autoCheckOut: false, status: 'PRESENT'
  },
  {
    employee: { firstName: 'Hriday', lastName: 'Das', employeeId: '104', department: { name: 'Engineering' } },
    date: new Date('2026-08-03'),
    checkIn: null, checkOut: null,
    workHours: 0, overtimeHours: 0, earlyOvertimeHours: 0, lateMinutes: 0, earlyDepartureMinutes: 0,
    breakMinutes: 0, errandCount: 0, autoCheckOut: false, status: 'WEEKEND'
  }
];

const leave = {
  '107': { year: 2026, casualTotal: 10, casualUsed: 2, casualRemaining: 8, medicalTotal: 14, medicalUsed: 1, medicalRemaining: 13 },
  '104': { year: 2026, casualTotal: 10, casualUsed: 0, casualRemaining: 10, medicalTotal: 14, medicalUsed: 0, medicalRemaining: 14 }
};

(async () => {
  const title = 'Attendance Report (2026-08-01 - 2026-08-31)';
  const wb: any = await buildAttendanceWorkbook(rows, title, leave);
  fs.writeFileSync(path.join(__dirname, '..', 'test-attendance.xlsx'), wb);
  const pdf: any = await buildAttendancePdf(rows, title, leave);
  fs.writeFileSync(path.join(__dirname, '..', 'test-attendance.pdf'), pdf);
  console.log('written', wb.length, pdf.length);
})();