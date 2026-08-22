import { Request, Response, NextFunction } from 'express';
import { AppError } from '../utils/appError';
import * as loanService from '../services/loan.service';

export const createLoan = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { employeeId, amount, interestRate, purpose, startDate, endDate, installmentAmount, installmentCount, frequency, notes } = req.body;

    if (!employeeId || !amount || !startDate) {
      return next(new AppError('employeeId, amount, and startDate are required', 400));
    }

    const loan = await loanService.createLoan({
      employeeId,
      amount: Number(amount),
      interestRate: interestRate ? Number(interestRate) : 0,
      purpose,
      startDate: new Date(startDate),
      endDate: endDate ? new Date(endDate) : undefined,
      installmentAmount: installmentAmount ? Number(installmentAmount) : undefined,
      installmentCount,
      frequency,
      notes,
    });

    res.status(201).json({ success: true, data: loan });
  } catch (error) {
    next(error);
  }
};

export const getLoans = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { employeeId, status, page, limit } = req.query;

    const result = await loanService.getLoans({
      employeeId: employeeId as string,
      status: status as string,
      page: page ? parseInt(page as string) : 1,
      limit: limit ? parseInt(limit as string) : 20,
    });

    res.status(200).json({ success: true, data: result });
  } catch (error) {
    next(error);
  }
};

export const getLoanById = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const loan = await loanService.getLoanById(id);

    if (!loan) {
      return next(new AppError('Loan not found', 404));
    }

    res.status(200).json({ success: true, data: loan });
  } catch (error) {
    next(error);
  }
};

export const approveLoan = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const { approvedBy } = req.body;

    if (!approvedBy) {
      return next(new AppError('approvedBy is required', 400));
    }

    const loan = await loanService.approveLoan(id, approvedBy);
    res.status(200).json({ success: true, data: loan });
  } catch (error) {
    next(error);
  }
};

export const disburseLoan = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const loan = await loanService.disburseLoan(id);
    res.status(200).json({ success: true, data: loan });
  } catch (error) {
    next(error);
  }
};

export const recordPayment = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { loanId, installmentId } = req.params;
    const { amount, payrollId } = req.body;

    if (!amount) {
      return next(new AppError('amount is required', 400));
    }

    const result = await loanService.recordPayment(loanId, installmentId, Number(amount), payrollId);
    res.status(200).json({ success: true, data: result });
  } catch (error) {
    next(error);
  }
};

export const getLoanSummary = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { employeeId } = req.params;
    const summary = await loanService.getLoanSummary(employeeId);
    res.status(200).json({ success: true, data: summary });
  } catch (error) {
    next(error);
  }
};

export const cancelLoan = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const loan = await loanService.cancelLoan(id);
    res.status(200).json({ success: true, data: loan });
  } catch (error) {
    next(error);
  }
};

export const getInstallmentsByLoan = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { loanId } = req.params;
    const installments = await loanService.getInstallmentsByLoan(loanId);
    res.status(200).json({ success: true, data: installments });
  } catch (error) {
    next(error);
  }
};

export const getUpcomingInstallments = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { days } = req.query;
    const installments = await loanService.getUpcomingInstallments(days ? parseInt(days as string) : 30);
    res.status(200).json({ success: true, data: installments });
  } catch (error) {
    next(error);
  }
};

export default {
  createLoan,
  getLoans,
  getLoanById,
  approveLoan,
  disburseLoan,
  recordPayment,
  getLoanSummary,
  cancelLoan,
  getInstallmentsByLoan,
  getUpcomingInstallments,
};