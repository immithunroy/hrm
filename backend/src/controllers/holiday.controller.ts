import { Request, Response, NextFunction } from 'express';
import { prisma } from '../config/database';
import { AppError } from '../utils/appError';
import { dhakaDayStart, dhakaDayString, getHolidaysForMonth, syncGoogleBangladeshHolidays } from '../services/holiday.service';

/**
 * GET /api/holidays?year=2026&month=8  (defaults to current month)
 */
export const getHolidays = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const now = new Date(Date.now() + 6 * 3600 * 1000);
    const year = parseInt(req.query.year as string) || now.getUTCFullYear();
    const month = parseInt(req.query.month as string) || now.getUTCMonth() + 1;

    const holidays = await getHolidaysForMonth(year, month);
    res.status(200).json({ success: true, data: { year, month, holidays } });
  } catch (error) {
    next(error);
  }
};

/**
 * POST /api/holidays  body: { date: 'YYYY-MM-DD', name: string }
 * Create one holiday.
 */
export const createHoliday = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { date, name } = req.body;
    if (!date || !name) return next(new AppError('date and name are required', 400));

    const dayStart = dhakaDayStart(date);
    const existing = await prisma.holiday.findUnique({ where: { date: dayStart } });
    if (existing) return next(new AppError('A holiday already exists on this date', 400));

    const holiday = await prisma.holiday.create({
      data: {
        date: dayStart,
        name,
        year: dayStart.getUTCFullYear(),
        month: dayStart.getUTCMonth() + 1
      }
    });

    res.status(201).json({ success: true, data: holiday });
  } catch (error) {
    next(error);
  }
};

/**
 * POST /api/holidays/bulk  body: { holidays: [{ date: 'YYYY-MM-DD', name: string }, ...] }
 * Upload many holidays at once (per-month upload).
 */
export const bulkCreateHolidays = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const items = req.body?.holidays || req.body?.items;
    if (!Array.isArray(items) || items.length === 0) {
      return next(new AppError('holidays array is required', 400));
    }

    const valid = items.filter((it: any) => it?.date && it?.name);
    if (valid.length === 0) return next(new AppError('No valid holiday entries provided', 400));

    let created = 0;
    let skipped = 0;
    for (const it of valid) {
      const dayStart = dhakaDayStart(String(it.date));
      const existing = await prisma.holiday.findUnique({ where: { date: dayStart } });
      if (existing) {
        skipped++;
        continue;
      }
      await prisma.holiday.create({
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
  } catch (error) {
    next(error);
  }
};

/**
 * PUT /api/holidays/:id  body: { date?, name? }
 */
export const updateHoliday = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const holiday = await prisma.holiday.findUnique({ where: { id } });
    if (!holiday) return next(new AppError('Holiday not found', 404));

    const data: any = {};
    if (req.body.name != null) data.name = String(req.body.name);
    if (req.body.date != null) {
      const dayStart = dhakaDayStart(String(req.body.date));
      const dup = await prisma.holiday.findUnique({ where: { date: dayStart } });
      if (dup && dup.id !== id) return next(new AppError('A holiday already exists on this date', 400));
      data.date = dayStart;
      data.year = dayStart.getUTCFullYear();
      data.month = dayStart.getUTCMonth() + 1;
    }

    const updated = await prisma.holiday.update({ where: { id }, data });
    res.status(200).json({ success: true, data: updated });
  } catch (error) {
    next(error);
  }
};

/**
 * DELETE /api/holidays/:id
 */
export const deleteHoliday = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const holiday = await prisma.holiday.findUnique({ where: { id } });
    if (!holiday) return next(new AppError('Holiday not found', 404));

    await prisma.holiday.delete({ where: { id } });
    res.status(200).json({ success: true, message: 'Holiday deleted' });
  } catch (error) {
    next(error);
  }
};

/**
 * POST /api/holidays/sync-google
 * Import the Bangladesh government office holidays calendar (idempotent upsert).
 */
export const syncGoogleHolidays = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await syncGoogleBangladeshHolidays();
    res.status(201).json({
      success: true,
      message: `Synced ${result.created} government holidays (${result.total} in feed, ${result.skipped} skipped, ${result.removed} non-government removed)`,
      data: result
    });
  } catch (error) {
    next(error);
  }
};

export default {
  getHolidays,
  createHoliday,
  bulkCreateHolidays,
  updateHoliday,
  deleteHoliday,
  syncGoogleHolidays
};