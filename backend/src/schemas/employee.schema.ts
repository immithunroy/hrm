/**
 * Employee validation schemas
 * - employeeSchema: full employee creation with all personal, employment, and payroll fields
 * - updateEmployeeSchema: partial update of any employee fields
 */

import { z } from 'zod';

export const employeeSchema = z.object({
  firstName: z.string().min(1, 'First name is required'),
  lastName: z.string().min(1, 'Last name is required'),
  middleName: z.string().optional(),
  email: z.string().email('Invalid email format'),
  // Alphanumeric with dots, hyphens, underscores only
  username: z.string().min(1, 'Username is required').regex(/^[a-zA-Z0-9._-]+$/, 'Username must contain only letters, numbers, dots, hyphens, or underscores'),
  phone: z.string().optional(),
  dateOfBirth: z.string().optional(),
  gender: z.enum(['MALE', 'FEMALE', 'OTHER']).optional(),
  maritalStatus: z.enum(['SINGLE', 'MARRIED', 'DIVORCED', 'WIDOWED']).optional(),
  hireDate: z.string().optional(),
  employeeId: z.string().min(1, 'Employee ID is required').optional(),
  departmentId: z.string().min(1, 'Department ID is required'),
  positionId: z.string().min(1, 'Position ID is required'),
  employmentType: z.enum(['FULL_TIME', 'PART_TIME', 'CONTRACT', 'INTERN', 'TEMPORARY']),
  salary: z.number().min(0, 'Salary must be positive').optional(),
  salaryType: z.enum(['GROSS', 'SCALED']).optional(),
  basicScale: z.number().min(0).optional(),
  // Percentage-based allowances (0-100)
  accommodationRate: z.number().min(0).max(100).optional(),
  medicalRate: z.number().min(0).max(100).optional(),
  transportRate: z.number().min(0).max(100).optional(),
  mobileInternet: z.number().min(0).optional(),
  bankAccountNumber: z.string().optional(),
  bankName: z.string().optional(),
  emergencyContactName: z.string().optional(),
  emergencyContactPhone: z.string().optional(),
  address: z.string().optional(),
  city: z.string().optional(),
  state: z.string().optional(),
  zipCode: z.string().optional(),
  country: z.string().optional(),
  // Nullable because user may not have provided ID yet
  govtIdType: z.enum(['NID', 'DRIVING_LICENSE', 'PASSPORT']).nullable().optional(),
  govtIdNumber: z.string().optional(),
  profileImageUrl: z.string().optional(),
  idDocumentUrl: z.string().optional(),
  cvUrl: z.string().optional(),
  employmentEndDate: z.string().optional(),
  status: z.enum(['ACTIVE', 'INACTIVE', 'ON_LEAVE', 'TERMINATED', 'RESIGNED', 'RETIRED', 'SUSPENDED']).optional(),
  weeklyHoliday: z.enum(['MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY', 'SUNDAY']).optional(),
  attendanceExempt: z.boolean().optional(),
  payrollExempt: z.boolean().optional(),
  pin: z.string().optional(),
  password: z.string().optional()
});

export const updateEmployeeSchema = employeeSchema.partial();

export default { employeeSchema, updateEmployeeSchema };
