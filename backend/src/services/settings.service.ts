/**
 * Payroll Settings Service
 *
 * Reads and writes company-wide payroll configuration stored in the
 * SystemSetting table (key/value pairs). All payroll calculation parameters
 * (OT rate, tax rate, working days, etc.) flow through this service.
 *
 * - getPayrollSettings – loads all settings with defaults, converting raw
 *   rate values to effective multipliers via toMultiplier()
 * - updatePayrollSettings – upserts only the fields that are provided
 *
 * RateMode (DECIMAL vs PERCENT) lets admins enter "1.5" or "150"; the
 * effective multiplier is always a decimal (1.5) regardless.
 */
import { prisma } from '../config/database';

export type RateMode = 'DECIMAL' | 'PERCENT';
export type ErrandDeductionMode = 'SKIP' | 'DEDUCT_FROM_OT';
export type EarlyOvertimeMode = 'INCLUDE' | 'EXCLUDE';

export interface PayrollSettings {
  overtimeRate: number; // effective multiplier used in payroll calc (e.g. 1.5)
  overtimeRateRaw: number; // value as entered by the user (e.g. 1.5 or 150)
  overtimeRateMode: RateMode; // DECIMAL = 1.5x, PERCENT = 150%
  holidayOvertimeRate: number; // effective multiplier on holidays / weekly holidays
  holidayOvertimeRateRaw: number;
  holidayOvertimeRateMode: RateMode;
  taxRate: number; // decimal, e.g. 0.10 = 10%
  workingDaysPerMonth: number; // used to derive the hourly rate
  workingHoursPerDay: number;
  defaultWeeklyHoliday: string; // 'FRIDAY' | 'SUNDAY' fallback for employees
  currency: string; // e.g. 'BDT' - shown on pay slips / money display
  errandDeductionMode: ErrandDeductionMode; // how errand time affects OT pay
  earlyOvertimeMode: EarlyOvertimeMode; // include early-attendance OT in payslip pay
}

const DEFAULT_SETTINGS: PayrollSettings = {
  overtimeRate: 1.5,
  overtimeRateRaw: 1.5,
  overtimeRateMode: 'DECIMAL',
  holidayOvertimeRate: 2.0,
  holidayOvertimeRateRaw: 2.0,
  holidayOvertimeRateMode: 'DECIMAL',
  taxRate: 0.1,
  workingDaysPerMonth: 26,
  workingHoursPerDay: 8,
  defaultWeeklyHoliday: 'FRIDAY',
  currency: 'BDT',
  errandDeductionMode: 'SKIP',
  earlyOvertimeMode: 'INCLUDE'
};

const KEYS = {
  overtimeRate: 'payroll.overtimeRate',
  overtimeRateMode: 'payroll.overtimeRateMode',
  holidayOvertimeRate: 'payroll.holidayOvertimeRate',
  holidayOvertimeRateMode: 'payroll.holidayOvertimeRateMode',
  taxRate: 'payroll.taxRate',
  workingDaysPerMonth: 'payroll.workingDaysPerMonth',
  workingHoursPerDay: 'payroll.workingHoursPerDay',
  defaultWeeklyHoliday: 'payroll.defaultWeeklyHoliday',
  currency: 'payroll.currency',
  errandDeductionMode: 'payroll.errandDeductionMode',
  earlyOvertimeMode: 'payroll.earlyOvertimeMode'
};

// Load all payroll settings from SystemSetting table, apply defaults for
// any missing keys, and convert raw rate values to effective multipliers.
const toNumber = (value: any, fallback: number): number => {
  const n = parseFloat(value);
  return Number.isFinite(n) ? n : fallback;
};

const toMode = (value: any): RateMode => {
  return value === 'PERCENT' ? 'PERCENT' : 'DECIMAL';
};

const toErrandMode = (value: any): ErrandDeductionMode => {
  return value === 'DEDUCT_FROM_OT' ? 'DEDUCT_FROM_OT' : 'SKIP';
};

const toEarlyOvertimeMode = (value: any): EarlyOvertimeMode => {
  return value === 'EXCLUDE' ? 'EXCLUDE' : 'INCLUDE';
};

// Convert a stored raw value to the effective multiplier used in payroll calc.
const toMultiplier = (raw: number, mode: RateMode): number => {
  if (mode === 'PERCENT') return raw / 100;
  return raw;
};

// Load all payroll settings from SystemSetting table, apply defaults for
// any missing keys, and convert raw rate values to effective multipliers.
export const getPayrollSettings = async (): Promise<PayrollSettings> => {
  try {
    const rows = await prisma.systemSetting.findMany();
    const map: Record<string, string> = {};
    rows.forEach((r) => {
      map[r.key] = r.value;
    });

    const overtimeRateRaw = toNumber(map[KEYS.overtimeRate], DEFAULT_SETTINGS.overtimeRateRaw);
    const overtimeRateMode = toMode(map[KEYS.overtimeRateMode]);
    const holidayOvertimeRateRaw = toNumber(map[KEYS.holidayOvertimeRate], DEFAULT_SETTINGS.holidayOvertimeRateRaw);
    const holidayOvertimeRateMode = toMode(map[KEYS.holidayOvertimeRateMode]);

    return {
      overtimeRate: toMultiplier(overtimeRateRaw, overtimeRateMode),
      overtimeRateRaw,
      overtimeRateMode,
      holidayOvertimeRate: toMultiplier(holidayOvertimeRateRaw, holidayOvertimeRateMode),
      holidayOvertimeRateRaw,
      holidayOvertimeRateMode,
      taxRate: toNumber(map[KEYS.taxRate], DEFAULT_SETTINGS.taxRate),
      workingDaysPerMonth: Math.round(toNumber(map[KEYS.workingDaysPerMonth], DEFAULT_SETTINGS.workingDaysPerMonth)),
      workingHoursPerDay: Math.round(toNumber(map[KEYS.workingHoursPerDay], DEFAULT_SETTINGS.workingHoursPerDay)),
      defaultWeeklyHoliday:
        map[KEYS.defaultWeeklyHoliday] || DEFAULT_SETTINGS.defaultWeeklyHoliday,
      currency: map[KEYS.currency] || DEFAULT_SETTINGS.currency,
      errandDeductionMode: toErrandMode(map[KEYS.errandDeductionMode]),
      earlyOvertimeMode: toEarlyOvertimeMode(map[KEYS.earlyOvertimeMode])
    };
  } catch (error) {
    console.error('Failed to load settings, using defaults:', error);
    return { ...DEFAULT_SETTINGS };
  }
};

// Upsert only the settings that were explicitly provided in `partial`.
// Converts each setting to its database key/value pair and upserts,
// then returns the fully resolved settings object.
export const updatePayrollSettings = async (
  partial: Partial<PayrollSettings>
): Promise<PayrollSettings> => {
  const entries: Array<[string, string]> = [];
  if (partial.overtimeRate != null) entries.push([KEYS.overtimeRate, String(partial.overtimeRate)]);
  if (partial.overtimeRateMode != null) entries.push([KEYS.overtimeRateMode, String(partial.overtimeRateMode)]);
  if (partial.holidayOvertimeRate != null) entries.push([KEYS.holidayOvertimeRate, String(partial.holidayOvertimeRate)]);
  if (partial.holidayOvertimeRateMode != null) entries.push([KEYS.holidayOvertimeRateMode, String(partial.holidayOvertimeRateMode)]);
  if (partial.taxRate != null) entries.push([KEYS.taxRate, String(partial.taxRate)]);
  if (partial.workingDaysPerMonth != null) entries.push([KEYS.workingDaysPerMonth, String(partial.workingDaysPerMonth)]);
  if (partial.workingHoursPerDay != null) entries.push([KEYS.workingHoursPerDay, String(partial.workingHoursPerDay)]);
  if (partial.defaultWeeklyHoliday != null) entries.push([KEYS.defaultWeeklyHoliday, String(partial.defaultWeeklyHoliday)]);
  if (partial.currency != null) entries.push([KEYS.currency, String(partial.currency)]);
  if (partial.errandDeductionMode != null) entries.push([KEYS.errandDeductionMode, String(partial.errandDeductionMode)]);
  if (partial.earlyOvertimeMode != null) entries.push([KEYS.earlyOvertimeMode, String(partial.earlyOvertimeMode)]);

  for (const [key, value] of entries) {
    await prisma.systemSetting.upsert({
      where: { key },
      update: { value },
      create: { key, value }
    });
  }

  return getPayrollSettings();
};