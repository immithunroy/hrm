/**
 * Task Routes
 * 
 * Manages task assignment and tracking for employees.
 * 
 * All routes require authentication. Authorization varies by role:
 *   - ADMIN/MANAGER/HR: Full CRUD access (create, update, delete tasks)
 *   - EMPLOYEE: Read access to all tasks, update own tasks, cannot delete
 * 
 * Endpoints:
 *   GET  /     - List all tasks (paginated, filterable)
 *   GET  /my   - Get tasks assigned to current user
 *   GET  /:id  - Get task by ID
 *   POST /     - Create new task (admin/manager/HR only)
 *   PUT  /:id  - Update task (all roles, but employees can only update own tasks)
 *   DELETE /:id - Delete task (admin/manager only)
 */

import { Router } from 'express';
import {
  getMyTasks,
  getAllTasks,
  getTaskById,
  createTask,
  updateTask,
  deleteTask
} from '../controllers/task.controller';
import { authenticateToken, authorize } from '../middleware/authenticateToken';
import { validateRequest } from '../middleware/validateRequest';
import { createTaskSchema, updateTaskSchema } from '../schemas/task.schema';

const router = Router();

// Protect all routes — authentication required for every endpoint
router.use(authenticateToken);

// Task listing (all roles can view)
router.get('/', authorize('ADMIN', 'MANAGER', 'HR', 'EMPLOYEE'), getAllTasks);
router.get('/my', authorize('ADMIN', 'MANAGER', 'HR', 'EMPLOYEE'), getMyTasks);

// Individual task operations
router.get('/:id', authorize('ADMIN', 'MANAGER', 'HR', 'EMPLOYEE'), getTaskById);
router.post('/', authorize('ADMIN', 'MANAGER', 'HR'), validateRequest(createTaskSchema), createTask);
router.put('/:id', authorize('ADMIN', 'MANAGER', 'HR', 'EMPLOYEE'), validateRequest(updateTaskSchema), updateTask);
router.delete('/:id', authorize('ADMIN', 'MANAGER'), deleteTask);

export default router;
