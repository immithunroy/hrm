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

router.use(authenticateToken);

// Employee sees own tasks, admin/manager sees all
router.get('/', authorize('ADMIN', 'MANAGER', 'HR', 'EMPLOYEE'), getAllTasks);
router.get('/my', authorize('ADMIN', 'MANAGER', 'HR', 'EMPLOYEE'), getMyTasks);
router.get('/:id', authorize('ADMIN', 'MANAGER', 'HR', 'EMPLOYEE'), getTaskById);
router.post('/', authorize('ADMIN', 'MANAGER', 'HR'), validateRequest(createTaskSchema), createTask);
router.put('/:id', authorize('ADMIN', 'MANAGER', 'HR', 'EMPLOYEE'), validateRequest(updateTaskSchema), updateTask);
router.delete('/:id', authorize('ADMIN', 'MANAGER'), deleteTask);

export default router;
