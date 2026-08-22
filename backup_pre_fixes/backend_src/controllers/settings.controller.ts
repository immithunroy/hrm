import { Request, Response, NextFunction } from 'express';
import { getPayrollSettings, updatePayrollSettings } from '../services/settings.service';

export const getSettings = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const settings = await getPayrollSettings();
    res.status(200).json({ success: true, data: settings });
  } catch (error) {
    next(error);
  }
};

export const updateSettings = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const settings = await updatePayrollSettings(req.body);
    res.status(200).json({ success: true, data: settings });
  } catch (error) {
    next(error);
  }
};

export default { getSettings, updateSettings };