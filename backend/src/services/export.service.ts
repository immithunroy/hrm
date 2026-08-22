import ExcelJS from 'exceljs';
import PDFDocument from 'pdfkit';
import { prisma } from '../config/database';

const DHAKA_OFFSET_MS = 6 * 3600 * 1000;
const MONTH_NAMES = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

const fmtMonthLabel = (month: string): string => {
  const [y, m] = month.split('-').map(Number);
  return `${MONTH_NAMES[(m || 1) - 1]} ${y}`;
};
const DEFAULT_CASUAL_TOTAL = 10;
const DEFAULT_MEDICAL_TOTAL = 14;

export const fmtDhaka = (value: any, withSeconds = false) => {
  if (!value) return '—';
  const d = new Date(new Date(value).getTime() + DHAKA_OFFSET_MS);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}${withSeconds ? ':' + pad(d.getUTCSeconds()) : ''}`;
};

export const fmtDhakaDate = (value: any) => {
  if (!value) return '—';
  const d = new Date(new Date(value).getTime() + DHAKA_OFFSET_MS);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
};

const WEEKDAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const WEEKDAY_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

// Dhaka weekday name for a date (e.g. "Thursday").
export const fmtDhakaWeekday = (value: any) => {
  if (!value) return '—';
  const d = new Date(new Date(value).getTime() + DHAKA_OFFSET_MS);
  return WEEKDAY_NAMES[d.getUTCDay()];
};

export const fmtDhakaWeekdayShort = (value: any) => {
  if (!value) return '—';
  const d = new Date(new Date(value).getTime() + DHAKA_OFFSET_MS);
  return WEEKDAY_SHORT[d.getUTCDay()];
};

// Format a decimal number of hours as "Xh Ym" (no decimal time).
export const fmtHM = (hours: number | null | undefined) => {
  if (hours == null || Number.isNaN(Number(hours))) return '—';
  const totalMinutes = Math.round(Number(hours) * 60);
  const h = Math.floor(totalMinutes / 60);
  const m = totalMinutes % 60;
  if (h === 0 && m === 0) return '0m';
  if (h === 0) return `${m}m`;
  if (m === 0) return `${h}h`;
  return `${h}h ${m}m`;
};

// Human-readable labels for attendance status values.
export const ATTENDANCE_STATUS_LABELS: Record<string, string> = {
  PRESENT: 'PRESENT',
  LATE: 'LATE IN',
  EARLY: 'EARLY',
  ABSENT: 'ABSENT',
  LEAVE: 'LEAVE',
  HOLIDAY: 'HOLIDAY',
  HALF: 'HALF',
  WEEKEND: 'WEEKEND'
};

export const attendanceStatusLabel = (status: string): string =>
  ATTENDANCE_STATUS_LABELS[status] || status;

const fmtDateTime = (value: any) => {
  if (!value) return '—';
  const d = new Date(new Date(value).getTime() + DHAKA_OFFSET_MS);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())} ${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}`;
};

export const getLeaveSummary = async (employeeId: string, year: number) => {
  const where = {
    employeeId_year: { employeeId, year }
  };
  const balance =
    (await prisma.leaveBalance.findUnique({ where })) ||
    (await prisma.leaveBalance.upsert({
      where,
      update: {},
      create: {
        employeeId,
        year,
        casualTotal: DEFAULT_CASUAL_TOTAL,
        medicalTotal: DEFAULT_MEDICAL_TOTAL
      }
    }));

  const yearStart = new Date(Date.UTC(year, 0, 1) - DHAKA_OFFSET_MS);
  const yearEnd = new Date(Date.UTC(year + 1, 0, 1) - DHAKA_OFFSET_MS);

  const sumUsed = async (leaveType: string) => {
    const agg = await prisma.leaveRequest.aggregate({
      where: {
        employeeId,
        leaveType: leaveType as any,
        status: 'APPROVED',
        startDate: { gte: yearStart, lt: yearEnd }
      },
      _sum: { daysRequested: true }
    });
    return agg._sum.daysRequested || 0;
  };

  const casualUsed = await sumUsed('CASUAL');
  const medicalUsed = await sumUsed('MEDICAL');

  return {
    year,
    casualTotal: balance.casualTotal,
    casualUsed,
    casualRemaining: Math.max(0, balance.casualTotal - casualUsed),
    medicalTotal: balance.medicalTotal,
    medicalUsed,
    medicalRemaining: Math.max(0, balance.medicalTotal - medicalUsed)
  };
};

export interface AttendanceExportRow {
  employee: { 
    firstName: string; 
    lastName: string; 
    employeeId: string; 
    department?: { name?: string } | null;
    salary?: number | string;
  };
  date: Date;
  checkIn: Date | null;
  checkOut: Date | null;
  workHours: number | null;
  overtimeHours: number | null;
  earlyOvertimeHours?: number | null;
  lateMinutes: number | null;
  earlyDepartureMinutes: number | null;
  breakMinutes: number | null;
  errandCount: number | null;
  autoCheckOut: boolean | null;
  status: string;
}

export interface PayrollSettings {
  overtimeRate: number;
  holidayOvertimeRate: number;
  workingDaysPerMonth: number;
  workingHoursPerDay: number;
  currency: string;
}

const ATTENDANCE_HEADERS = [
  'Date',
  'Day',
  'In',
  'Out',
  'Errand',
  'Work',
  'Overtime',
  'Early OT',
  'Late (min)',
  'Status'
];

const groupByEmployee = (rows: AttendanceExportRow[]) => {
  const groups: { employee: AttendanceExportRow['employee'] | null; rows: AttendanceExportRow[] }[] = [];
  const index = new Map<string, number>();
  for (const r of rows) {
    const key = r.employee?.employeeId || '';
    let idx = index.get(key);
    if (idx == null) {
      groups.push({ employee: r.employee || null, rows: [] });
      idx = groups.length - 1;
      index.set(key, idx);
    }
    groups[idx].rows.push(r);
  }
  return groups.sort((a, b) => (a.employee?.employeeId || '').localeCompare(b.employee?.employeeId || ''));
};

const employeeSummary = (rows: AttendanceExportRow[]) => {
  let lateDays = 0;
  let totalLateMinutes = 0;
  let totalErrandMinutes = 0;
  let onTimeDays = 0;
  for (const r of rows) {
    if (r.status === 'LATE') lateDays += 1;
    totalLateMinutes += r.lateMinutes || 0;
    totalErrandMinutes += r.breakMinutes || 0;
    if (r.status === 'PRESENT') onTimeDays += 1;
  }
  return { lateDays, totalLateMinutes, totalErrandMinutes, onTimeDays };
};

export const buildAttendanceWorkbook = async (
  rows: AttendanceExportRow[],
  title: string,
  leaveByEmployee: Record<string, any>,
  payrollSettings?: PayrollSettings
): Promise<ExcelJS.Buffer> => {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'HRM & Payroll';
  workbook.created = new Date();

  const sheet = workbook.addWorksheet('Attendance');
  sheet.pageSetup = {
    orientation: 'portrait',
    paperSize: 9,
    fitToPage: true,
    fitToWidth: 1,
    fitToHeight: 0,
    margins: { left: 0.25, right: 0.25, top: 0.75, bottom: 0.25, header: 0.3, footer: 0.3 }
  };
  sheet.columns = [
    { width: 16 },  // Date - wider
    { width: 10 },  // Day
    { width: 10 },  // In
    { width: 10 },  // Out
    { width: 10 },  // Errand
    { width: 10 },  // Work
    { width: 10 },  // Overtime
    { width: 10 },  // Early OT
    { width: 10 },  // Late (min)
    { width: 18 }   // Status - wider
  ];

  const lastCol = String.fromCharCode(64 + ATTENDANCE_HEADERS.length);

  sheet.mergeCells(`A1:${lastCol}1`);
  sheet.getCell('A1').value = title;
  sheet.getCell('A1').font = { bold: true, size: 16 };
  sheet.getCell('A1').alignment = { horizontal: 'center' };
  sheet.mergeCells(`A2:${lastCol}2`);
  sheet.getCell('A2').value = `Generated: ${new Date().toLocaleString()}`;
  sheet.getCell('A2').alignment = { horizontal: 'center' };

  let row = 3;
  for (const g of groupByEmployee(rows)) {
    row += 1;
    const name = `${g.employee?.firstName || ''} ${g.employee?.lastName || ''}`.trim();
    const info = `Department: ${g.employee?.department?.name || ''}  |  ID: ${g.employee?.employeeId || ''}`;
    const salary = g.employee?.salary ? Number(g.employee.salary) : 0;

    sheet.mergeCells(`A${row}:${lastCol}${row}`);
    sheet.getCell(`A${row}`).value = name;
    sheet.getCell(`A${row}`).font = { bold: true, size: 13 };
    row += 1;
    sheet.mergeCells(`A${row}:${lastCol}${row}`);
    sheet.getCell(`A${row}`).value = info;
    row += 1;

    const s = employeeSummary(g.rows);
    sheet.mergeCells(`A${row}:${lastCol}${row}`);
    sheet.getCell(`A${row}`).value =
      `Late days: ${s.lateDays} | Total late minutes: ${s.totalLateMinutes} | On-time days: ${s.onTimeDays}`;
    sheet.getCell(`A${row}`).font = { bold: true };
    row += 1;

    // Payment info: daily basic, daily OT, hourly basic, hourly OT, holiday OT hourly
    if (payrollSettings) {
      const dailyBasic = salary / payrollSettings.workingDaysPerMonth;
      const hourlyBasic = dailyBasic / payrollSettings.workingHoursPerDay;
      const dailyOT = hourlyBasic * payrollSettings.overtimeRate * payrollSettings.workingHoursPerDay;
      const hourlyOT = hourlyBasic * payrollSettings.overtimeRate;
      const holidayHourlyOT = hourlyBasic * payrollSettings.holidayOvertimeRate;

      const currency = payrollSettings.currency || 'BDT';

      sheet.mergeCells(`A${row}:${lastCol}${row}`);
      sheet.getCell(`A${row}`).value =
        `Hourly Basic Rate: ${currency} ${hourlyBasic.toFixed(2)}  |  Hourly OT Rate: ${currency} ${hourlyOT.toFixed(2)}  |  Holiday OT Hourly Rate: ${currency} ${holidayHourlyOT.toFixed(2)}`;
      sheet.getCell(`A${row}`).font = { bold: true, size: 10 };
      row += 1;
    }

    const l = leaveByEmployee[g.employee?.employeeId || ''];
    if (l) {
      row += 1;
      sheet.mergeCells(`A${row}:${lastCol}${row}`);
      sheet.getCell(`A${row}`).value = 'Leave and Attendance Details';
      sheet.getCell(`A${row}`).font = { bold: true, size: 12 };
      row += 1;

      const leaveHeader = ['Casual Total', 'Casual Used', 'Casual Left', 'Medical Total', 'Medical Used', 'Medical Left'];
      const leaveRow = sheet.getRow(row);
      leaveHeader.forEach((h, i) => {
        const cell = leaveRow.getCell(i + 1);
        cell.value = h;
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1F4E78' } };
        cell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
        cell.alignment = { horizontal: 'center', wrapText: false };
      });
      row += 1;
      const valRow = sheet.getRow(row);
      [l.casualTotal, l.casualUsed, l.casualRemaining, l.medicalTotal, l.medicalUsed, l.medicalRemaining].forEach((v, i) => {
        valRow.getCell(i + 1).value = v;
        valRow.getCell(i + 1).alignment = { horizontal: 'center', wrapText: false };
      });
      row += 1;
    }

    const headerRow = sheet.getRow(row);
    ATTENDANCE_HEADERS.forEach((h, i) => {
      const cell = headerRow.getCell(i + 1);
      cell.value = h;
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1F4E78' } };
      cell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
      cell.alignment = { horizontal: 'center', wrapText: false };
    });
    row += 1;

    for (const r of g.rows) {
      const dataRow = sheet.getRow(row);
      [
        fmtDhakaDate(r.date),
        fmtDhakaWeekday(r.date),
        fmtDhaka(r.checkIn),
        fmtDhaka(r.checkOut),
        fmtHM((r.breakMinutes || 0) / 60),
        fmtHM(r.workHours),
        fmtHM(r.overtimeHours),
        fmtHM(r.earlyOvertimeHours),
        r.lateMinutes ?? '',
        attendanceStatusLabel(r.status || '')
      ].forEach((v, i) => {
        dataRow.getCell(i + 1).value = v;
        dataRow.getCell(i + 1).alignment = { horizontal: 'center', wrapText: false };
      });
      row += 1;
    }

    // Total row
    const sumErrand = g.rows.reduce((s, r) => s + (r.breakMinutes || 0) / 60, 0);
    const sumWork = g.rows.reduce((s, r) => s + (r.workHours || 0), 0);
    const sumOT = g.rows.reduce((s, r) => s + (r.overtimeHours || 0), 0);
    const sumEarlyOT = g.rows.reduce((s, r) => s + (r.earlyOvertimeHours || 0), 0);
    const sumLate = g.rows.reduce((s, r) => s + (r.lateMinutes || 0), 0);
    const totalRow = sheet.getRow(row);
    ['Total', '', '', '', fmtHM(sumErrand), fmtHM(sumWork), fmtHM(sumOT), fmtHM(sumEarlyOT), Math.round(sumLate), ''].forEach((v, i) => {
      const cell = totalRow.getCell(i + 1);
      cell.value = v;
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1F4E78' } };
      cell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
      cell.alignment = { horizontal: 'center', wrapText: false };
    });
  }

  return workbook.xlsx.writeBuffer();
};

export const buildAttendancePdf = (
  rows: AttendanceExportRow[],
  title: string,
  leaveByEmployee: Record<string, any>,
  payrollSettings?: PayrollSettings
): Promise<Buffer> => {
  return new Promise((resolve) => {
    // All margins narrow (28pt).
    const doc = new PDFDocument({ size: 'A4', layout: 'portrait', bufferPages: true, margins: { top: 28, left: 28, right: 28, bottom: 28 } });
    const chunks: Buffer[] = [];
    doc.on('data', (c: Buffer) => chunks.push(c));
    doc.on('end', () => resolve(Buffer.concat(chunks)));

    doc.lineGap(1);
    doc.fontSize(14).text(title, { align: 'center' });
    doc.moveDown(0.1);
    doc.fontSize(8).text(`Generated: ${new Date().toLocaleString()}`, { align: 'center' });
    doc.moveDown(0.3);

    const groups = groupByEmployee(rows);
    for (const g of groups) {
      const name = `${g.employee?.firstName || ''} ${g.employee?.lastName || ''}`.trim();
      const s = employeeSummary(g.rows);
      const salary = g.employee?.salary ? Number(g.employee.salary) : 0;

      // Employee block (name bold, dept + id below the generation date)
      if (doc.y > doc.page.height - doc.page.margins.bottom - 60) doc.addPage();
      doc.font('Helvetica-Bold').fontSize(12).text(name, { align: 'left' });
      doc.moveDown(0.1);
      doc.font('Helvetica').fontSize(9).text(
        `Department: ${g.employee?.department?.name || ''}  |  ID: ${g.employee?.employeeId || ''}`,
        { align: 'left' }
      );
      doc.moveDown(0.15);

      // Single-row summary: late days, total late minutes, total errand minutes, on-time days
      doc.font('Helvetica-Bold').fontSize(9).text(
        `Late days: ${s.lateDays}  |  Total late minutes: ${s.totalLateMinutes}  |  Total errand minutes: ${s.totalErrandMinutes}  |  On-time days: ${s.onTimeDays}`,
        { align: 'left' }
      );
      doc.font('Helvetica');
      doc.moveDown(0.15);

      // Payment rates: daily basic, daily OT, hourly basic, hourly OT, holiday OT hourly
      if (payrollSettings) {
        const dailyBasic = salary / payrollSettings.workingDaysPerMonth;
        const hourlyBasic = dailyBasic / payrollSettings.workingHoursPerDay;
        const dailyOT = hourlyBasic * payrollSettings.overtimeRate * payrollSettings.workingHoursPerDay;
        const hourlyOT = hourlyBasic * payrollSettings.overtimeRate;
        const holidayHourlyOT = hourlyBasic * payrollSettings.holidayOvertimeRate;

        const currency = payrollSettings.currency || 'BDT';
        
        doc.font('Helvetica-Bold').fontSize(9).text(
          `Hourly Basic Rate: ${currency} ${hourlyBasic.toFixed(2)}  |  Hourly OT Rate: ${currency} ${hourlyOT.toFixed(2)}  |  Holiday OT Hourly Rate: ${currency} ${holidayHourlyOT.toFixed(2)}`,
          { align: 'left' }
        );
        doc.font('Helvetica');
        doc.moveDown(0.15);
      }

      // Leave and Attendance Details table (full-length heading, no text wrap)
      const l = leaveByEmployee[g.employee?.employeeId || ''];
      if (l) {
        doc.font('Helvetica-Bold').fontSize(10).text('Leave and Attendance Details', { align: 'left' });
        doc.moveDown(0.1);
        const leaveTable: any[][] = [
          ['Casual Total', 'Casual Used', 'Casual Left', 'Medical Total', 'Medical Used', 'Medical Left'],
          [l.casualTotal, l.casualUsed, l.casualRemaining, l.medicalTotal, l.medicalUsed, l.medicalRemaining]
        ];
        // Full width table - distribute columns across page width
        const pageWidth = doc.page.width - doc.page.margins.left - doc.page.margins.right;
        const colWidth = pageWidth / 6;
        drawTable(doc, leaveTable, [colWidth, colWidth, colWidth, colWidth, colWidth, colWidth]);
        doc.moveDown(0.3);
      }

      // Attendance table (no employee id/name/dept columns) - full wide
      const table: any[][] = [ATTENDANCE_HEADERS];
      let sumErrand = 0;
      let sumWork = 0;
      let sumOT = 0;
      let sumEarlyOT = 0;
      let sumLate = 0;
      for (const r of g.rows) {
        sumErrand += (r.breakMinutes || 0) / 60;
        sumWork += r.workHours || 0;
        sumOT += r.overtimeHours || 0;
        sumEarlyOT += r.earlyOvertimeHours || 0;
        sumLate += r.lateMinutes || 0;
        table.push([
          fmtDhakaDate(r.date),
          fmtDhakaWeekdayShort(r.date),
          fmtDhaka(r.checkIn),
          fmtDhaka(r.checkOut),
          fmtHM((r.breakMinutes || 0) / 60),
          fmtHM(r.workHours),
          fmtHM(r.overtimeHours),
          fmtHM(r.earlyOvertimeHours),
          r.lateMinutes ?? '',
          attendanceStatusLabel(r.status || '')
        ]);
      }
      table.push([
        'Total', '', '', '',
        fmtHM(sumErrand),
        fmtHM(sumWork),
        fmtHM(sumOT),
        fmtHM(sumEarlyOT),
        Math.round(sumLate),
        ''
      ]);
      // Full width table - match Leave Summary table width (same page width)
      // Late (min) index 8 and Status index 9 get more width
      const pageWidth2 = doc.page.width - doc.page.margins.left - doc.page.margins.right;
      const numCols = ATTENDANCE_HEADERS.length; // 10
      // Give Late (min) 1.2x, Status 1.4x, Date 1.1x, others 0.9x
      const totalWeight = 1.1 + 0.9 + 0.9 + 0.9 + 0.9 + 0.9 + 0.9 + 0.9 + 1.2 + 1.4; // = 9.9
      const baseWidth = pageWidth2 / totalWeight;
      const widths = [
        baseWidth * 1.1,  // Date - slightly wider
        baseWidth * 0.9,  // Day
        baseWidth * 0.9,  // In
        baseWidth * 0.9,  // Out
        baseWidth * 0.9,  // Errand
        baseWidth * 0.9,  // Work
        baseWidth * 0.9,  // Overtime
        baseWidth * 0.9,  // Early OT
        baseWidth * 1.2,  // Late (min) - wider for title/data
        baseWidth * 1.4   // Status - wider for data
      ];
      drawTable(doc, table, widths, [0, table.length - 1]);
      doc.moveDown(0.3);
    }

    doc.end();
  });
};

const drawTable = (doc: PDFKit.PDFDocument, rows: any[][], widths: number[], headerRows?: number[]) => {
  const startX = doc.page.margins.left;
  let y = doc.y;
  const rowHeight = 18;
  const fontSize = 8;
  const headerSet = new Set(headerRows ?? [0]);

  const drawRow = (cells: any[], isHeader: boolean, yPos: number) => {
    let x = startX;
    doc.rect(startX, yPos, widths.reduce((a, b) => a + b, 0), rowHeight)
      .fill(isHeader ? '#1F4E78' : (yPos % (rowHeight * 2) === 0 ? '#F2F7FB' : '#FFFFFF'));
    cells.forEach((cell, i) => {
      doc.fillColor(isHeader ? '#FFFFFF' : '#000000')
        .font(isHeader ? 'Helvetica-Bold' : 'Helvetica')
        .fontSize(fontSize)
        .text(String(cell ?? ''), x + 3, yPos + 4, {
          width: widths[i] - 6,
          lineBreak: false
        });
      x += widths[i];
    });
  };

  for (let idx = 0; idx < rows.length; idx++) {
    if (y + rowHeight > doc.page.height - doc.page.margins.bottom) {
      doc.addPage();
      y = doc.page.margins.top;
    }
    drawRow(rows[idx], headerSet.has(idx), y);
    y += rowHeight;
  }
  doc.y = y + 6;
};

export interface PayslipData {
  employee: any;
  month: string;
  currency?: string; // e.g. 'BDT'
  attendanceRows: AttendanceExportRow[];
  totals: {
    totalDays: number;
    presentDays: number;
    lateCount: number;
    earlyCount: number;
    totalOvertimeHours: number;
    totalLateMinutes: number;
    regularOTHours?: number;
    holidayOTHours?: number;
    earlyOTHours?: number;
    errandMinutes?: number;
  };
  salary: {
    basic: number;
    overtimePay: number;
    bonus: number;
    deductions: number;
    tax: number;
    netPay: number;
    overtimeRate?: number;
    holidayOvertimeRate?: number;
    salaryType?: string;
    accommodation?: number;
    medical?: number;
    transport?: number;
    mobileInternet?: number;
    grossSalary?: number;
    accommodationRate?: number;
    medicalRate?: number;
    transportRate?: number;
  };
  errandDeduction?: {
    mode: string;
    deductedMinutes: number;
    currency?: string;
  };
  earlyOvertime?: {
    mode: string;
    hours: number;
    currency?: string;
  };
  leave: any;
  loanDeduction?: {
    amount: number;
    currency?: string;
  };
}

// Currency label used in PDF output (standard fonts only support Latin-1, so BDT is shown as text).
const currencyText = (currency?: string): string => {
  return currency && currency !== 'BDT' ? currency : 'BDT';
};

// Currency symbol used in Excel output (full Unicode supported).
const currencySym = (currency?: string): string => {
  return currency && currency !== 'BDT' ? `${currency} ` : '৳ ';
};

export const buildPayslipWorkbook = async (data: PayslipData): Promise<ExcelJS.Buffer> => {
  const wb = new ExcelJS.Workbook();
  wb.creator = 'HRM & Payroll';
  const cur = currencySym(data.currency);
  const gross = data.salary.basic + data.salary.overtimePay + data.salary.bonus;
  const deductionLabel = (data.loanDeduction?.amount ?? 0) > 0 ? 'Loan Deduction' : 'Other Deductions';

  // --- Sheet 1: Dual Payslip (Employee + Office) ---
  const sheet = wb.addWorksheet('Pay Slip');
  sheet.pageSetup = {
    orientation: 'portrait',
    paperSize: 9,
    fitToPage: true,
    fitToWidth: 1,
    fitToHeight: 0,
    margins: { left: 0.25, right: 0.25, top: 0.5, bottom: 0.5, header: 0.3, footer: 0.3 }
  };
  sheet.columns = [
    { width: 22 }, { width: 16 }, { width: 4 }, { width: 22 }, { width: 16 }
  ];

  const drawPayslipBlock = (startRow: number, label: string) => {
    let r = startRow;

    // Label
    sheet.mergeCells(`A${r}:E${r}`);
    sheet.getCell(`A${r}`).value = label;
    sheet.getCell(`A${r}`).font = { bold: true, size: 9, color: { argb: 'FF1F4E78' } };
    sheet.getCell(`A${r}`).alignment = { horizontal: 'center' };
    r++;

    // Title
    sheet.mergeCells(`A${r}:E${r}`);
    sheet.getCell(`A${r}`).value = `Pay Slip - ${fmtMonthLabel(data.month)}`;
    sheet.getCell(`A${r}`).font = { bold: true, size: 14 };
    sheet.getCell(`A${r}`).alignment = { horizontal: 'center' };
    r++;

    // Generation time
    sheet.mergeCells(`A${r}:E${r}`);
    sheet.getCell(`A${r}`).value = `Generated: ${new Date().toLocaleString()}`;
    sheet.getCell(`A${r}`).font = { size: 7, color: { argb: 'FF000000' } };
    sheet.getCell(`A${r}`).alignment = { horizontal: 'center' };
    r++;

    // Employee name — left-aligned, bold, bigger font
    sheet.mergeCells(`A${r}:E${r}`);
    sheet.getCell(`A${r}`).value = `${data.employee.firstName} ${data.employee.lastName}`;
    sheet.getCell(`A${r}`).font = { bold: true, size: 14 };
    sheet.getCell(`A${r}`).alignment = { horizontal: 'left' };
    r++;

    // Department & designation — left-aligned, bold
    sheet.mergeCells(`A${r}:E${r}`);
    sheet.getCell(`A${r}`).value = `${data.employee.department?.name || ''} | ${data.employee.position?.title || ''}`;
    sheet.getCell(`A${r}`).font = { bold: true, size: 10 };
    sheet.getCell(`A${r}`).alignment = { horizontal: 'left' };
    r++;

    // Employee ID
    sheet.mergeCells(`A${r}:E${r}`);
    sheet.getCell(`A${r}`).value = `ID: ${data.employee.employeeId}`;
    sheet.getCell(`A${r}`).font = { size: 9 };
    sheet.getCell(`A${r}`).alignment = { horizontal: 'left' };
    r++;

    // Attendance summary line
    sheet.mergeCells(`A${r}:E${r}`);
    sheet.getCell(`A${r}`).value = `Late days: ${data.totals.lateCount}  |  Total late minutes: ${data.totals.totalLateMinutes}  |  Total errand minutes: ${data.totals.errandMinutes ?? 0}  |  On-time days: ${data.totals.presentDays}`;
    sheet.getCell(`A${r}`).font = { bold: true, size: 9 };
    sheet.getCell(`A${r}`).alignment = { horizontal: 'left' };
    r++;

    // Payment rates line
    {
      const salary = data.salary.basic;
      const dailyBasic = salary / 26;
      const hourlyBasic = dailyBasic / 8;
      const hourlyOT = hourlyBasic * (data.salary.overtimeRate ?? 1.5);
      const holidayHourlyOT = hourlyBasic * (data.salary.holidayOvertimeRate ?? 2);
      sheet.mergeCells(`A${r}:E${r}`);
      sheet.getCell(`A${r}`).value = `Hourly Basic Rate: ${cur}${hourlyBasic.toFixed(2)}  |  Hourly OT Rate: ${cur}${hourlyOT.toFixed(2)}  |  Holiday OT Hourly Rate: ${cur}${holidayHourlyOT.toFixed(2)}`;
      sheet.getCell(`A${r}`).font = { bold: true, size: 9 };
      sheet.getCell(`A${r}`).alignment = { horizontal: 'left' };
      r++;
    }

    r++; // blank row

    // Earnings / Deductions header
    const hdrRow = sheet.getRow(r);
    ['Earnings', 'Amount', '', 'Deductions', 'Amount'].forEach((v, i) => {
      const cell = hdrRow.getCell(i + 1);
      cell.value = v;
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1F4E78' } };
      cell.font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 10 };
      cell.alignment = { horizontal: i % 2 === 0 ? 'left' : 'right', wrapText: false };
    });
    r++;

    // Dynamic earnings/deductions — always show base items, auto-adjust for extras
    const baseEarnings: [string, number][] = data.salary.salaryType === 'SCALED'
      ? [
          ['Basic Salary', data.salary.basic],
          [`Accommodation (${data.salary.accommodationRate}%)`, data.salary.accommodation || 0],
          [`Medical (${data.salary.medicalRate}%)`, data.salary.medical || 0],
          [`Transport (${data.salary.transportRate}%)`, data.salary.transport || 0],
          ['Mobile & Internet', data.salary.mobileInternet || 0],
          ['Overtime Pay', data.salary.overtimePay],
          ['Bonus', data.salary.bonus],
        ]
      : [
          ['Basic Salary', data.salary.basic],
          ['Overtime Pay', data.salary.overtimePay],
          ['Bonus', data.salary.bonus],
        ];
    const baseDeductions: [string, number][] = [
      ['Tax', data.salary.tax],
      [deductionLabel, data.salary.deductions],
    ];
    const maxRows = Math.max(baseEarnings.length, baseDeductions.length) + 1;

    for (let i = 0; i < maxRows; i++) {
      const row = sheet.getRow(r);
      if (i < baseEarnings.length) {
        row.getCell(1).value = baseEarnings[i][0];
        row.getCell(2).value = cur + Number(baseEarnings[i][1]).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
        row.getCell(2).alignment = { horizontal: 'right' };
      } else if (i === baseEarnings.length) {
        row.getCell(1).value = 'Gross Pay';
        row.getCell(1).font = { bold: true };
        row.getCell(2).value = cur + gross.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
        row.getCell(2).alignment = { horizontal: 'right' };
        row.getCell(2).font = { bold: true };
      }
      if (i < baseDeductions.length) {
        row.getCell(4).value = baseDeductions[i][0];
        row.getCell(5).value = '-' + cur + Number(baseDeductions[i][1]).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
        row.getCell(5).alignment = { horizontal: 'right' };
      } else if (i === baseDeductions.length) {
        row.getCell(4).value = 'Net Pay';
        row.getCell(4).font = { bold: true };
        row.getCell(5).value = cur + data.salary.netPay.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
        row.getCell(5).alignment = { horizontal: 'right' };
        row.getCell(5).font = { bold: true };
      }
      r++;
    }

    r++; // blank

    // Leave Summary
    sheet.mergeCells(`A${r}:E${r}`);
    sheet.getCell(`A${r}`).value = 'Leave Summary';
    sheet.getCell(`A${r}`).font = { bold: true, size: 10 };
    r++;

    const leaveHdr = sheet.getRow(r);
    ['Casual Total', 'Casual Used', 'Casual Left', 'Medical Total', 'Medical Used', 'Medical Left'].forEach((h, i) => {
      const cell = leaveHdr.getCell(i + 1);
      cell.value = h;
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1F4E78' } };
      cell.font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 8 };
      cell.alignment = { horizontal: 'center', wrapText: false };
    });
    r++;

    const leaveVal = sheet.getRow(r);
    [data.leave.casualTotal, data.leave.casualUsed, data.leave.casualRemaining, data.leave.medicalTotal, data.leave.medicalUsed, data.leave.medicalRemaining].forEach((v, i) => {
      const cell = leaveVal.getCell(i + 1);
      cell.value = v;
      cell.alignment = { horizontal: 'center', wrapText: false };
      cell.font = { size: 8 };
    });
    r++;

    r += 10; // 1 inch below for signature spacing

    // Signature lines
    sheet.mergeCells(`A${r}:B${r}`);
    sheet.getCell(`A${r}`).value = '________________________';
    sheet.getCell(`A${r}`).alignment = { horizontal: 'center' };
    sheet.mergeCells(`D${r}:E${r}`);
    sheet.getCell(`D${r}`).value = '________________________';
    sheet.getCell(`D${r}`).alignment = { horizontal: 'center' };
    r += 2; // gap between line and label
    sheet.mergeCells(`A${r}:B${r}`);
    sheet.getCell(`A${r}`).value = 'Employee Signature';
    sheet.getCell(`A${r}`).alignment = { horizontal: 'center' };
    sheet.getCell(`A${r}`).font = { size: 8 };
    sheet.mergeCells(`D${r}:E${r}`);
    sheet.getCell(`D${r}`).value = 'Authorized Signature';
    sheet.getCell(`D${r}`).alignment = { horizontal: 'center' };
    sheet.getCell(`D${r}`).font = { size: 8 };
    r++;

    return r;
  };

  let nextRow = 1;
  nextRow = drawPayslipBlock(nextRow, 'EMPLOYEE COPY');

  // Dashed separator row
  const sepRow = sheet.getRow(nextRow);
  for (let c = 1; c <= 5; c++) {
    sepRow.getCell(c).border = { bottom: { style: 'dashed', color: { argb: 'FF999999' } } };
  }
  nextRow++;

  nextRow = drawPayslipBlock(nextRow, 'OFFICE COPY');

  // --- Sheet 2: Attendance Report with total row ---
  const attSheet = wb.addWorksheet('Attendance Report');
  attSheet.pageSetup = {
    orientation: 'portrait',
    paperSize: 9,
    fitToPage: true,
    fitToWidth: 1,
    fitToHeight: 0,
    margins: { left: 0.25, right: 0.25, top: 0.5, bottom: 0.5, header: 0.3, footer: 0.3 }
  };
  attSheet.columns = [
    { width: 16 }, { width: 10 }, { width: 10 }, { width: 10 }, { width: 10 },
    { width: 10 }, { width: 10 }, { width: 10 }, { width: 10 }, { width: 18 }
  ];

  let ar = 1;
  attSheet.mergeCells(`A${ar}:J${ar}`);
  attSheet.getCell(`A${ar}`).value = `Attendance Report - ${fmtMonthLabel(data.month)}`;
  attSheet.getCell(`A${ar}`).font = { bold: true, size: 16 };
  attSheet.getCell(`A${ar}`).alignment = { horizontal: 'center' };
  ar++;

  attSheet.mergeCells(`A${ar}:J${ar}`);
  attSheet.getCell(`A${ar}`).value = `${data.employee.firstName} ${data.employee.lastName} (${data.employee.employeeId}) - ${data.employee.department?.name || ''}`;
  attSheet.getCell(`A${ar}`).alignment = { horizontal: 'center' };
  ar++;

  attSheet.mergeCells(`A${ar}:J${ar}`);
  attSheet.getCell(`A${ar}`).value = `Generated: ${new Date().toLocaleString()}`;
  attSheet.getCell(`A${ar}`).font = { size: 7, color: { argb: 'FF000000' } };
  attSheet.getCell(`A${ar}`).alignment = { horizontal: 'center' };
  ar++;

  attSheet.mergeCells(`A${ar}:J${ar}`);
  attSheet.getCell(`A${ar}`).value = `Late days: ${data.totals.lateCount}  |  Total late minutes: ${data.totals.totalLateMinutes}  |  Total errand minutes: ${data.totals.errandMinutes ?? 0}  |  On-time days: ${data.totals.presentDays}`;
  attSheet.getCell(`A${ar}`).font = { bold: true };
  ar++;

  // Payment rates: daily basic, daily OT, hourly basic, hourly OT, holiday OT hourly
  const salary = data.salary.basic;
  {
    const dailyBasic = salary / 26;
    const hourlyBasic = dailyBasic / 8;
    const dailyOT = hourlyBasic * (data.salary.overtimeRate ?? 1.5) * 8;
    const hourlyOT = hourlyBasic * (data.salary.overtimeRate ?? 1.5);
    const holidayHourlyOT = hourlyBasic * (data.salary.holidayOvertimeRate ?? 2);
    attSheet.mergeCells(`A${ar}:J${ar}`);
    attSheet.getCell(`A${ar}`).value = `Hourly Basic Rate: ${cur}${hourlyBasic.toFixed(2)}  |  Hourly OT Rate: ${cur}${hourlyOT.toFixed(2)}  |  Holiday OT Hourly Rate: ${cur}${holidayHourlyOT.toFixed(2)}`;
    attSheet.getCell(`A${ar}`).font = { bold: true };
    ar++;
  }

  ar++; // blank

  // Leave and Attendance Details
  attSheet.mergeCells(`A${ar}:J${ar}`);
  attSheet.getCell(`A${ar}`).value = 'Leave and Attendance Details';
  attSheet.getCell(`A${ar}`).font = { bold: true, size: 12 };
  ar++;

  const leaveHdrRow = attSheet.getRow(ar);
  ['Casual Total', 'Casual Used', 'Casual Left', 'Medical Total', 'Medical Used', 'Medical Left'].forEach((h, i) => {
    const cell = leaveHdrRow.getCell(i + 1);
    cell.value = h;
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1F4E78' } };
    cell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
    cell.alignment = { horizontal: 'center', wrapText: false };
  });
  ar++;

  const leaveValRow = attSheet.getRow(ar);
  [data.leave.casualTotal, data.leave.casualUsed, data.leave.casualRemaining, data.leave.medicalTotal, data.leave.medicalUsed, data.leave.medicalRemaining].forEach((v, i) => {
    leaveValRow.getCell(i + 1).value = v;
    leaveValRow.getCell(i + 1).alignment = { horizontal: 'center', wrapText: false };
  });
  ar++;

  ar++; // blank

  // Attendance header
  const attHeader = attSheet.getRow(ar);
  ATTENDANCE_HEADERS.forEach((h, i) => {
    const cell = attHeader.getCell(i + 1);
    cell.value = h;
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1F4E78' } };
    cell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
    cell.alignment = { horizontal: 'center', wrapText: false };
  });
  ar++;

  // Attendance rows
  let sumErrand = 0;
  let sumWork = 0;
  let sumOT = 0;
  let sumEarlyOT = 0;
  let sumLate = 0;
  for (const r of data.attendanceRows) {
    sumErrand += (r.breakMinutes || 0) / 60;
    sumWork += r.workHours || 0;
    sumOT += r.overtimeHours || 0;
    sumEarlyOT += r.earlyOvertimeHours || 0;
    sumLate += r.lateMinutes || 0;
    const dataRow = attSheet.getRow(ar);
    [
      fmtDhakaDate(r.date),
      fmtDhakaWeekdayShort(r.date),
      fmtDhaka(r.checkIn),
      fmtDhaka(r.checkOut),
      fmtHM((r.breakMinutes || 0) / 60),
      fmtHM(r.workHours),
      fmtHM(r.overtimeHours),
      fmtHM(r.earlyOvertimeHours),
      r.lateMinutes ?? '',
      attendanceStatusLabel(r.status || '')
    ].forEach((v, i) => {
      dataRow.getCell(i + 1).value = v;
      dataRow.getCell(i + 1).alignment = { horizontal: 'center', wrapText: false };
    });
    ar++;
  }

  // Total row
  const totalRow = attSheet.getRow(ar);
  ['Total', '', '', '', fmtHM(sumErrand), fmtHM(sumWork), fmtHM(sumOT), fmtHM(sumEarlyOT), Math.round(sumLate), ''].forEach((v, i) => {
    const cell = totalRow.getCell(i + 1);
    cell.value = v;
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1F4E78' } };
    cell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
    cell.alignment = { horizontal: 'center', wrapText: false };
  });

  return wb.xlsx.writeBuffer();
};

export const buildPayslipPdf = (data: PayslipData): Promise<Buffer> => {
  return new Promise((resolve) => {
    const doc = new PDFDocument({ size: 'A4', layout: 'portrait', bufferPages: true, margins: { top: 28, left: 28, right: 28, bottom: 28 } });
    const chunks: Buffer[] = [];
    doc.on('data', (c: Buffer) => chunks.push(c));
    doc.on('end', () => resolve(Buffer.concat(chunks)));

    const pageWidth = doc.page.width - doc.page.margins.left - doc.page.margins.right;
    const halfH = (doc.page.height - doc.page.margins.top - doc.page.margins.bottom) / 2;
    const cur = currencyText(data.currency);
    const gross = data.salary.basic + data.salary.overtimePay + data.salary.bonus;
    const deductionLabel = (data.loanDeduction?.amount ?? 0) > 0 ? 'Loan Deduction' : 'Other Deductions';

    // --- Helper: draw one compact payslip at a given Y offset ---
    const drawPayslip = (label: string, yStart: number) => {
      let y = yStart;
      const lx = doc.page.margins.left;
      const rx = doc.page.width - doc.page.margins.right;

      // Label (OFFICE COPY / EMPLOYEE COPY)
      doc.font('Helvetica-Bold').fontSize(9).fillColor('#1F4E78')
        .text(label, lx, y, { width: pageWidth, align: 'center' });
      y += 14;

      // Title
      doc.font('Helvetica-Bold').fontSize(16).fillColor('#000000')
        .text(`Pay Slip - ${fmtMonthLabel(data.month)}`, lx, y, { width: pageWidth, align: 'center' });
      y += 16;

      // Generation time
      doc.font('Helvetica').fontSize(7).fillColor('#000000')
        .text(`Generated: ${new Date().toLocaleString()}`, lx, y, { width: pageWidth, align: 'center' });
      y += 10;

      // Employee name — left-aligned, bold (like attendance report)
      doc.font('Helvetica-Bold').fontSize(12).fillColor('#000000')
        .text(`${data.employee.firstName} ${data.employee.lastName}`, lx, y, { width: pageWidth });
      y += 14;

      // Department & designation — left-aligned, bold
      doc.font('Helvetica-Bold').fontSize(10).fillColor('#000000')
        .text(`${data.employee.department?.name || ''} | ${data.employee.position?.title || ''}`, lx, y, { width: pageWidth });
      y += 12;

      // Employee ID
      doc.font('Helvetica').fontSize(8).fillColor('#000000')
        .text(`ID: ${data.employee.employeeId}`, lx, y, { width: pageWidth });
      y += 11;

      // Attendance summary line (same format as attendance report)
      doc.font('Helvetica-Bold').fontSize(8).fillColor('#000000')
        .text(
          `Late days: ${data.totals.lateCount}  |  Total late minutes: ${data.totals.totalLateMinutes}  |  Total errand minutes: ${data.totals.errandMinutes ?? 0}  |  On-time days: ${data.totals.presentDays}`,
          lx, y, { width: pageWidth }
        );
      y += 11;

      // Payment rates line (same as attendance report)
      {
        const salary = data.salary.basic;
        const dailyBasic = salary / 26;
        const hourlyBasic = dailyBasic / 8;
        const hourlyOT = hourlyBasic * (data.salary.overtimeRate ?? 1.5);
        const holidayHourlyOT = hourlyBasic * (data.salary.holidayOvertimeRate ?? 2);
        doc.font('Helvetica-Bold').fontSize(8)
          .text(
            `Hourly Basic Rate: ${cur} ${hourlyBasic.toFixed(2)}  |  Hourly OT Rate: ${cur} ${hourlyOT.toFixed(2)}  |  Holiday OT Hourly Rate: ${cur} ${holidayHourlyOT.toFixed(2)}`,
            lx, y, { width: pageWidth }
          );
        y += 13;
      }

      // --- Earnings & Deductions side by side ---
      const colW = pageWidth / 2;
      const headerH = 14;
      const rowH = 12;

      // Header row
      doc.rect(lx, y, pageWidth, headerH).fill('#1F4E78');
      doc.font('Helvetica-Bold').fontSize(8).fillColor('#FFFFFF');
      doc.text('Earnings', lx + 4, y + 3, { width: colW - 4 });
      doc.text('Amount', lx + colW - 60, y + 3, { width: 56, align: 'right' });
      doc.text('Deductions', lx + colW + 4, y + 3, { width: colW - 4 });
      doc.text('Amount', rx - 60, y + 3, { width: 56, align: 'right' });
      y += headerH;

      // Dynamic earnings/deductions — always show base items, auto-adjust for extras
      const baseEarnings: [string, number][] = data.salary.salaryType === 'SCALED'
        ? [
            ['Basic Salary', data.salary.basic],
            [`Accommodation (${data.salary.accommodationRate}%)`, data.salary.accommodation || 0],
            [`Medical (${data.salary.medicalRate}%)`, data.salary.medical || 0],
            [`Transport (${data.salary.transportRate}%)`, data.salary.transport || 0],
            ['Mobile & Internet', data.salary.mobileInternet || 0],
            ['Overtime Pay', data.salary.overtimePay],
            ['Bonus', data.salary.bonus],
          ]
        : [
            ['Basic Salary', data.salary.basic],
            ['Overtime Pay', data.salary.overtimePay],
            ['Bonus', data.salary.bonus],
          ];
      const baseDeductions: [string, number][] = [
        ['Tax', data.salary.tax],
        [deductionLabel, data.salary.deductions],
      ];

      const maxRows = Math.max(baseEarnings.length, baseDeductions.length) + 1; // +1 for gross/net
      for (let i = 0; i < maxRows; i++) {
        const bgColor = i % 2 === 0 ? '#F2F7FB' : '#FFFFFF';
        doc.rect(lx, y, pageWidth, rowH).fill(bgColor);
        doc.font('Helvetica').fontSize(8).fillColor('#000000');

        // Earnings side
        if (i < baseEarnings.length) {
          doc.text(String(baseEarnings[i][0]), lx + 4, y + 3, { width: colW - 64 });
          doc.text(Number(baseEarnings[i][1]).toFixed(2), lx + colW - 60, y + 3, { width: 56, align: 'right' });
        } else if (i === baseEarnings.length) {
          doc.font('Helvetica-Bold').text('Gross Pay', lx + 4, y + 3, { width: colW - 64 });
          doc.text(gross.toFixed(2), lx + colW - 60, y + 3, { width: 56, align: 'right' });
        }

        // Deductions side
        if (i < baseDeductions.length) {
          doc.font('Helvetica').text(String(baseDeductions[i][0]), lx + colW + 4, y + 3, { width: colW - 64 });
          doc.text('-' + Number(baseDeductions[i][1]).toFixed(2), rx - 60, y + 3, { width: 56, align: 'right' });
        } else if (i === baseDeductions.length) {
          doc.font('Helvetica-Bold').text('Net Pay', lx + colW + 4, y + 3, { width: colW - 64 });
          doc.text(data.salary.netPay.toFixed(2), rx - 60, y + 3, { width: 56, align: 'right' });
        }
        y += rowH;
      }

      // Divider
      doc.rect(lx, y, pageWidth, 1).fill('#1F4E78');
      y += 6;

      // Leave summary (compact)
      doc.font('Helvetica-Bold').fontSize(8).fillColor('#000000')
        .text('Leave Summary', lx, y, { width: pageWidth });
      y += 11;

      const leaveHeaders = ['Casual Total', 'Casual Used', 'Casual Left', 'Medical Total', 'Medical Used', 'Medical Left'];
      const leaveVals = [data.leave.casualTotal, data.leave.casualUsed, data.leave.casualRemaining, data.leave.medicalTotal, data.leave.medicalUsed, data.leave.medicalRemaining];
      const lColW = pageWidth / 6;

      doc.rect(lx, y, pageWidth, 12).fill('#1F4E78');
      doc.font('Helvetica-Bold').fontSize(7).fillColor('#FFFFFF');
      leaveHeaders.forEach((h, i) => {
        doc.text(h, lx + i * lColW + 2, y + 3, { width: lColW - 4, align: 'center' });
      });
      y += 12;

      doc.rect(lx, y, pageWidth, 12).fill('#F2F7FB');
      doc.font('Helvetica').fontSize(7).fillColor('#000000');
      leaveVals.forEach((v, i) => {
        doc.text(String(v), lx + i * lColW + 2, y + 3, { width: lColW - 4, align: 'center' });
      });
      y += 16;

      // Signature lines (1 inch below current position)
      doc.font('Helvetica').fontSize(7).fillColor('#000000');
      const sigY = y + 88;
      doc.text('________________________', lx, sigY, { width: colW, align: 'center' });
      doc.text('Employee Signature', lx, sigY + 14, { width: colW, align: 'center' });
      doc.text('________________________', lx + colW, sigY, { width: colW, align: 'center' });
      doc.text('Authorized Signature', lx + colW, sigY + 14, { width: colW, align: 'center' });
    };

    // --- Page 1: Employee Copy (top), Office Copy (bottom) ---
    drawPayslip('EMPLOYEE COPY', doc.page.margins.top);
    // Dashed separator line
    const sepY = doc.page.margins.top + halfH;
    doc.save();
    doc.moveTo(doc.page.margins.left, sepY)
      .lineTo(doc.page.width - doc.page.margins.right, sepY)
      .dash(3, { space: 3 })
      .lineWidth(0.5)
      .stroke('#999999');
    doc.restore();
    drawPayslip('OFFICE COPY', sepY + doc.page.margins.top);

    // --- Page 2: Attendance report (exact copy of attendance export) ---
    doc.addPage();
    doc.font('Helvetica-Bold').fontSize(16).fillColor('#000000')
      .text(`Attendance Report - ${fmtMonthLabel(data.month)}`, doc.page.margins.left, doc.page.margins.top, { width: pageWidth, align: 'center' });
    doc.moveDown(0.2);
    doc.font('Helvetica').fontSize(9)
      .text(`${data.employee.firstName} ${data.employee.lastName} (${data.employee.employeeId}) - ${data.employee.department?.name || ''}`, { align: 'center' });
    doc.moveDown(0.1);
    doc.font('Helvetica').fontSize(7).fillColor('#000000')
      .text(`Generated: ${new Date().toLocaleString()}`, { align: 'center' });
    doc.moveDown(0.3);

    // Summary line
    doc.font('Helvetica-Bold').fontSize(9).text(
      `Late days: ${data.totals.lateCount}  |  Total late minutes: ${data.totals.totalLateMinutes}  |  Total errand minutes: ${data.totals.errandMinutes ?? 0}  |  On-time days: ${data.totals.presentDays}`,
      { align: 'left' }
    );
    doc.moveDown(0.3);

    // Payment rates
    {
      const salary = data.salary.basic;
      const dailyBasic = salary / 26;
      const hourlyBasic = dailyBasic / 8;
      const hourlyOT = hourlyBasic * (data.salary.overtimeRate ?? 1.5);
      const holidayHourlyOT = hourlyBasic * (data.salary.holidayOvertimeRate ?? 2);
      doc.font('Helvetica-Bold').fontSize(9).text(
        `Hourly Basic Rate: ${cur} ${hourlyBasic.toFixed(2)}  |  Hourly OT Rate: ${cur} ${hourlyOT.toFixed(2)}  |  Holiday OT Hourly Rate: ${cur} ${holidayHourlyOT.toFixed(2)}`,
        { align: 'left' }
      );
      doc.moveDown(0.3);
    }

    // Leave and Attendance Details
    doc.font('Helvetica-Bold').fontSize(11).text('Leave and Attendance Details', { align: 'left' });
    doc.moveDown(0.2);
    const leaveTable: any[][] = [
      ['Casual Total', 'Casual Used', 'Casual Left', 'Medical Total', 'Medical Used', 'Medical Left'],
      [data.leave.casualTotal, data.leave.casualUsed, data.leave.casualRemaining, data.leave.medicalTotal, data.leave.medicalUsed, data.leave.medicalRemaining]
    ];
    const colW6 = pageWidth / 6;
    drawTable(doc, leaveTable, [colW6, colW6, colW6, colW6, colW6, colW6]);
    doc.moveDown(0.5);

    // Attendance table with total row
    const attTable: any[][] = [ATTENDANCE_HEADERS];
    let sumErrand = 0;
    let sumWork = 0;
    let sumOT = 0;
    let sumEarlyOT = 0;
    let sumLate = 0;
    for (const r of data.attendanceRows) {
      sumErrand += (r.breakMinutes || 0) / 60;
      sumWork += r.workHours || 0;
      sumOT += r.overtimeHours || 0;
      sumEarlyOT += r.earlyOvertimeHours || 0;
      sumLate += r.lateMinutes || 0;
      attTable.push([
        fmtDhakaDate(r.date),
        fmtDhakaWeekdayShort(r.date),
        fmtDhaka(r.checkIn),
        fmtDhaka(r.checkOut),
        fmtHM((r.breakMinutes || 0) / 60),
        fmtHM(r.workHours),
        fmtHM(r.overtimeHours),
        fmtHM(r.earlyOvertimeHours),
        r.lateMinutes ?? '',
        attendanceStatusLabel(r.status || '')
      ]);
    }
    attTable.push([
      'Total', '', '', '',
      fmtHM(sumErrand),
      fmtHM(sumWork),
      fmtHM(sumOT),
      fmtHM(sumEarlyOT),
      Math.round(sumLate),
      ''
    ]);
    const totalWeight = 1.1 + 0.9 + 0.9 + 0.9 + 0.9 + 0.9 + 0.9 + 0.9 + 1.2 + 1.4;
    const baseW = pageWidth / totalWeight;
    const widths = [baseW * 1.1, baseW * 0.9, baseW * 0.9, baseW * 0.9, baseW * 0.9, baseW * 0.9, baseW * 0.9, baseW * 0.9, baseW * 1.2, baseW * 1.4];
    drawTable(doc, attTable, widths, [0, attTable.length - 1]);

    doc.end();
  });
};

export const round2 = (n: number) => Math.round(n * 100) / 100;