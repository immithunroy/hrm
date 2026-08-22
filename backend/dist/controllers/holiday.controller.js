"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.syncGoogleHolidays = exports.deleteHoliday = exports.updateHoliday = exports.bulkCreateHolidays = exports.createHoliday = exports.getHolidays = void 0;
const database_1 = require("../config/database");
const appError_1 = require("../utils/appError");
const holiday_service_1 = require("../services/holiday.service");
/**
 * GET /api/holidays?year=2026&month=8  (defaults to current month)
 */
const getHolidays = async (req, res, next) => {
    try {
        const now = new Date(Date.now() + 6 * 3600 * 1000);
        const year = parseInt(req.query.year) || now.getUTCFullYear();
        const month = parseInt(req.query.month) || now.getUTCMonth() + 1;
        const holidays = await (0, holiday_service_1.getHolidaysForMonth)(year, month);
        res.status(200).json({ success: true, data: { year, month, holidays } });
    }
    catch (error) {
        next(error);
    }
};
exports.getHolidays = getHolidays;
/**
 * POST /api/holidays  body: { date: 'YYYY-MM-DD', name: string }
 * Create one holiday.
 */
const createHoliday = async (req, res, next) => {
    try {
        const { date, name } = req.body;
        if (!date || !name)
            return next(new appError_1.AppError('date and name are required', 400));
        const dayStart = (0, holiday_service_1.dhakaDayStart)(date);
        const existing = await database_1.prisma.holiday.findUnique({ where: { date: dayStart } });
        if (existing)
            return next(new appError_1.AppError('A holiday already exists on this date', 400));
        const holiday = await database_1.prisma.holiday.create({
            data: {
                date: dayStart,
                name,
                year: dayStart.getUTCFullYear(),
                month: dayStart.getUTCMonth() + 1
            }
        });
        res.status(201).json({ success: true, data: holiday });
    }
    catch (error) {
        next(error);
    }
};
exports.createHoliday = createHoliday;
/**
 * POST /api/holidays/bulk  body: { holidays: [{ date: 'YYYY-MM-DD', name: string }, ...] }
 * Upload many holidays at once (per-month upload).
 */
const bulkCreateHolidays = async (req, res, next) => {
    try {
        const items = req.body?.holidays || req.body?.items;
        if (!Array.isArray(items) || items.length === 0) {
            return next(new appError_1.AppError('holidays array is required', 400));
        }
        const valid = items.filter((it) => it?.date && it?.name);
        if (valid.length === 0)
            return next(new appError_1.AppError('No valid holiday entries provided', 400));
        let created = 0;
        let skipped = 0;
        for (const it of valid) {
            const dayStart = (0, holiday_service_1.dhakaDayStart)(String(it.date));
            const existing = await database_1.prisma.holiday.findUnique({ where: { date: dayStart } });
            if (existing) {
                skipped++;
                continue;
            }
            await database_1.prisma.holiday.create({
                data: {
                    date: dayStart,
                    name: String(it.name),
                    year: dayStart.getUTCFullYear(),
                    month: dayStart.getUTCMonth() + 1
                }
            });
            created++;
        }
        res.status(201).json({
            success: true,
            data: { created, skipped, total: valid.length }
        });
    }
    catch (error) {
        next(error);
    }
};
exports.bulkCreateHolidays = bulkCreateHolidays;
/**
 * PUT /api/holidays/:id  body: { date?, name? }
 */
const updateHoliday = async (req, res, next) => {
    try {
        const { id } = req.params;
        const holiday = await database_1.prisma.holiday.findUnique({ where: { id } });
        if (!holiday)
            return next(new appError_1.AppError('Holiday not found', 404));
        const data = {};
        if (req.body.name != null)
            data.name = String(req.body.name);
        if (req.body.date != null) {
            const dayStart = (0, holiday_service_1.dhakaDayStart)(String(req.body.date));
            const dup = await database_1.prisma.holiday.findUnique({ where: { date: dayStart } });
            if (dup && dup.id !== id)
                return next(new appError_1.AppError('A holiday already exists on this date', 400));
            data.date = dayStart;
            data.year = dayStart.getUTCFullYear();
            data.month = dayStart.getUTCMonth() + 1;
        }
        const updated = await database_1.prisma.holiday.update({ where: { id }, data });
        res.status(200).json({ success: true, data: updated });
    }
    catch (error) {
        next(error);
    }
};
exports.updateHoliday = updateHoliday;
/**
 * DELETE /api/holidays/:id
 */
const deleteHoliday = async (req, res, next) => {
    try {
        const { id } = req.params;
        const holiday = await database_1.prisma.holiday.findUnique({ where: { id } });
        if (!holiday)
            return next(new appError_1.AppError('Holiday not found', 404));
        await database_1.prisma.holiday.delete({ where: { id } });
        res.status(200).json({ success: true, message: 'Holiday deleted' });
    }
    catch (error) {
        next(error);
    }
};
exports.deleteHoliday = deleteHoliday;
/**
 * POST /api/holidays/sync-google
 * Import the Bangladesh government office holidays calendar (idempotent upsert).
 */
const syncGoogleHolidays = async (req, res, next) => {
    try {
        const result = await (0, holiday_service_1.syncGoogleBangladeshHolidays)();
        res.status(201).json({
            success: true,
            message: `Synced ${result.created} government holidays (${result.total} in feed, ${result.skipped} skipped, ${result.removed} non-government removed)`,
            data: result
        });
    }
    catch (error) {
        next(error);
    }
};
exports.syncGoogleHolidays = syncGoogleHolidays;
exports.default = {
    getHolidays: exports.getHolidays,
    createHoliday: exports.createHoliday,
    bulkCreateHolidays: exports.bulkCreateHolidays,
    updateHoliday: exports.updateHoliday,
    deleteHoliday: exports.deleteHoliday,
    syncGoogleHolidays: exports.syncGoogleHolidays
};
