/**
 * Task validation schemas
 * - createTaskSchema: task creation with title, priority, assignment, and optional category
 * - updateTaskSchema: status/priority updates (TODO -> IN_PROGRESS -> COMPLETED/CANCELLED)
 */

import { z } from 'zod';

export const createTaskSchema = z.object({
  title: z.string().min(1, 'Title is required').max(200),
  description: z.string().max(2000).optional(), // Free-form, up to 2000 chars
  priority: z.enum(['LOW', 'MEDIUM', 'HIGH', 'URGENT']).optional(),
  assignedTo: z.string().optional(),
  dueDate: z.string().optional(),
  category: z.string().max(100).optional(),
  // Polymorphic relation: link task to any entity type
  relatedId: z.string().optional(),
  relatedType: z.string().max(50).optional(), // e.g., "employee", "project"
  notes: z.string().max(1000).optional()
});

export const updateTaskSchema = z.object({
  status: z.enum(['TODO', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED']).optional(),
  priority: z.enum(['LOW', 'MEDIUM', 'HIGH', 'URGENT']).optional(),
  notes: z.string().max(1000).optional()
});

export default { createTaskSchema, updateTaskSchema };
