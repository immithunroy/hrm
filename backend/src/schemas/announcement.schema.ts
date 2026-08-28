import { z } from 'zod';

export const createAnnouncementSchema = z.object({
  title: z.string().min(1, 'Title is required').max(200),
  content: z.string().min(1, 'Content is required').max(5000),
  priority: z.enum(['LOW', 'NORMAL', 'HIGH', 'URGENT']).optional(),
  startsAt: z.string().optional(),
  expiresAt: z.string().optional()
});

export const updateAnnouncementSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  content: z.string().min(1).max(5000).optional(),
  priority: z.enum(['LOW', 'NORMAL', 'HIGH', 'URGENT']).optional(),
  isActive: z.boolean().optional(),
  startsAt: z.string().optional(),
  expiresAt: z.string().optional()
});

export default { createAnnouncementSchema, updateAnnouncementSchema };
