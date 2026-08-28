import React, { useState, useEffect, useCallback } from 'react';
import { api } from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import { fmtDhakaDate } from '../../lib/format';
import {
  Card,
  CardHeader,
  CardTitle,
  CardContent,
  Button,
  Input,
  Label,
  Badge,
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableCell,
  TableHead,
} from '@/components/ui';
import { Plus, Trash2, CheckCircle, Clock, AlertCircle, XCircle } from 'lucide-react';

const STATUS_STYLES: Record<string, string> = {
  PENDING: 'bg-yellow-100 text-yellow-800',
  IN_PROGRESS: 'bg-blue-100 text-blue-800',
  COMPLETED: 'bg-green-100 text-green-800',
  CANCELLED: 'bg-red-100 text-red-800',
};

const PRIORITY_STYLES: Record<string, string> = {
  LOW: 'bg-gray-100 text-gray-800',
  MEDIUM: 'bg-blue-100 text-blue-800',
  HIGH: 'bg-orange-100 text-orange-800',
  URGENT: 'bg-red-100 text-red-800',
};

const CATEGORIES = ['HRM', 'CUSTOMER', 'NETWORK', 'FIELD'];

const TasksPage = () => {
  const { user } = useAuth();
  const [tasks, setTasks] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');

  const [showCreateModal, setShowCreateModal] = useState(false);
  const [employees, setEmployees] = useState<any[]>([]);
  const [creating, setCreating] = useState(false);
  const [createForm, setCreateForm] = useState({
    title: '',
    description: '',
    priority: 'MEDIUM',
    assignedTo: '',
    dueDate: '',
    category: '',
    notes: '',
  });

  const canCreate = user?.role === 'ADMIN' || user?.role === 'MANAGER' || user?.role === 'HR';
  const canDelete = user?.role === 'ADMIN' || user?.role === 'MANAGER';

  const fetchTasks = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ limit: '100' });
      if (statusFilter) params.set('status', statusFilter);
      if (categoryFilter) params.set('category', categoryFilter);
      const res = await api.get<any>(`/tasks?${params.toString()}`);
      setTasks(res.data?.tasks || []);
      setError('');
    } catch (e: any) {
      setError(e.message || 'Failed to load tasks');
    } finally {
      setLoading(false);
    }
  }, [statusFilter, categoryFilter]);

  const fetchEmployees = useCallback(async () => {
    try {
      const res = await api.get<any>('/employees?limit=200');
      setEmployees(res.data?.employees || res.data || []);
    } catch {
      // optional
    }
  }, []);

  useEffect(() => {
    fetchTasks();
  }, [fetchTasks]);

  useEffect(() => {
    if (showCreateModal) fetchEmployees();
  }, [showCreateModal, fetchEmployees]);

  const createTask = async () => {
    if (!createForm.title.trim()) return;
    setCreating(true);
    try {
      await api.post('/tasks', {
        title: createForm.title,
        description: createForm.description || undefined,
        priority: createForm.priority,
        assignedTo: createForm.assignedTo || undefined,
        dueDate: createForm.dueDate || undefined,
        category: createForm.category || undefined,
        notes: createForm.notes || undefined,
      });
      setShowCreateModal(false);
      setCreateForm({ title: '', description: '', priority: 'MEDIUM', assignedTo: '', dueDate: '', category: '', notes: '' });
      fetchTasks();
    } catch (e: any) {
      alert(e.message || 'Failed to create task');
    } finally {
      setCreating(false);
    }
  };

  const updateTaskStatus = async (id: string, status: string) => {
    try {
      await api.put(`/tasks/${id}`, { status });
      fetchTasks();
    } catch (e: any) {
      alert(e.message || 'Failed to update task');
    }
  };

  const deleteTask = async (id: string) => {
    if (!confirm('Delete this task?')) return;
    try {
      await api.delete(`/tasks/${id}`);
      fetchTasks();
    } catch (e: any) {
      alert(e.message || 'Failed to delete task');
    }
  };

  const statusIcon = (status: string) => {
    switch (status) {
      case 'COMPLETED': return <CheckCircle className="h-4 w-4 text-green-600" />;
      case 'IN_PROGRESS': return <Clock className="h-4 w-4 text-blue-600" />;
      case 'CANCELLED': return <XCircle className="h-4 w-4 text-red-600" />;
      default: return <AlertCircle className="h-4 w-4 text-yellow-600" />;
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Tasks</h1>
        {canCreate && (
          <Button onClick={() => setShowCreateModal(true)}>
            <Plus className="mr-2 h-4 w-4" /> New Task
          </Button>
        )}
      </div>

      <div className="flex gap-3 flex-wrap">
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="h-10 rounded-md border border-input bg-background px-3 text-sm"
        >
          <option value="">All Status</option>
          <option value="PENDING">Pending</option>
          <option value="IN_PROGRESS">In Progress</option>
          <option value="COMPLETED">Completed</option>
          <option value="CANCELLED">Cancelled</option>
        </select>
        <select
          value={categoryFilter}
          onChange={(e) => setCategoryFilter(e.target.value)}
          className="h-10 rounded-md border border-input bg-background px-3 text-sm"
        >
          <option value="">All Categories</option>
          {CATEGORIES.map((c) => (
            <option key={c} value={c}>{c}</option>
          ))}
        </select>
      </div>

      {error && <div className="bg-destructive/10 text-destructive rounded-lg p-3 text-sm">{error}</div>}

      <Card>
        <CardContent className="p-0">
          {loading ? (
            <div className="p-8 text-center text-muted-foreground">Loading...</div>
          ) : tasks.length === 0 ? (
            <div className="p-8 text-center text-muted-foreground">No tasks found</div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Status</TableHead>
                    <TableHead>Title</TableHead>
                    <TableHead>Priority</TableHead>
                    <TableHead>Category</TableHead>
                    <TableHead>Assigned To</TableHead>
                    <TableHead>Created By</TableHead>
                    <TableHead>Due Date</TableHead>
                    <TableHead className="w-[100px]">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {tasks.map((task) => (
                    <TableRow key={task.id}>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          {statusIcon(task.status)}
                          <Badge className={STATUS_STYLES[task.status] || ''}>
                            {task.status?.replace('_', ' ')}
                          </Badge>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div>
                          <p className="font-medium">{task.title}</p>
                          {task.description && (
                            <p className="text-xs text-muted-foreground mt-1 line-clamp-1">{task.description}</p>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge className={PRIORITY_STYLES[task.priority] || ''}>
                          {task.priority}
                        </Badge>
                      </TableCell>
                      <TableCell>{task.category || '-'}</TableCell>
                      <TableCell>
                        {task.assignee
                          ? `${task.assignee.firstName} ${task.assignee.lastName}`
                          : <span className="text-muted-foreground">Unassigned</span>}
                      </TableCell>
                      <TableCell>
                        {task.creator
                          ? `${task.creator.firstName} ${task.creator.lastName}`
                          : '-'}
                      </TableCell>
                      <TableCell>
                        {task.dueDate ? fmtDhakaDate(task.dueDate) : '-'}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          {task.status !== 'COMPLETED' && task.status !== 'CANCELLED' && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => updateTaskStatus(task.id, 'COMPLETED')}
                              title="Mark Complete"
                            >
                              <CheckCircle className="h-4 w-4 text-green-600" />
                            </Button>
                          )}
                          {task.status === 'PENDING' && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => updateTaskStatus(task.id, 'IN_PROGRESS')}
                              title="Start Task"
                            >
                              <Clock className="h-4 w-4 text-blue-600" />
                            </Button>
                          )}
                          {canDelete && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => deleteTask(task.id)}
                              title="Delete"
                            >
                              <Trash2 className="h-4 w-4 text-destructive" />
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-card rounded-lg border shadow-lg p-6 w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <h2 className="text-lg font-semibold mb-4">Create Task</h2>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="task-title">Title *</Label>
                <Input
                  id="task-title"
                  value={createForm.title}
                  onChange={(e) => setCreateForm({ ...createForm, title: e.target.value })}
                  placeholder="Task title"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="task-desc">Description</Label>
                <textarea
                  id="task-desc"
                  value={createForm.description}
                  onChange={(e) => setCreateForm({ ...createForm, description: e.target.value })}
                  placeholder="Task description"
                  rows={3}
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Priority</Label>
                  <select
                    value={createForm.priority}
                    onChange={(e) => setCreateForm({ ...createForm, priority: e.target.value })}
                    className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                  >
                    <option value="LOW">Low</option>
                    <option value="MEDIUM">Medium</option>
                    <option value="HIGH">High</option>
                    <option value="URGENT">Urgent</option>
                  </select>
                </div>
                <div className="space-y-2">
                  <Label>Category</Label>
                  <select
                    value={createForm.category}
                    onChange={(e) => setCreateForm({ ...createForm, category: e.target.value })}
                    className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                  >
                    <option value="">None</option>
                    {CATEGORIES.map((c) => (
                      <option key={c} value={c}>{c}</option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Assign To</Label>
                  <select
                    value={createForm.assignedTo}
                    onChange={(e) => setCreateForm({ ...createForm, assignedTo: e.target.value })}
                    className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                  >
                    <option value="">Unassigned</option>
                    {employees.map((emp: any) => (
                      <option key={emp.id} value={emp.id}>
                        {emp.firstName} {emp.lastName}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="space-y-2">
                  <Label>Due Date</Label>
                  <Input
                    type="date"
                    value={createForm.dueDate}
                    onChange={(e) => setCreateForm({ ...createForm, dueDate: e.target.value })}
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="task-notes">Notes</Label>
                <textarea
                  id="task-notes"
                  value={createForm.notes}
                  onChange={(e) => setCreateForm({ ...createForm, notes: e.target.value })}
                  placeholder="Additional notes"
                  rows={2}
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                />
              </div>
            </div>
            <div className="flex justify-end gap-2 mt-6">
              <Button variant="outline" onClick={() => setShowCreateModal(false)}>Cancel</Button>
              <Button onClick={createTask} disabled={creating || !createForm.title.trim()}>
                {creating ? 'Creating...' : 'Create Task'}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default TasksPage;
