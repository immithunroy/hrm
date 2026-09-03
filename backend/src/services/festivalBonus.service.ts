/**
 * Festival Bonus Service
 *
 * Manages Eid and other festival bonuses for employees. Supports one-time
 * or two-installment payment modes. Key exports:
 *
 * - createFestivalBonus – single employee bonus (2x basic or gross)
 * - autoGenerateFestivalBonuses – bulk-create bonuses for all eligible
 *   employees of a given religion, skipping duplicates
 * - approveFestivalBonus / markInstallmentPaid – workflow transitions
 * - cancelFestivalBonus / deleteFestivalBonus – cancellation with guards
 * - getFestivalBonusSummary – year-level totals (paid / pending / count)
 *
 * Bonus amounts use Prisma Decimal for precision. The "BASIC_SALARY" type
 * awards 2× basic; "GROSS_SALARY" awards 1× basic.
 */
import { prisma } from '../config/database';
import { Decimal } from '@prisma/client/runtime/library';

export interface FestivalBonusCreateInput {
  employeeId: string;
  festivalType: 'EID_UL_FITR' | 'EID_UL_ADHA' | 'OTHER';
  customFestivalName?: string;
  year: number;
  bonusType: 'BASIC_SALARY' | 'GROSS_SALARY';
  paymentMode?: 'ONE_TIME' | 'TWO_INSTALLMENTS';
  installment1Date?: Date;
  installment2Date?: Date;
  notes?: string;
}

// Create a festival bonus for a single employee.
// For BASIC_SALARY type, bonus = 2× basic salary; for GROSS_SALARY, bonus = 1× basic.
// If TWO_INSTALLMENTS, splits evenly (second installment gets the rounding remainder).
export const createFestivalBonus = async (data: FestivalBonusCreateInput) => {
  const employee = await prisma.employee.findUnique({ where: { id: data.employeeId } });
  if (!employee) throw new Error('Employee not found');

  const basicSalary = new Decimal(Number(employee.salary || 0));
  const totalAmount = data.bonusType === 'BASIC_SALARY' ? basicSalary.mul(2) : basicSalary;

  let installment1Amount: Decimal | null = null;
  let installment2Amount: Decimal | null = null;

  if (data.paymentMode === 'TWO_INSTALLMENTS') {
    installment1Amount = totalAmount.div(2).round();
    installment2Amount = totalAmount.minus(installment1Amount);
  }

  return prisma.festivalBonus.create({
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

export const getFestivalBonuses = async (params: {
  year?: number;
  employeeId?: string;
  festivalType?: string;
  status?: string;
  page?: number;
  limit?: number;
}) => {
  const { year, employeeId, festivalType, status, page = 1, limit = 20 } = params;
  const where: any = {};
  if (year) where.year = year;
  if (employeeId) where.employeeId = employeeId;
  if (festivalType) where.festivalType = festivalType;
  if (status) where.status = status;

  const [bonuses, total] = await Promise.all([
    prisma.festivalBonus.findMany({
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
    prisma.festivalBonus.count({ where })
  ]);

  return { bonuses, total, page, limit, totalPages: Math.ceil(total / limit) };
};

export const getFestivalBonusById = async (id: string) => {
  return prisma.festivalBonus.findUnique({
    where: { id },
    include: {
      employee: {
        select: { id: true, firstName: true, lastName: true, employeeId: true, salary: true, religion: true, department: { select: { name: true } } }
      }
    }
  });
};

export const approveFestivalBonus = async (id: string, approvedBy: string) => {
  const bonus = await prisma.festivalBonus.findUnique({ where: { id } });
  if (!bonus) throw new Error('Festival bonus not found');
  if (bonus.status !== 'PENDING') throw new Error('Bonus is not in pending status');

  return prisma.festivalBonus.update({
    where: { id },
    data: { status: 'APPROVED', approvedBy, approvedAt: new Date() },
    include: { employee: { select: { id: true, firstName: true, lastName: true, employeeId: true } } }
  });
};

// Mark an installment as paid and update the bonus status.
// For ONE_TIME, any payment marks the bonus PAID.
// For TWO_INSTALLMENTS, the bonus is only PAID when both installments are paid.
export const markInstallmentPaid = async (id: string, installmentNumber: 1 | 2) => {
  const bonus = await prisma.festivalBonus.findUnique({ where: { id } });
  if (!bonus) throw new Error('Festival bonus not found');

  const updateData: any = {};

  if (installmentNumber === 1) {
    if (bonus.installment1Status === 'PAID') throw new Error('Installment 1 already paid');
    updateData.installment1Status = 'PAID';
    updateData.installment1Date = new Date();
  } else {
    if (bonus.installment2Status === 'PAID') throw new Error('Installment 2 already paid');
    updateData.installment2Status = 'PAID';
    updateData.installment2Date = new Date();
  }

  if (bonus.paymentMode === 'ONE_TIME') {
    updateData.status = 'PAID';
  } else {
    const inst1Paid = installmentNumber === 1 ? true : bonus.installment1Status === 'PAID';
    const inst2Paid = installmentNumber === 2 ? true : bonus.installment2Status === 'PAID';
    if (inst1Paid && inst2Paid) updateData.status = 'PAID';
  }

  return prisma.festivalBonus.update({
    where: { id },
    data: updateData,
    include: { employee: { select: { id: true, firstName: true, lastName: true, employeeId: true } } }
  });
};

export const cancelFestivalBonus = async (id: string) => {
  const bonus = await prisma.festivalBonus.findUnique({ where: { id } });
  if (!bonus) throw new Error('Festival bonus not found');
  if (bonus.status === 'PAID') throw new Error('Cannot cancel a paid bonus');

  return prisma.festivalBonus.update({
    where: { id },
    data: { status: 'CANCELLED', installment1Status: 'CANCELLED', installment2Status: 'CANCELLED' }
  });
};

export const deleteFestivalBonus = async (id: string) => {
  const bonus = await prisma.festivalBonus.findUnique({ where: { id } });
  if (!bonus) throw new Error('Festival bonus not found');
  if (bonus.status === 'PAID') throw new Error('Cannot delete a paid bonus');
  return prisma.festivalBonus.delete({ where: { id } });
};

export const getFestivalBonusSummary = async (year: number) => {
  const bonuses = await prisma.festivalBonus.findMany({ where: { year } });

  const totalBonus = bonuses.reduce((sum, b) => sum.plus(b.totalAmount), new Decimal(0));
  const paidBonus = bonuses.filter(b => b.status === 'PAID').reduce((sum, b) => sum.plus(b.totalAmount), new Decimal(0));
  const pendingBonus = bonuses.filter(b => b.status === 'PENDING' || b.status === 'APPROVED').reduce((sum, b) => sum.plus(b.totalAmount), new Decimal(0));

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

// Auto-generate festival bonuses for all eligible employees.
// Filters by religion (ISLAM for Eid festivals, others for non-Eid),
// skips employees who already have a bonus of the same type+year,
// and creates individual bonus records with the specified payment mode.
export const autoGenerateFestivalBonuses = async (
  year: number,
  festivalType: 'EID_UL_FITR' | 'EID_UL_ADHA' | 'OTHER',
  bonusType: 'BASIC_SALARY' | 'GROSS_SALARY',
  paymentMode: 'ONE_TIME' | 'TWO_INSTALLMENTS'
) => {
  const eligibleReligions = (festivalType === 'EID_UL_FITR' || festivalType === 'EID_UL_ADHA')
    ? ['ISLAM']
    : ['HINDU', 'BUDDHIST', 'CHRISTIAN', 'OTHER'];

  const employees = await prisma.employee.findMany({
    where: { status: 'ACTIVE', religion: { in: eligibleReligions as any[] } }
  });

  const existing = await prisma.festivalBonus.findMany({
    where: { year, festivalType, employeeId: { in: employees.map(e => e.id) } }
  });
  const existingIds = new Set(existing.map(b => b.employeeId));

  const newBonuses = [];
  for (const emp of employees) {
    if (existingIds.has(emp.id)) continue;

    const basicSalary = new Decimal(Number(emp.salary || 0));
    const totalAmount = bonusType === 'BASIC_SALARY' ? basicSalary.mul(2) : basicSalary;

    let i1: Decimal | null = null;
    let i2: Decimal | null = null;
    if (paymentMode === 'TWO_INSTALLMENTS') {
      i1 = totalAmount.div(2).round();
      i2 = totalAmount.minus(i1);
    }

    const bonus = await prisma.festivalBonus.create({
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
