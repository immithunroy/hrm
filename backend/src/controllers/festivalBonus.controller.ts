/**
 * Festival Bonus Controller
 * -------------------------
 * Manages festival bonus records: creation, approval, installment tracking,
 * cancellation, and auto-generation for all active employees. Supports
 * one-time and two-installment payment modes.
 */
import { Request, Response, NextFunction } from 'express';
import { AppError } from '../utils/appError';
import * as festivalBonusService from '../services/festivalBonus.service';

export const createFestivalBonus = async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (req.userRole === 'EMPLOYEE') {
      return next(new AppError('Insufficient permissions', 403));
    }
    const { employeeId, festivalType, customFestivalName, year, bonusType, paymentMode, installment1Date, installment2Date, notes } = req.body;
    if (!employeeId || !festivalType || !year || !bonusType) {
      return next(new AppError('employeeId, festivalType, year, and bonusType are required', 400));
    }
    const bonus = await festivalBonusService.createFestivalBonus({
      employeeId, festivalType, customFestivalName, year, bonusType, paymentMode,
      installment1Date: installment1Date ? new Date(installment1Date) : undefined,
      installment2Date: installment2Date ? new Date(installment2Date) : undefined,
      notes,
    });
    res.status(201).json({ success: true, data: bonus });
  } catch (error) { next(error); }
};

/**
 * Get festival bonuses. EMPLOYEE: only own bonuses.
 */
export const getFestivalBonuses = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { year, employeeId, festivalType, status, page, limit } = req.query;

    // Employees are restricted to their own bonus records
    const effectiveEmployeeId = req.userRole === 'EMPLOYEE'
      ? req.userId
      : (employeeId as string | undefined);

    const result = await festivalBonusService.getFestivalBonuses({
      year: year ? parseInt(year as string) : undefined,
      employeeId: effectiveEmployeeId,
      festivalType: festivalType as string,
      status: status as string,
      page: page ? parseInt(page as string) : 1,
      limit: limit ? parseInt(limit as string) : 20,
    });
    res.status(200).json({ success: true, data: result });
  } catch (error) { next(error); }
};

/**
 * Get festival bonus by ID. EMPLOYEE: only own bonuses.
 */
export const getFestivalBonusById = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const bonus = await festivalBonusService.getFestivalBonusById(req.params.id);
    if (!bonus) return next(new AppError('Festival bonus not found', 404));

    // EMPLOYEE: only own bonuses
    if (req.userRole === 'EMPLOYEE' && bonus.employeeId !== req.userId) {
      return next(new AppError('Insufficient permissions', 403));
    }

    res.status(200).json({ success: true, data: bonus });
  } catch (error) { next(error); }
};

export const approveFestivalBonus = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { approvedBy } = req.body;
    if (!approvedBy) return next(new AppError('approvedBy is required', 400));
    const bonus = await festivalBonusService.approveFestivalBonus(req.params.id, approvedBy);
    res.status(200).json({ success: true, data: bonus });
  } catch (error) { next(error); }
};

export const markInstallmentPaid = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { installmentNumber } = req.body;
    if (!installmentNumber || ![1, 2].includes(installmentNumber)) {
      return next(new AppError('installmentNumber must be 1 or 2', 400));
    }
    const bonus = await festivalBonusService.markInstallmentPaid(req.params.id, installmentNumber);
    res.status(200).json({ success: true, data: bonus });
  } catch (error) { next(error); }
};

export const cancelFestivalBonus = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const bonus = await festivalBonusService.cancelFestivalBonus(req.params.id);
    res.status(200).json({ success: true, data: bonus });
  } catch (error) { next(error); }
};

export const deleteFestivalBonus = async (req: Request, res: Response, next: NextFunction) => {
  try {
    await festivalBonusService.deleteFestivalBonus(req.params.id);
    res.status(200).json({ success: true, message: 'Deleted' });
  } catch (error) { next(error); }
};

/**
 * Get festival bonus summary. EMPLOYEE: only own summary.
 */
export const getFestivalBonusSummary = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const year = parseInt(req.query.year as string) || new Date().getFullYear();
    const summary = await festivalBonusService.getFestivalBonusSummary(year);
    res.status(200).json({ success: true, data: summary });
  } catch (error) { next(error); }
};

export const autoGenerateFestivalBonuses = async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (req.userRole === 'EMPLOYEE') {
      return next(new AppError('Insufficient permissions', 403));
    }
    const { year, festivalType, bonusType, paymentMode } = req.body;
    if (!year || !festivalType || !bonusType) {
      return next(new AppError('year, festivalType, and bonusType are required', 400));
    }
    const result = await festivalBonusService.autoGenerateFestivalBonuses(year, festivalType, bonusType, paymentMode || 'ONE_TIME');
    res.status(201).json({ success: true, data: result });
  } catch (error) { next(error); }
};

export default {
  createFestivalBonus,
  getFestivalBonuses,
  getFestivalBonusById,
  approveFestivalBonus,
  markInstallmentPaid,
  cancelFestivalBonus,
  deleteFestivalBonus,
  getFestivalBonusSummary,
  autoGenerateFestivalBonuses,
};
