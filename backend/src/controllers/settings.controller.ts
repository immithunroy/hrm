import { Request, Response, NextFunction } from 'express';
import { getPayrollSettings, updatePayrollSettings } from '../services/settings.service';
import { prisma } from '../config/database';

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

/**
 * GET /api/settings/roles — list all employees with their current role.
 */
export const getRoles = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const employees = await prisma.employee.findMany({
      select: {
        id: true,
        employeeId: true,
        firstName: true,
        lastName: true,
        email: true,
        role: true,
        department: { select: { name: true } }
      },
      orderBy: { employeeId: 'asc' }
    });
    res.status(200).json({ success: true, data: employees });
  } catch (error) {
    next(error);
  }
};

/**
 * PUT /api/settings/roles — update an employee's role.
 * Body: { employeeId: string, role: string }
 */
export const updateRole = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { employeeId, role } = req.body;
    if (!employeeId || !role) {
      return res.status(400).json({ success: false, message: 'employeeId and role are required' });
    }
    const validRoles = ['ADMIN', 'HR', 'MANAGER', 'FINANCE', 'EMPLOYEE'];
    if (!validRoles.includes(role)) {
      return res.status(400).json({ success: false, message: `Invalid role. Must be one of: ${validRoles.join(', ')}` });
    }

    const employee = await prisma.employee.findUnique({ where: { id: employeeId } });
    if (!employee) {
      return res.status(404).json({ success: false, message: 'Employee not found' });
    }

    // Prevent self-role-change entirely — only another admin should change roles.
    if (employeeId === req.userId) {
      return res.status(400).json({ success: false, message: 'Cannot change your own role. Ask another admin to do it.' });
    }

    // Prevent non-admins from assigning ADMIN role
    if (role === 'ADMIN' && req.userRole !== 'ADMIN') {
      return res.status(403).json({ success: false, message: 'Only ADMIN can assign ADMIN role' });
    }

    const updated = await prisma.employee.update({
      where: { id: employeeId },
      data: { role },
      select: { id: true, employeeId: true, firstName: true, lastName: true, role: true }
    });

    res.status(200).json({ success: true, data: updated });
  } catch (error) {
    next(error);
  }
};

export default { getSettings, updateSettings, getRoles, updateRole };
