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
const express_1 = require("express");
const validateRequest_1 = require("../middleware/validateRequest");
const zod_1 = require("zod");
const authenticateToken_1 = require("../middleware/authenticateToken");
const festivalBonusController = __importStar(require("../controllers/festivalBonus.controller"));
const router = (0, express_1.Router)();
// Protect all festival bonus routes
router.use(authenticateToken_1.authenticateToken);
const createBonusSchema = zod_1.z.object({
    employeeId: zod_1.z.string().uuid('Invalid employee ID'),
    festivalType: zod_1.z.enum(['EID_UL_FITR', 'EID_UL_ADHA', 'OTHER']),
    customFestivalName: zod_1.z.string().optional(),
    year: zod_1.z.number().int().min(2020).max(2100),
    bonusType: zod_1.z.enum(['BASIC_SALARY', 'GROSS_SALARY']),
    paymentMode: zod_1.z.enum(['ONE_TIME', 'TWO_INSTALLMENTS']).default('ONE_TIME'),
    installment1Date: zod_1.z.string().optional(),
    installment2Date: zod_1.z.string().optional(),
    notes: zod_1.z.string().optional(),
});
const autoGenerateSchema = zod_1.z.object({
    year: zod_1.z.number().int().min(2020).max(2100),
    festivalType: zod_1.z.enum(['EID_UL_FITR', 'EID_UL_ADHA', 'OTHER']),
    bonusType: zod_1.z.enum(['BASIC_SALARY', 'GROSS_SALARY']),
    paymentMode: zod_1.z.enum(['ONE_TIME', 'TWO_INSTALLMENTS']).default('ONE_TIME'),
});
const installmentSchema = zod_1.z.object({
    installmentNumber: zod_1.z.number().int().min(1).max(2),
});
router.get('/', (0, authenticateToken_1.authorize)('ADMIN', 'HR', 'FINANCE', 'MANAGER', 'EMPLOYEE'), festivalBonusController.getFestivalBonuses);
router.get('/summary', (0, authenticateToken_1.authorize)('ADMIN', 'HR', 'FINANCE', 'MANAGER', 'EMPLOYEE'), festivalBonusController.getFestivalBonusSummary);
router.get('/:id', (0, authenticateToken_1.authorize)('ADMIN', 'HR', 'FINANCE', 'MANAGER', 'EMPLOYEE'), festivalBonusController.getFestivalBonusById);
router.post('/', (0, authenticateToken_1.authorize)('ADMIN', 'HR', 'FINANCE'), (0, validateRequest_1.validateRequest)(createBonusSchema), festivalBonusController.createFestivalBonus);
router.post('/auto-generate', (0, authenticateToken_1.authorize)('ADMIN', 'HR', 'FINANCE'), (0, validateRequest_1.validateRequest)(autoGenerateSchema), festivalBonusController.autoGenerateFestivalBonuses);
router.post('/:id/approve', (0, authenticateToken_1.authorize)('ADMIN', 'HR', 'FINANCE'), festivalBonusController.approveFestivalBonus);
router.post('/:id/installment', (0, authenticateToken_1.authorize)('ADMIN', 'HR', 'FINANCE'), (0, validateRequest_1.validateRequest)(installmentSchema), festivalBonusController.markInstallmentPaid);
router.post('/:id/cancel', (0, authenticateToken_1.authorize)('ADMIN', 'HR', 'FINANCE'), festivalBonusController.cancelFestivalBonus);
router.delete('/:id', (0, authenticateToken_1.authorize)('ADMIN', 'HR', 'FINANCE'), festivalBonusController.deleteFestivalBonus);
exports.default = router;
