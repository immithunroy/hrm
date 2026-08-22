"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.autoGenerateFestivalBonuses = exports.getFestivalBonusSummary = exports.deleteFestivalBonus = exports.cancelFestivalBonus = exports.markInstallmentPaid = exports.approveFestivalBonus = exports.getFestivalBonusById = exports.getFestivalBonuses = exports.createFestivalBonus = void 0;
const database_1 = require("../config/database");
const library_1 = require("@prisma/client/runtime/library");
const createFestivalBonus = async (data) => {
    const employee = await database_1.prisma.employee.findUnique({ where: { id: data.employeeId } });
    if (!employee)
        throw new Error('Employee not found');
    const basicSalary = new library_1.Decimal(Number(employee.salary || 0));
    const totalAmount = data.bonusType === 'BASIC_SALARY' ? basicSalary.mul(2) : basicSalary;
    let installment1Amount = null;
    let installment2Amount = null;
    if (data.paymentMode === 'TWO_INSTALLMENTS') {
        installment1Amount = totalAmount.div(2).round();
        installment2Amount = totalAmount.minus(installment1Amount);
    }
    return database_1.prisma.festivalBonus.create({
        data: {
            employeeId: data.employeeId,
            festivalType: data.festivalType,
            customFestivalName: data.customFestivalName,
            year: data.year,
            bonusType: data.bonusType,
            totalAmount,
            paymentMode: data.paymentMode || 'ONE_TIME',
            installment1Amount,
            installment1Date: data.installment1Date,
            installment1Status: 'PENDING',
            installment2Amount,
            installment2Date: data.installment2Date,
            installment2Status: data.paymentMode === 'TWO_INSTALLMENTS' ? 'PENDING' : 'PAID',
            status: 'PENDING',
            notes: data.notes,
        },
        include: {
            employee: {
                select: { id: true, firstName: true, lastName: true, employeeId: true, salary: true, religion: true }
            }
        }
    });
};
exports.createFestivalBonus = createFestivalBonus;
const getFestivalBonuses = async (params) => {
    const { year, employeeId, festivalType, status, page = 1, limit = 20 } = params;
    const where = {};
    if (year)
        where.year = year;
    if (employeeId)
        where.employeeId = employeeId;
    if (festivalType)
        where.festivalType = festivalType;
    if (status)
        where.status = status;
    const [bonuses, total] = await Promise.all([
        database_1.prisma.festivalBonus.findMany({
            where,
            include: {
                employee: {
                    select: { id: true, firstName: true, lastName: true, employeeId: true, salary: true, religion: true, department: { select: { name: true } } }
                }
            },
            orderBy: [{ year: 'desc' }, { createdAt: 'desc' }],
            skip: (page - 1) * limit,
            take: limit,
        }),
        database_1.prisma.festivalBonus.count({ where })
    ]);
    return { bonuses, total, page, limit, totalPages: Math.ceil(total / limit) };
};
exports.getFestivalBonuses = getFestivalBonuses;
const getFestivalBonusById = async (id) => {
    return database_1.prisma.festivalBonus.findUnique({
        where: { id },
        include: {
            employee: {
                select: { id: true, firstName: true, lastName: true, employeeId: true, salary: true, religion: true, department: { select: { name: true } } }
            }
        }
    });
};
exports.getFestivalBonusById = getFestivalBonusById;
const approveFestivalBonus = async (id, approvedBy) => {
    const bonus = await database_1.prisma.festivalBonus.findUnique({ where: { id } });
    if (!bonus)
        throw new Error('Festival bonus not found');
    if (bonus.status !== 'PENDING')
        throw new Error('Bonus is not in pending status');
    return database_1.prisma.festivalBonus.update({
        where: { id },
        data: { status: 'APPROVED', approvedBy, approvedAt: new Date() },
        include: { employee: { select: { id: true, firstName: true, lastName: true, employeeId: true } } }
    });
};
exports.approveFestivalBonus = approveFestivalBonus;
const markInstallmentPaid = async (id, installmentNumber) => {
    const bonus = await database_1.prisma.festivalBonus.findUnique({ where: { id } });
    if (!bonus)
        throw new Error('Festival bonus not found');
    const updateData = {};
    if (installmentNumber === 1) {
        if (bonus.installment1Status === 'PAID')
            throw new Error('Installment 1 already paid');
        updateData.installment1Status = 'PAID';
        updateData.installment1Date = new Date();
    }
    else {
        if (bonus.installment2Status === 'PAID')
            throw new Error('Installment 2 already paid');
        updateData.installment2Status = 'PAID';
        updateData.installment2Date = new Date();
    }
    if (bonus.paymentMode === 'ONE_TIME') {
        updateData.status = 'PAID';
    }
    else {
        const inst1Paid = installmentNumber === 1 ? true : bonus.installment1Status === 'PAID';
        const inst2Paid = installmentNumber === 2 ? true : bonus.installment2Status === 'PAID';
        if (inst1Paid && inst2Paid)
            updateData.status = 'PAID';
    }
    return database_1.prisma.festivalBonus.update({
        where: { id },
        data: updateData,
        include: { employee: { select: { id: true, firstName: true, lastName: true, employeeId: true } } }
    });
};
exports.markInstallmentPaid = markInstallmentPaid;
const cancelFestivalBonus = async (id) => {
    const bonus = await database_1.prisma.festivalBonus.findUnique({ where: { id } });
    if (!bonus)
        throw new Error('Festival bonus not found');
    if (bonus.status === 'PAID')
        throw new Error('Cannot cancel a paid bonus');
    return database_1.prisma.festivalBonus.update({
        where: { id },
        data: { status: 'CANCELLED', installment1Status: 'CANCELLED', installment2Status: 'CANCELLED' }
    });
};
exports.cancelFestivalBonus = cancelFestivalBonus;
const deleteFestivalBonus = async (id) => {
    const bonus = await database_1.prisma.festivalBonus.findUnique({ where: { id } });
    if (!bonus)
        throw new Error('Festival bonus not found');
    if (bonus.status === 'PAID')
        throw new Error('Cannot delete a paid bonus');
    return database_1.prisma.festivalBonus.delete({ where: { id } });
};
exports.deleteFestivalBonus = deleteFestivalBonus;
const getFestivalBonusSummary = async (year) => {
    const bonuses = await database_1.prisma.festivalBonus.findMany({ where: { year } });
    const totalBonus = bonuses.reduce((sum, b) => sum.plus(b.totalAmount), new library_1.Decimal(0));
    const paidBonus = bonuses.filter(b => b.status === 'PAID').reduce((sum, b) => sum.plus(b.totalAmount), new library_1.Decimal(0));
    const pendingBonus = bonuses.filter(b => b.status === 'PENDING' || b.status === 'APPROVED').reduce((sum, b) => sum.plus(b.totalAmount), new library_1.Decimal(0));
    return {
        totalBonusCount: bonuses.length,
        totalBonusAmount: totalBonus.toNumber(),
        paidAmount: paidBonus.toNumber(),
        pendingAmount: pendingBonus.toNumber(),
        paidCount: bonuses.filter(b => b.status === 'PAID').length,
        pendingCount: bonuses.filter(b => b.status === 'PENDING').length,
        approvedCount: bonuses.filter(b => b.status === 'APPROVED').length,
    };
};
exports.getFestivalBonusSummary = getFestivalBonusSummary;
const autoGenerateFestivalBonuses = async (year, festivalType, bonusType, paymentMode) => {
    const eligibleReligions = (festivalType === 'EID_UL_FITR' || festivalType === 'EID_UL_ADHA')
        ? ['ISLAM']
        : ['HINDU', 'BUDDHIST', 'CHRISTIAN', 'OTHER'];
    const employees = await database_1.prisma.employee.findMany({
        where: { status: 'ACTIVE', religion: { in: eligibleReligions } }
    });
    const existing = await database_1.prisma.festivalBonus.findMany({
        where: { year, festivalType, employeeId: { in: employees.map(e => e.id) } }
    });
    const existingIds = new Set(existing.map(b => b.employeeId));
    const newBonuses = [];
    for (const emp of employees) {
        if (existingIds.has(emp.id))
            continue;
        const basicSalary = new library_1.Decimal(Number(emp.salary || 0));
        const totalAmount = bonusType === 'BASIC_SALARY' ? basicSalary.mul(2) : basicSalary;
        let i1 = null;
        let i2 = null;
        if (paymentMode === 'TWO_INSTALLMENTS') {
            i1 = totalAmount.div(2).round();
            i2 = totalAmount.minus(i1);
        }
        const bonus = await database_1.prisma.festivalBonus.create({
            data: {
                employeeId: emp.id,
                festivalType,
                year,
                bonusType,
                totalAmount,
                paymentMode,
                installment1Amount: i1,
                installment1Status: 'PENDING',
                installment2Amount: i2,
                installment2Status: paymentMode === 'TWO_INSTALLMENTS' ? 'PENDING' : 'PAID',
                status: 'PENDING',
            }
        });
        newBonuses.push(bonus);
    }
    return { created: newBonuses.length, skipped: existingIds.size };
};
exports.autoGenerateFestivalBonuses = autoGenerateFestivalBonuses;
