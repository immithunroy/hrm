import { z } from 'zod';

export const createTaskSchema = z.object({
  title: z.string().min(1, 'Title is required').max(200),
  description: z.string().max(2000).optional(),
  priority: z.enum(['LOW', 'MEDIUM', 'HIGH', 'URGENT']).optional(),
  assignedTo: z.string().optional(),
  dueDate: z.string().optional(),
  category: z.string().max(100).optional(),
  relatedId: z.string().optional(),
  relatedType: z.string().max(50).optional(),
  notes: z.string().max(1000).optional()
});

export const updateTaskSchema = z.object({
  status: z.enum(['TODO', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED']).optional(),
  priority: z.enum(['LOW', 'MEDIUM', 'HIGH', 'URGENT']).optional(),
  notes: z.string().max(1000).optional()
});

export default { createTaskSchema, updateTaskSchema };
