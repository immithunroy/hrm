"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.getUpcomingInstallments = exports.getInstallmentsByLoan = exports.cancelLoan = exports.getLoanSummary = exports.recordPayment = exports.disburseLoan = exports.approveLoan = exports.getLoanById = exports.getLoans = exports.createLoan = void 0;
const appError_1 = require("../utils/appError");
const loanService = __importStar(require("../services/loan.service"));
const createLoan = async (req, res, next) => {
    try {
        const { employeeId, amount, interestRate, purpose, startDate, endDate, installmentAmount, installmentCount, frequency, notes } = req.body;
        if (!employeeId || !amount || !startDate) {
            return next(new appError_1.AppError('employeeId, amount, and startDate are required', 400));
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
    }
    catch (error) {
        next(error);
    }
};
exports.createLoan = createLoan;
const getLoans = async (req, res, next) => {
    try {
        const { employeeId, status, page, limit } = req.query;
        const result = await loanService.getLoans({
            employeeId: employeeId,
            status: status,
            page: page ? parseInt(page) : 1,
            limit: limit ? parseInt(limit) : 20,
        });
        res.status(200).json({ success: true, data: result });
    }
    catch (error) {
        next(error);
    }
};
exports.getLoans = getLoans;
const getLoanById = async (req, res, next) => {
    try {
        const { id } = req.params;
        const loan = await loanService.getLoanById(id);
        if (!loan) {
            return next(new appError_1.AppError('Loan not found', 404));
        }
        res.status(200).json({ success: true, data: loan });
    }
    catch (error) {
        next(error);
    }
};
exports.getLoanById = getLoanById;
const approveLoan = async (req, res, next) => {
    try {
        const { id } = req.params;
        const { approvedBy } = req.body;
        if (!approvedBy) {
            return next(new appError_1.AppError('approvedBy is required', 400));
        }
        const loan = await loanService.approveLoan(id, approvedBy);
        res.status(200).json({ success: true, data: loan });
    }
    catch (error) {
        next(error);
    }
};
exports.approveLoan = approveLoan;
const disburseLoan = async (req, res, next) => {
    try {
        const { id } = req.params;
        const loan = await loanService.disburseLoan(id);
        res.status(200).json({ success: true, data: loan });
    }
    catch (error) {
        next(error);
    }
};
exports.disburseLoan = disburseLoan;
const recordPayment = async (req, res, next) => {
    try {
        const { loanId, installmentId } = req.params;
        const { amount, payrollId } = req.body;
        if (!amount) {
            return next(new appError_1.AppError('amount is required', 400));
        }
        const result = await loanService.recordPayment(loanId, installmentId, Number(amount), payrollId);
        res.status(200).json({ success: true, data: result });
    }
    catch (error) {
        next(error);
    }
};
exports.recordPayment = recordPayment;
const getLoanSummary = async (req, res, next) => {
    try {
        const { employeeId } = req.params;
        const summary = await loanService.getLoanSummary(employeeId);
        res.status(200).json({ success: true, data: summary });
    }
    catch (error) {
        next(error);
    }
};
exports.getLoanSummary = getLoanSummary;
const cancelLoan = async (req, res, next) => {
    try {
        const { id } = req.params;
        const loan = await loanService.cancelLoan(id);
        res.status(200).json({ success: true, data: loan });
    }
    catch (error) {
        next(error);
    }
};
exports.cancelLoan = cancelLoan;
const getInstallmentsByLoan = async (req, res, next) => {
    try {
        const { loanId } = req.params;
        const installments = await loanService.getInstallmentsByLoan(loanId);
        res.status(200).json({ success: true, data: installments });
    }
    catch (error) {
        next(error);
    }
};
exports.getInstallmentsByLoan = getInstallmentsByLoan;
const getUpcomingInstallments = async (req, res, next) => {
    try {
        const { days } = req.query;
        const installments = await loanService.getUpcomingInstallments(days ? parseInt(days) : 30);
        res.status(200).json({ success: true, data: installments });
    }
    catch (error) {
        next(error);
    }
};
exports.getUpcomingInstallments = getUpcomingInstallments;
exports.default = {
    createLoan: exports.createLoan,
    getLoans: exports.getLoans,
    getLoanById: exports.getLoanById,
    approveLoan: exports.approveLoan,
    disburseLoan: exports.disburseLoan,
    recordPayment: exports.recordPayment,
    getLoanSummary: exports.getLoanSummary,
    cancelLoan: exports.cancelLoan,
    getInstallmentsByLoan: exports.getInstallmentsByLoan,
    getUpcomingInstallments: exports.getUpcomingInstallments,
};
