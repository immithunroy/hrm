import React, { useState, useEffect, useCallback } from 'react';
import {
  Card,
  CardHeader,
  CardTitle,
  CardContent,
  CardFooter,
  Button,
  Badge,
  Input,
  Label,
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableCell,
  TableHead
} from '@/components/ui';
import { Plus, Check, X } from 'lucide-react';
import { api } from '../../services/api';
import { LEAVE_STATUS_STYLES, ACCENT_BG } from '../../lib/colors';
import { fmtDhakaDate } from '../../lib/format';

const LEAVE_TYPES = ['VACATION', 'SICK', 'PERSONAL', 'MATERNITY', 'PATERNITY', 'BEREAVEMENT', 'JURY_DUTY', 'MILITARY', 'UNPAID'];

const emptyForm = () => ({
  employeeId: '',
  leaveType: 'VACATION',
  startDate: '',
  endDate: '',
  reason: ''
});

const LeavePage = () => {
  const [leaveRequests, setLeaveRequests] = useState<any[]>([]);
  const [employees, setEmployees] = useState<any[]>([]);
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [modalOpen, setModalOpen] = useState(false);
  const [form, setForm] = useState(emptyForm());
  const [saving, setSaving] = useState(false);
  const [processingId, setProcessingId] = useState<string | null>(null);

  const fetchLeave = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get<any>('/leave?limit=200');
      setLeaveRequests(res.data.leaveRequests || []);
      setError('');
    } catch (e: any) {
      setError(e.message || 'Failed to load leave requests');
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchStats = useCallback(async () => {
    try {
      const res = await api.get<any>('/leave/stats');
      setStats(res.data?.statistics || null);
    } catch (e) {
      setStats(null);
    }
  }, []);

  const fetchEmployees = useCallback(async () => {
    try {
      const res = await api.get<any>('/employees?limit=500&status=ACTIVE');
      setEmployees(res.data.employees || []);
    } catch (e) {
      console.warn('Failed to load employees:', e);
    }
  }, []);

  useEffect(() => {
    fetchLeave();
    fetchStats();
    fetchEmployees();
  }, [fetchLeave, fetchStats, fetchEmployees]);

  const openAdd = () => {
    setForm({ ...emptyForm(), employeeId: employees[0]?.id || '' });
    setModalOpen(true);
  };

  const saveRequest = async () => {
    if (!form.employeeId || !form.startDate || !form.endDate || !form.reason) {
      alert('Employee, dates and reason are required');
      return;
    }
    if (form.endDate < form.startDate) {
      alert('End date must be after start date');
      return;
    }
    setSaving(true);
    try {
      await api.post<any>('/leave', form);
      alert('Leave request created');
      setModalOpen(false);
      fetchLeave();
      fetchStats();
    } catch (e: any) {
      alert(e.message || 'Failed to create leave request');
    } finally {
      setSaving(false);
    }
  };

  const decide = async (id: string, action: 'approve' | 'reject') => {
    setProcessingId(id);
    try {
      await api.patch<any>(`/leave/${id}/${action}`, {});
      fetchLeave();
      fetchStats();
    } catch (e: any) {
      alert(e.message || 'Action failed');
    } finally {
      setProcessingId(null);
    }
  };

  const pending = leaveRequests.filter(r => r.status === 'PENDING').length;
  const approved = leaveRequests.filter(r => r.status === 'APPROVED').length;
  const rejected = leaveRequests.filter(r => r.status === 'REJECTED').length;
  const totalDaysApproved = leaveRequests.filter(r => r.status === 'APPROVED').reduce((s, r) => s + (r.daysRequested || 0), 0);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold">Leave Management</h2>
          <p className="text-sm text-muted-foreground">Review and approve leave requests</p>
        </div>
        <Button onClick={openAdd}>
          <Plus className="h-4 w-4 mr-1" />
          New Leave Request
        </Button>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardContent className="pt-6 flex items-center gap-3">
            <div className={`flex h-10 w-10 items-center justify-center rounded-lg ${ACCENT_BG.yellow}`}>
              <p className="text-sm font-bold">P</p>
            </div>
            <div>
              <p className="text-2xl font-bold">{pending}</p>
              <p className="text-xs text-muted-foreground">Pending Requests</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6 flex items-center gap-3">
            <div className={`flex h-10 w-10 items-center justify-center rounded-lg ${ACCENT_BG.green}`}>
              <Check className="h-5 w-5" />
            </div>
            <div>
              <p className="text-2xl font-bold">{approved}</p>
              <p className="text-xs text-muted-foreground">Approved</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6 flex items-center gap-3">
            <div className={`flex h-10 w-10 items-center justify-center rounded-lg ${ACCENT_BG.red}`}>
              <X className="h-5 w-5" />
            </div>
            <div>
              <p className="text-2xl font-bold">{rejected}</p>
              <p className="text-xs text-muted-foreground">Rejected</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6 flex items-center gap-3">
            <div className={`flex h-10 w-10 items-center justify-center rounded-lg ${ACCENT_BG.blue}`}>
              <p className="text-sm font-bold">D</p>
            </div>
            <div>
              <p className="text-2xl font-bold">{totalDaysApproved}</p>
              <p className="text-xs text-muted-foreground">Approved Days</p>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Leave Requests</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <p className="text-center text-muted-foreground py-8">Loading...</p>
          ) : error ? (
            <p className="text-center text-red-600 py-8">{error}</p>
          ) : leaveRequests.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">No leave requests found</p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Employee</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Start</TableHead>
                    <TableHead>End</TableHead>
                    <TableHead>Days</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {leaveRequests.map(request => (
                    <TableRow key={request.id}>
                      <TableCell className="font-medium">
                        {request.employee?.firstName} {request.employee?.lastName}
                        <p className="text-xs text-muted-foreground">{request.employee?.employeeId}</p>
                      </TableCell>
                      <TableCell>{request.leaveType}</TableCell>
                      <TableCell>{fmtDhakaDate(request.startDate)}</TableCell>
                      <TableCell>{fmtDhakaDate(request.endDate)}</TableCell>
                      <TableCell>{request.daysRequested ?? request.days}</TableCell>
                      <TableCell>
                        <Badge className={`${LEAVE_STATUS_STYLES[request.status] || ''} border-transparent`}>
                          {request.status}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex justify-end gap-2">
                          {request.status === 'PENDING' && (
                            <>
                              <Button
                                variant="outline"
                                size="xs"
                                onClick={() => decide(request.id, 'approve')}
                                disabled={processingId === request.id}
                              >
                                <Check className="h-3 w-3 mr-1" /> Approve
                              </Button>
                              <Button
                                variant="destructive"
                                size="xs"
                                onClick={() => decide(request.id, 'reject')}
                                disabled={processingId === request.id}
                              >
                                <X className="h-3 w-3 mr-1" /> Reject
                              </Button>
                            </>
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
        <CardFooter className="justify-end">
          <p className="text-sm text-muted-foreground">
            {stats ? `${stats.totalRequests} total requests · ${stats.totalDaysRequested || 0} days requested` : ''}
          </p>
        </CardFooter>
      </Card>

      {/* New leave request modal */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/50" onClick={() => setModalOpen(false)} />
          <div className="relative w-full max-w-lg rounded-lg bg-card p-6 shadow-xl">
            <h3 className="text-lg font-semibold mb-4">New Leave Request</h3>
            <div className="grid gap-4">
              <div className="space-y-2">
                <Label>Employee *</Label>
                <select
                  value={form.employeeId}
                  onChange={e => setForm({ ...form, employeeId: e.target.value })}
                  className="w-full rounded-lg border bg-background px-3 py-2 text-sm"
                >
                  {employees.map(emp => (
                    <option key={emp.id} value={emp.id}>
                      {emp.firstName} {emp.lastName} ({emp.employeeId})
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-2">
                <Label>Leave Type *</Label>
                <select
                  value={form.leaveType}
                  onChange={e => setForm({ ...form, leaveType: e.target.value })}
                  className="w-full rounded-lg border bg-background px-3 py-2 text-sm"
                >
                  {LEAVE_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Start Date *</Label>
                  <Input
                    type="date"
                    value={form.startDate}
                    onChange={e => setForm({ ...form, startDate: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label>End Date *</Label>
                  <Input
                    type="date"
                    value={form.endDate}
                    onChange={e => setForm({ ...form, endDate: e.target.value })}
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Reason *</Label>
                <Input value={form.reason} onChange={e => setForm({ ...form, reason: e.target.value })} />
              </div>
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setModalOpen(false)}>Cancel</Button>
                <Button onClick={saveRequest} disabled={saving}>
                  {saving ? 'Saving...' : 'Create Request'}
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export { LeavePage };