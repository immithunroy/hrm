"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getUpcomingInstallments = exports.getInstallmentsByLoan = exports.cancelLoan = exports.updateOverdueStatus = exports.getLoanSummary = exports.recordPayment = exports.disburseLoan = exports.approveLoan = exports.getLoanById = exports.getLoans = exports.generateInstallments = exports.createLoan = void 0;
const database_1 = require("../config/database");
const library_1 = require("@prisma/client/runtime/library");
const createLoan = async (data) => {
    const amount = new library_1.Decimal(data.amount);
    const interestRate = data.interestRate ? new library_1.Decimal(data.interestRate) : new library_1.Decimal(0);
    const totalAmount = amount.plus(amount.times(interestRate).div(100));
    const remainingAmount = totalAmount;
    const loan = await database_1.prisma.loan.create({
        data: {
            employeeId: data.employeeId,
            amount,
            interestRate,
            totalAmount,
            remainingAmount,
            status: 'PENDING',
            purpose: data.purpose,
            startDate: data.startDate,
            endDate: data.endDate,
            installmentAmount: data.installmentAmount ? new library_1.Decimal(data.installmentAmount) : null,
            installmentCount: data.installmentCount,
            frequency: data.frequency || 'MONTHLY',
            notes: data.notes,
        },
        include: {
            employee: {
                select: { id: true, firstName: true, lastName: true, employeeId: true }
            }
        }
    });
    if (data.installmentCount && data.installmentAmount) {
        await (0, exports.generateInstallments)(loan.id, data.installmentCount, data.installmentAmount, data.startDate, data.frequency || 'MONTHLY');
    }
    return loan;
};
exports.createLoan = createLoan;
const generateInstallments = async (loanId, count, installmentAmount, startDate, frequency) => {
    const installments = [];
    let currentDate = new Date(startDate);
    for (let i = 0; i < count; i++) {
        installments.push({
            loanId,
            dueDate: new Date(currentDate),
            amount: new library_1.Decimal(installmentAmount),
            status: 'PENDING',
        });
        switch (frequency) {
            case 'WEEKLY':
                currentDate.setDate(currentDate.getDate() + 7);
                break;
            case 'BIWEEKLY':
                currentDate.setDate(currentDate.getDate() + 14);
                break;
            case 'MONTHLY':
                currentDate.setMonth(currentDate.getMonth() + 1);
                break;
            case 'QUARTERLY':
                currentDate.setMonth(currentDate.getMonth() + 3);
                break;
        }
    }
    await database_1.prisma.loanInstallment.createMany({ data: installments });
};
exports.generateInstallments = generateInstallments;
const getLoans = async (params) => {
    const { employeeId, status, page = 1, limit = 20 } = params;
    const where = {};
    if (employeeId)
        where.employeeId = employeeId;
    if (status)
        where.status = status;
    const [loans, total] = await Promise.all([
        database_1.prisma.loan.findMany({
            where,
            include: {
                employee: {
                    select: { id: true, firstName: true, lastName: true, employeeId: true, department: { select: { name: true } } }
                },
                installments: {
                    orderBy: { dueDate: 'asc' }
                }
            },
            orderBy: { createdAt: 'desc' },
            skip: (page - 1) * limit,
            take: limit,
        }),
        database_1.prisma.loan.count({ where })
    ]);
    return { loans, total, page, limit, totalPages: Math.ceil(total / limit) };
};
exports.getLoans = getLoans;
const getLoanById = async (id) => {
    return database_1.prisma.loan.findUnique({
        where: { id },
        include: {
            employee: {
                select: { id: true, firstName: true, lastName: true, employeeId: true, department: { select: { name: true } }, salary: true }
            },
            installments: {
                orderBy: { dueDate: 'asc' }
            }
        }
    });
};
exports.getLoanById = getLoanById;
const approveLoan = async (id, approvedBy) => {
    const loan = await database_1.prisma.loan.findUnique({ where: { id } });
    if (!loan)
        throw new Error('Loan not found');
    if (loan.status !== 'PENDING')
        throw new Error('Loan is not in pending status');
    const updated = await database_1.prisma.loan.update({
        where: { id },
        data: {
            status: 'APPROVED',
            approvedBy,
            approvedAt: new Date(),
            disbursedAt: new Date(),
            remainingAmount: loan.totalAmount,
        },
        include: {
            employee: { select: { id: true, firstName: true, lastName: true, employeeId: true } }
        }
    });
    await database_1.prisma.loanInstallment.updateMany({
        where: { loanId: id, status: 'PENDING' },
        data: { status: 'PENDING' }
    });
    return updated;
};
exports.approveLoan = approveLoan;
const disburseLoan = async (id) => {
    const loan = await database_1.prisma.loan.findUnique({ where: { id } });
    if (!loan)
        throw new Error('Loan not found');
    if (loan.status !== 'APPROVED')
        throw new Error('Loan must be approved before disbursement');
    return database_1.prisma.loan.update({
        where: { id },
        data: {
            status: 'ACTIVE',
            disbursedAt: new Date(),
            remainingAmount: loan.totalAmount,
        }
    });
};
exports.disburseLoan = disburseLoan;
const recordPayment = async (loanId, installmentId, amount, payrollId) => {
    const installment = await database_1.prisma.loanInstallment.findUnique({ where: { id: installmentId } });
    if (!installment)
        throw new Error('Installment not found');
    if (installment.loanId !== loanId)
        throw new Error('Installment does not belong to this loan');
    const loan = await database_1.prisma.loan.findUnique({ where: { id: loanId } });
    if (!loan)
        throw new Error('Loan not found');
    const paidAmount = new library_1.Decimal(amount);
    const newPaidAmount = new library_1.Decimal(installment.paidAmount).plus(paidAmount);
    const newRemainingAmount = new library_1.Decimal(loan.remainingAmount).minus(paidAmount);
    let installmentStatus = 'PARTIAL';
    if (newPaidAmount.gte(installment.amount)) {
        installmentStatus = 'PAID';
    }
    const [updatedInstallment, updatedLoan] = await Promise.all([
        database_1.prisma.loanInstallment.update({
            where: { id: installmentId },
            data: {
                paidAmount: newPaidAmount,
                status: installmentStatus,
                paidAt: new Date(),
                payrollId,
            }
        }),
        database_1.prisma.loan.update({
            where: { id: loanId },
            data: {
                remainingAmount: newRemainingAmount,
                status: newRemainingAmount.lte(0) ? 'COMPLETED' : 'ACTIVE',
            }
        })
    ]);
    return { installment: updatedInstallment, loan: updatedLoan };
};
exports.recordPayment = recordPayment;
const getLoanSummary = async (employeeId) => {
    const loans = await database_1.prisma.loan.findMany({
        where: { employeeId },
        include: { installments: true }
    });
    const activeLoans = loans.filter(l => l.status === 'ACTIVE' || l.status === 'APPROVED');
    const totalBorrowed = loans.reduce((sum, l) => sum.plus(l.totalAmount), new library_1.Decimal(0));
    const totalRepaid = loans.reduce((sum, l) => sum.plus(l.totalAmount.minus(l.remainingAmount)), new library_1.Decimal(0));
    const totalOutstanding = activeLoans.reduce((sum, l) => sum.plus(l.remainingAmount), new library_1.Decimal(0));
    const overdueInstallments = activeLoans.flatMap(l => l.installments.filter(i => i.status === 'OVERDUE' || (i.status === 'PENDING' && new Date(i.dueDate) < new Date())));
    return {
        totalLoans: loans.length,
        activeLoans: activeLoans.length,
        totalBorrowed: totalBorrowed.toNumber(),
        totalRepaid: totalRepaid.toNumber(),
        totalOutstanding: totalOutstanding.toNumber(),
        overdueCount: overdueInstallments.length,
        overdueAmount: overdueInstallments.reduce((sum, i) => sum.plus(i.amount.minus(i.paidAmount)), new library_1.Decimal(0)).toNumber(),
    };
};
exports.getLoanSummary = getLoanSummary;
const updateOverdueStatus = async () => {
    const now = new Date();
    const overdueInstallments = await database_1.prisma.loanInstallment.findMany({
        where: {
            status: 'PENDING',
            dueDate: { lt: now }
        }
    });
    for (const inst of overdueInstallments) {
        await database_1.prisma.loanInstallment.update({
            where: { id: inst.id },
            data: { status: 'OVERDUE' }
        });
        const loan = await database_1.prisma.loan.findUnique({ where: { id: inst.loanId } });
        if (loan && loan.status === 'ACTIVE') {
            await database_1.prisma.loan.update({
                where: { id: loan.id },
                data: { status: 'DEFAULTED' }
            });
        }
    }
    return { updated: overdueInstallments.length };
};
exports.updateOverdueStatus = updateOverdueStatus;
const cancelLoan = async (id) => {
    const loan = await database_1.prisma.loan.findUnique({ where: { id } });
    if (!loan)
        throw new Error('Loan not found');
    if (loan.status === 'COMPLETED' || loan.status === 'CANCELLED')
        throw new Error('Cannot cancel completed or already cancelled loan');
    return database_1.prisma.loan.update({
        where: { id },
        data: {
            status: 'CANCELLED',
            installments: {
                updateMany: {
                    where: { status: { in: ['PENDING', 'OVERDUE'] } },
                    data: { status: 'WAIVED' }
                }
            }
        }
    });
};
exports.cancelLoan = cancelLoan;
const getInstallmentsByLoan = async (loanId) => {
    return database_1.prisma.loanInstallment.findMany({
        where: { loanId },
        orderBy: { dueDate: 'asc' }
    });
};
exports.getInstallmentsByLoan = getInstallmentsByLoan;
const getUpcomingInstallments = async (days = 30) => {
    const now = new Date();
    const future = new Date(now.getTime() + days * 24 * 60 * 60 * 1000);
    return database_1.prisma.loanInstallment.findMany({
        where: {
            status: { in: ['PENDING', 'PARTIAL'] },
            dueDate: { gte: now, lte: future }
        },
        include: {
            loan: {
                include: {
                    employee: { select: { id: true, firstName: true, lastName: true, employeeId: true } }
                }
            }
        },
        orderBy: { dueDate: 'asc' }
    });
};
exports.getUpcomingInstallments = getUpcomingInstallments;
