import { prisma } from '../config/database';
import { Decimal } from '@prisma/client/runtime/library';

export interface LoanCreateInput {
  employeeId: string;
  amount: number | Decimal;
  interestRate?: number | Decimal;
  purpose?: string;
  startDate: Date;
  endDate?: Date;
  installmentAmount?: number | Decimal;
  installmentCount?: number;
  frequency?: 'WEEKLY' | 'BIWEEKLY' | 'MONTHLY' | 'QUARTERLY';
  notes?: string;
}

export interface LoanInstallmentCreateInput {
  loanId: string;
  dueDate: Date;
  amount: number | Decimal;
}

export const createLoan = async (data: LoanCreateInput) => {
  const amount = new Decimal(data.amount);
  const interestRate = data.interestRate ? new Decimal(data.interestRate) : new Decimal(0);
  const totalAmount = amount.plus(amount.times(interestRate).div(100));
  const remainingAmount = totalAmount;

  const loan = await prisma.loan.create({
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
      installmentAmount: data.installmentAmount ? new Decimal(data.installmentAmount) : null,
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
    await generateInstallments(loan.id, data.installmentCount, data.installmentAmount, data.startDate, data.frequency || 'MONTHLY');
  }

  return loan;
};

export const generateInstallments = async (
  loanId: string,
  count: number,
  installmentAmount: number | Decimal,
  startDate: Date,
  frequency: 'WEEKLY' | 'BIWEEKLY' | 'MONTHLY' | 'QUARTERLY'
) => {
  const installments = [];
  let currentDate = new Date(startDate);

  for (let i = 0; i < count; i++) {
    installments.push({
      loanId,
      dueDate: new Date(currentDate),
      amount: new Decimal(installmentAmount),
      status: 'PENDING' as const,
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

  await prisma.loanInstallment.createMany({ data: installments });
};

export const getLoans = async (params: {
  employeeId?: string;
  status?: string;
  page?: number;
  limit?: number;
}) => {
  const { employeeId, status, page = 1, limit = 20 } = params;
  const where: any = {};
  if (employeeId) where.employeeId = employeeId;
  if (status) where.status = status;

  const [loans, total] = await Promise.all([
    prisma.loan.findMany({
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
    prisma.loan.count({ where })
  ]);

  return { loans, total, page, limit, totalPages: Math.ceil(total / limit) };
};

export const getLoanById = async (id: string) => {
  return prisma.loan.findUnique({
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

export const approveLoan = async (id: string, approvedBy: string) => {
  const loan = await prisma.loan.findUnique({ where: { id } });
  if (!loan) throw new Error('Loan not found');
  if (loan.status !== 'PENDING') throw new Error('Loan is not in pending status');

  const updated = await prisma.loan.update({
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

  await prisma.loanInstallment.updateMany({
    where: { loanId: id, status: 'PENDING' },
    data: { status: 'PENDING' }
  });

  return updated;
};

export const disburseLoan = async (id: string) => {
  const loan = await prisma.loan.findUnique({ where: { id } });
  if (!loan) throw new Error('Loan not found');
  if (loan.status !== 'APPROVED') throw new Error('Loan must be approved before disbursement');

  return prisma.loan.update({
    where: { id },
    data: {
      status: 'ACTIVE',
      disbursedAt: new Date(),
      remainingAmount: loan.totalAmount,
    }
  });
};

export const recordPayment = async (loanId: string, installmentId: string, amount: number | Decimal, payrollId?: string) => {
  const installment = await prisma.loanInstallment.findUnique({ where: { id: installmentId } });
  if (!installment) throw new Error('Installment not found');
  if (installment.loanId !== loanId) throw new Error('Installment does not belong to this loan');

  const loan = await prisma.loan.findUnique({ where: { id: loanId } });
  if (!loan) throw new Error('Loan not found');

  const paidAmount = new Decimal(amount);
  const newPaidAmount = new Decimal(installment.paidAmount).plus(paidAmount);
  const newRemainingAmount = new Decimal(loan.remainingAmount).minus(paidAmount);

  let installmentStatus: 'PAID' | 'PARTIAL' = 'PARTIAL';
  if (newPaidAmount.gte(installment.amount)) {
    installmentStatus = 'PAID';
  }

  const [updatedInstallment, updatedLoan] = await Promise.all([
    prisma.loanInstallment.update({
      where: { id: installmentId },
      data: {
        paidAmount: newPaidAmount,
        status: installmentStatus,
        paidAt: new Date(),
        payrollId,
      }
    }),
    prisma.loan.update({
      where: { id: loanId },
      data: {
        remainingAmount: newRemainingAmount,
        status: newRemainingAmount.lte(0) ? 'COMPLETED' : 'ACTIVE',
      }
    })
  ]);

  return { installment: updatedInstallment, loan: updatedLoan };
};

export const getLoanSummary = async (employeeId: string) => {
  const loans = await prisma.loan.findMany({
    where: { employeeId },
    include: { installments: true }
  });

  const activeLoans = loans.filter(l => l.status === 'ACTIVE' || l.status === 'APPROVED');
  const totalBorrowed = loans.reduce((sum, l) => sum.plus(l.totalAmount), new Decimal(0));
  const totalRepaid = loans.reduce((sum, l) => sum.plus(l.totalAmount.minus(l.remainingAmount)), new Decimal(0));
  const totalOutstanding = activeLoans.reduce((sum, l) => sum.plus(l.remainingAmount), new Decimal(0));
  const overdueInstallments = activeLoans.flatMap(l => l.installments.filter(i => i.status === 'OVERDUE' || (i.status === 'PENDING' && new Date(i.dueDate) < new Date())));

  return {
    totalLoans: loans.length,
    activeLoans: activeLoans.length,
    totalBorrowed: totalBorrowed.toNumber(),
    totalRepaid: totalRepaid.toNumber(),
    totalOutstanding: totalOutstanding.toNumber(),
    overdueCount: overdueInstallments.length,
    overdueAmount: overdueInstallments.reduce((sum, i) => sum.plus(i.amount.minus(i.paidAmount)), new Decimal(0)).toNumber(),
  };
};

export const updateOverdueStatus = async () => {
  const now = new Date();
  const overdueInstallments = await prisma.loanInstallment.findMany({
    where: {
      status: 'PENDING',
      dueDate: { lt: now }
    }
  });

  for (const inst of overdueInstallments) {
    await prisma.loanInstallment.update({
      where: { id: inst.id },
      data: { status: 'OVERDUE' }
    });

    const loan = await prisma.loan.findUnique({ where: { id: inst.loanId } });
    if (loan && loan.status === 'ACTIVE') {
      await prisma.loan.update({
        where: { id: loan.id },
        data: { status: 'DEFAULTED' }
      });
    }
  }

  return { updated: overdueInstallments.length };
};

export const cancelLoan = async (id: string) => {
  const loan = await prisma.loan.findUnique({ where: { id } });
  if (!loan) throw new Error('Loan not found');
  if (loan.status === 'COMPLETED' || loan.status === 'CANCELLED') throw new Error('Cannot cancel completed or already cancelled loan');

  return prisma.loan.update({
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

export const getInstallmentsByLoan = async (loanId: string) => {
  return prisma.loanInstallment.findMany({
    where: { loanId },
    orderBy: { dueDate: 'asc' }
  });
};

export const getUpcomingInstallments = async (days: number = 30) => {
  const now = new Date();
  const future = new Date(now.getTime() + days * 24 * 60 * 60 * 1000);
  
  return prisma.loanInstallment.findMany({
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