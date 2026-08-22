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
exports.autoGenerateFestivalBonuses = exports.getFestivalBonusSummary = exports.deleteFestivalBonus = exports.cancelFestivalBonus = exports.markInstallmentPaid = exports.approveFestivalBonus = exports.getFestivalBonusById = exports.getFestivalBonuses = exports.createFestivalBonus = void 0;
const appError_1 = require("../utils/appError");
const festivalBonusService = __importStar(require("../services/festivalBonus.service"));
const createFestivalBonus = async (req, res, next) => {
    try {
        const { employeeId, festivalType, customFestivalName, year, bonusType, paymentMode, installment1Date, installment2Date, notes } = req.body;
        if (!employeeId || !festivalType || !year || !bonusType) {
            return next(new appError_1.AppError('employeeId, festivalType, year, and bonusType are required', 400));
        }
        const bonus = await festivalBonusService.createFestivalBonus({
            employeeId, festivalType, customFestivalName, year, bonusType, paymentMode,
            installment1Date: installment1Date ? new Date(installment1Date) : undefined,
            installment2Date: installment2Date ? new Date(installment2Date) : undefined,
            notes,
        });
        res.status(201).json({ success: true, data: bonus });
    }
    catch (error) {
        next(error);
    }
};
exports.createFestivalBonus = createFestivalBonus;
const getFestivalBonuses = async (req, res, next) => {
    try {
        const { year, employeeId, festivalType, status, page, limit } = req.query;
        const result = await festivalBonusService.getFestivalBonuses({
            year: year ? parseInt(year) : undefined,
            employeeId: employeeId,
            festivalType: festivalType,
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
exports.getFestivalBonuses = getFestivalBonuses;
const getFestivalBonusById = async (req, res, next) => {
    try {
        const bonus = await festivalBonusService.getFestivalBonusById(req.params.id);
        if (!bonus)
            return next(new appError_1.AppError('Festival bonus not found', 404));
        res.status(200).json({ success: true, data: bonus });
    }
    catch (error) {
        next(error);
    }
};
exports.getFestivalBonusById = getFestivalBonusById;
const approveFestivalBonus = async (req, res, next) => {
    try {
        const { approvedBy } = req.body;
        if (!approvedBy)
            return next(new appError_1.AppError('approvedBy is required', 400));
        const bonus = await festivalBonusService.approveFestivalBonus(req.params.id, approvedBy);
        res.status(200).json({ success: true, data: bonus });
    }
    catch (error) {
        next(error);
    }
};
exports.approveFestivalBonus = approveFestivalBonus;
const markInstallmentPaid = async (req, res, next) => {
    try {
        const { installmentNumber } = req.body;
        if (!installmentNumber || ![1, 2].includes(installmentNumber)) {
            return next(new appError_1.AppError('installmentNumber must be 1 or 2', 400));
        }
        const bonus = await festivalBonusService.markInstallmentPaid(req.params.id, installmentNumber);
        res.status(200).json({ success: true, data: bonus });
    }
    catch (error) {
        next(error);
    }
};
exports.markInstallmentPaid = markInstallmentPaid;
const cancelFestivalBonus = async (req, res, next) => {
    try {
        const bonus = await festivalBonusService.cancelFestivalBonus(req.params.id);
        res.status(200).json({ success: true, data: bonus });
    }
    catch (error) {
        next(error);
    }
};
exports.cancelFestivalBonus = cancelFestivalBonus;
const deleteFestivalBonus = async (req, res, next) => {
    try {
        await festivalBonusService.deleteFestivalBonus(req.params.id);
        res.status(200).json({ success: true, message: 'Deleted' });
    }
    catch (error) {
        next(error);
    }
};
exports.deleteFestivalBonus = deleteFestivalBonus;
const getFestivalBonusSummary = async (req, res, next) => {
    try {
        const year = parseInt(req.query.year) || new Date().getFullYear();
        const summary = await festivalBonusService.getFestivalBonusSummary(year);
        res.status(200).json({ success: true, data: summary });
    }
    catch (error) {
        next(error);
    }
};
exports.getFestivalBonusSummary = getFestivalBonusSummary;
const autoGenerateFestivalBonuses = async (req, res, next) => {
    try {
        const { year, festivalType, bonusType, paymentMode } = req.body;
        if (!year || !festivalType || !bonusType) {
            return next(new appError_1.AppError('year, festivalType, and bonusType are required', 400));
        }
        const result = await festivalBonusService.autoGenerateFestivalBonuses(year, festivalType, bonusType, paymentMode || 'ONE_TIME');
        res.status(201).json({ success: true, data: result });
    }
    catch (error) {
        next(error);
    }
};
exports.autoGenerateFestivalBonuses = autoGenerateFestivalBonuses;
exports.default = {
    createFestivalBonus: exports.createFestivalBonus,
    getFestivalBonuses: exports.getFestivalBonuses,
    getFestivalBonusById: exports.getFestivalBonusById,
    approveFestivalBonus: exports.approveFestivalBonus,
    markInstallmentPaid: exports.markInstallmentPaid,
    cancelFestivalBonus: exports.cancelFestivalBonus,
    deleteFestivalBonus: exports.deleteFestivalBonus,
    getFestivalBonusSummary: exports.getFestivalBonusSummary,
    autoGenerateFestivalBonuses: exports.autoGenerateFestivalBonuses,
};
