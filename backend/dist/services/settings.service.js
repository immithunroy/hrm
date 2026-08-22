"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.updatePayrollSettings = exports.getPayrollSettings = void 0;
const database_1 = require("../config/database");
const DEFAULT_SETTINGS = {
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
const toNumber = (value, fallback) => {
    const n = parseFloat(value);
    return Number.isFinite(n) ? n : fallback;
};
const toMode = (value) => {
    return value === 'PERCENT' ? 'PERCENT' : 'DECIMAL';
};
const toErrandMode = (value) => {
    return value === 'DEDUCT_FROM_OT' ? 'DEDUCT_FROM_OT' : 'SKIP';
};
const toEarlyOvertimeMode = (value) => {
    return value === 'EXCLUDE' ? 'EXCLUDE' : 'INCLUDE';
};
// Convert a stored raw value to the effective multiplier used in payroll calc.
const toMultiplier = (raw, mode) => {
    if (mode === 'PERCENT')
        return raw / 100;
    return raw;
};
const getPayrollSettings = async () => {
    try {
        const rows = await database_1.prisma.systemSetting.findMany();
        const map = {};
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
            defaultWeeklyHoliday: map[KEYS.defaultWeeklyHoliday] || DEFAULT_SETTINGS.defaultWeeklyHoliday,
            currency: map[KEYS.currency] || DEFAULT_SETTINGS.currency,
            errandDeductionMode: toErrandMode(map[KEYS.errandDeductionMode]),
            earlyOvertimeMode: toEarlyOvertimeMode(map[KEYS.earlyOvertimeMode])
        };
    }
    catch (error) {
        console.error('Failed to load settings, using defaults:', error);
        return { ...DEFAULT_SETTINGS };
    }
};
exports.getPayrollSettings = getPayrollSettings;
const updatePayrollSettings = async (partial) => {
    const entries = [];
    if (partial.overtimeRate != null)
        entries.push([KEYS.overtimeRate, String(partial.overtimeRate)]);
    if (partial.overtimeRateMode != null)
        entries.push([KEYS.overtimeRateMode, String(partial.overtimeRateMode)]);
    if (partial.holidayOvertimeRate != null)
        entries.push([KEYS.holidayOvertimeRate, String(partial.holidayOvertimeRate)]);
    if (partial.holidayOvertimeRateMode != null)
        entries.push([KEYS.holidayOvertimeRateMode, String(partial.holidayOvertimeRateMode)]);
    if (partial.taxRate != null)
        entries.push([KEYS.taxRate, String(partial.taxRate)]);
    if (partial.workingDaysPerMonth != null)
        entries.push([KEYS.workingDaysPerMonth, String(partial.workingDaysPerMonth)]);
    if (partial.workingHoursPerDay != null)
        entries.push([KEYS.workingHoursPerDay, String(partial.workingHoursPerDay)]);
    if (partial.defaultWeeklyHoliday != null)
        entries.push([KEYS.defaultWeeklyHoliday, String(partial.defaultWeeklyHoliday)]);
    if (partial.currency != null)
        entries.push([KEYS.currency, String(partial.currency)]);
    if (partial.errandDeductionMode != null)
        entries.push([KEYS.errandDeductionMode, String(partial.errandDeductionMode)]);
    if (partial.earlyOvertimeMode != null)
        entries.push([KEYS.earlyOvertimeMode, String(partial.earlyOvertimeMode)]);
    for (const [key, value] of entries) {
        await database_1.prisma.systemSetting.upsert({
            where: { key },
            update: { value },
            create: { key, value }
        });
    }
    return (0, exports.getPayrollSettings)();
};
exports.updatePayrollSettings = updatePayrollSettings;
