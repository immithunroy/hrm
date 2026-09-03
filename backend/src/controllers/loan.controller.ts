/**
 * Loan Controller
 * ---------------
 * Manages employee loans: creation, approval, disbursement, payment recording,
 * and installment tracking. Employees can only view their own loans; admins
 * manage the full lifecycle. The service layer enforces status transitions.
 */
import { Request, Response, NextFunction } from 'express';
import { AppError } from '../utils/appError';
import * as loanService from '../services/loan.service';

export const createLoan = async (req: Request, res: Response, next: NextFunction) => {
  try {
    // EMPLOYEE cannot create loans (route-level enforced, but double-check)
    if (req.userRole === 'EMPLOYEE') {
      return next(new AppError('Insufficient permissions', 403));
    }

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

/**
 * Get loans. EMPLOYEE: only own loans.
 */
export const getLoans = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { employeeId, status, page, limit } = req.query;

    // Employees are restricted to their own loans regardless of query param
    const effectiveEmployeeId = req.userRole === 'EMPLOYEE'
      ? req.userId
      : (employeeId as string | undefined);

    const result = await loanService.getLoans({
      employeeId: effectiveEmployeeId,
      status: status as string,
      page: page ? parseInt(page as string) : 1,
      limit: limit ? parseInt(limit as string) : 20,
    });

    res.status(200).json({ success: true, data: result });
  } catch (error) {
    next(error);
  }
};

/**
 * Get loan by ID. EMPLOYEE: only own loans.
 */
export const getLoanById = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const loan = await loanService.getLoanById(id);

    if (!loan) {
      return next(new AppError('Loan not found', 404));
    }

    // EMPLOYEE: only own loans
    if (req.userRole === 'EMPLOYEE' && loan.employeeId !== req.userId) {
      return next(new AppError('Insufficient permissions', 403));
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

/**
 * Get loan summary. EMPLOYEE: only own summary.
 */
export const getLoanSummary = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { employeeId } = req.params;

    // EMPLOYEE: only own summary
    if (req.userRole === 'EMPLOYEE' && employeeId !== req.userId) {
      return next(new AppError('Insufficient permissions', 403));
    }

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

/**
 * Get installments. EMPLOYEE: only own loan installments.
 */
export const getInstallmentsByLoan = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { loanId } = req.params;

    // Check ownership for EMPLOYEE
    if (req.userRole === 'EMPLOYEE') {
      const loan = await loanService.getLoanById(loanId);
      if (!loan || loan.employeeId !== req.userId) {
        return next(new AppError('Insufficient permissions', 403));
      }
    }

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
