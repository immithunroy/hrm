/**
 * AttendancePage - Daily attendance tracking and management page.
 *
 * Features:
 * - Attendance records list with employee filter and date range selection
 * - View modes: Today, This Week, This Month, Custom date range
 * - Manual attendance entry modal (add/edit) with Dhaka timezone support
 * - Sync attendance from ZKT biometric device
 * - Export attendance to Excel (xlsx) or PDF
 * - Summary stats: Present, Late, Early Departure, Total Records
 * - Auto-generated (synthetic) records shown with "auto" label
 *
 * Complex state:
 * - Dhaka timezone (UTC+6) handling for all date/time conversions
 * - Wall-clock to UTC ISO conversion for attendance punches
 * - View mode switching with automatic range calculation
 */

import React, { useState, useEffect, useCallback } from 'react';
import { api } from '../../services/api';
import {
  Card,
  CardHeader,
  CardTitle,
  CardContent,
  Button,
  Input,
  Label,
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableCell,
  TableHead
} from '@/components/ui';
import { FileSpreadsheet, FileText, Plus, Pencil, Trash2 } from 'lucide-react';
import { STATUS_STYLES, attendanceStatusLabel, ATTENDANCE_STATUS_LABELS } from '../../lib/colors';
import { fmtHM, fmtHMFromMinutes, dhakaWeekdayShort } from '../../lib/format';

type ViewMode = 'today' | 'week' | 'month' | 'range';

const formatTime = (value: any) => {
  if (!value) return '—';
  const d = new Date(value);
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
};

const formatDate = (value: any) => {
  if (!value) return '—';
  return new Date(value).toLocaleDateString();
};

const DHAKA_OFFSET_MS = 6 * 3600 * 1000;

const getDhakaDate = (d: Date) => {
  const shifted = new Date(d.getTime() + DHAKA_OFFSET_MS);
  return { y: shifted.getUTCFullYear(), m: shifted.getUTCMonth(), day: shifted.getUTCDate() };
};

const dhakaDayRange = (d: Date) => {
  const { y, m, day } = getDhakaDate(d);
  const start = Date.UTC(y, m, day) - DHAKA_OFFSET_MS;
  return {
    start: new Date(start).toISOString(),
    end: new Date(start + 24 * 3600 * 1000 - 1).toISOString()
  };
};

const dhakaDateRange = (dateStr: string) => {
  const [y, m, d] = dateStr.split('-').map(Number);
  const start = Date.UTC(y, m - 1, d) - DHAKA_OFFSET_MS;
  return {
    start: new Date(start).toISOString(),
    end: new Date(start + 24 * 3600 * 1000 - 1).toISOString()
  };
};

const getRangeForView = (view: ViewMode) => {
  const now = new Date();
  if (view === 'week') {
    const startDate = new Date(now.getTime() - 6 * 24 * 3600 * 1000);
    return { start: dhakaDayRange(startDate).start, end: dhakaDayRange(now).end };
  }
  if (view === 'month') {
    // Show the full calendar month (1st to last day) in Dhaka time
    const { y, m } = getDhakaDate(now);
    const monthStart = Date.UTC(y, m, 1) - DHAKA_OFFSET_MS;
    const monthEnd = Date.UTC(y, m + 1, 0) - DHAKA_OFFSET_MS + 24 * 3600 * 1000 - 1;
    return { start: new Date(monthStart).toISOString(), end: new Date(monthEnd).toISOString() };
  }
  return dhakaDayRange(now);
};

// Convert a Dhaka wall-clock (YYYY-MM-DD + HH:MM) into a UTC ISO instant.
const dhakaWallClockToISO = (dateStr: string, timeStr: string) => {
  const [y, m, d] = dateStr.split('-').map(Number);
  const [hh, mm] = timeStr.split(':').map(Number);
  return new Date(Date.UTC(y, m - 1, d, hh - 6, mm || 0)).toISOString();
};

// Extract Dhaka wall-clock date + time from an ISO instant.
const isoToDhakaInputs = (value: any) => {
  if (!value) return { date: '', time: '' };
  const d = new Date(value);
  const shifted = new Date(d.getTime() + DHAKA_OFFSET_MS);
  const date = `${shifted.getUTCFullYear()}-${String(shifted.getUTCMonth() + 1).padStart(2, '0')}-${String(shifted.getUTCDate()).padStart(2, '0')}`;
  const time = `${String(shifted.getUTCHours()).padStart(2, '0')}:${String(shifted.getUTCMinutes()).padStart(2, '0')}`;
  return { date, time };
};

const AttendancePage = () => {
  const [attendance, setAttendance] = useState<any[]>([]);
  const [employees, setEmployees] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [view, setView] = useState<ViewMode>('today');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [employeeId, setEmployeeId] = useState('');
  const [range, setRange] = useState(() => getRangeForView('today'));
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [limit] = useState(50);
  const [syncing, setSyncing] = useState(false);
  const [exporting, setExporting] = useState<string | null>(null);

  const [modalOpen, setModalOpen] = useState(false);
  const [editingRecord, setEditingRecord] = useState<any>(null);
  const [form, setForm] = useState({
    employeeId: '',
    date: '',
    checkIn: '',
    checkOut: '',
    breakMinutes: '0',
    status: ''
  });
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const fetchEmployees = useCallback(async () => {
    try {
      const res = await api.get<any>('/employees?limit=500&status=ACTIVE');
      setEmployees(res.data.employees || []);
    } catch (e) {
      console.warn('Failed to load employees:', e);
    }
  }, []);

  useEffect(() => {
    fetchEmployees();
  }, [fetchEmployees]);

  const buildQuery = useCallback(() => {
    const params = new URLSearchParams();
    params.set('startDate', range.start);
    params.set('endDate', range.end);
    if (employeeId) params.set('employeeId', employeeId);
    return params;
  }, [range, employeeId]);

  const fetchAttendance = useCallback(async () => {
    setLoading(true);
    try {
      const params = buildQuery();
      params.set('page', String(page));
      params.set('limit', String(limit));
      const res = await api.get<any>(`/attendance?${params.toString()}`);
      setAttendance(res.data.attendanceRecords || []);
      setTotal(res.data.pagination?.total || 0);
      setError('');
    } catch (e: any) {
      setError(e.message || 'Failed to load attendance');
    } finally {
      setLoading(false);
    }
  }, [buildQuery, page, limit]);

  useEffect(() => {
    fetchAttendance();
  }, [fetchAttendance]);

  const applyDate = (which: 'from' | 'to', value: string) => {
    const from = which === 'from' ? value : fromDate;
    const to = which === 'to' ? value : toDate;
    setFromDate(from);
    setToDate(to);

    setView('range');
    if (from && to) {
      const a = from < to ? from : to;
      const b = from < to ? to : from;
      setRange({ start: dhakaDateRange(a).start, end: dhakaDateRange(b).end });
    } else if (from) {
      setRange(dhakaDateRange(from));
    } else if (to) {
      setRange(dhakaDateRange(to));
    }
    setPage(1);
  };

  const handleSync = async () => {
    setSyncing(true);
    try {
      const res = await api.post<any>('/devices/sync', {});
      setSyncing(false);
      alert(res.data?.message || 'Attendance synced from device');
      fetchAttendance();
    } catch (e: any) {
      setSyncing(false);
      alert(e.message || 'Sync failed');
    }
  };

  const handleExport = async (format: string) => {
    setExporting(format);
    try {
      const params = buildQuery();
      await api.download(`/attendance/export?${params.toString()}&format=${format}`, `attendance.${format}`);
    } catch (e: any) {
      alert(e.message || 'Export failed');
    } finally {
      setExporting(null);
    }
  };

  const openAdd = () => {
    setEditingRecord(null);
    setForm({
      employeeId: employees[0]?.id || '',
      date: new Date().toISOString().slice(0, 10),
      checkIn: '',
      checkOut: '',
      breakMinutes: '0',
      status: ''
    });
    setModalOpen(true);
  };

  const openEdit = (record: any) => {
    setEditingRecord(record);
    const inInputs = isoToDhakaInputs(record.checkIn);
    const outInputs = isoToDhakaInputs(record.checkOut);
    setForm({
      employeeId: record.employeeId,
      date: inInputs.date || isoToDhakaInputs(record.date).date,
      checkIn: inInputs.time,
      checkOut: outInputs.time,
      breakMinutes: String(record.breakMinutes ?? 0),
      status: record.status || ''
    });
    setModalOpen(true);
  };

  const saveRecord = async () => {
    if (!form.employeeId || !form.date) {
      alert('Employee and date are required');
      return;
    }
    setSaving(true);
    try {
      const payload: any = {
        employeeId: form.employeeId,
        date: form.date,
        breakMinutes: Number(form.breakMinutes) || 0
      };
      if (form.checkIn) payload.checkIn = dhakaWallClockToISO(form.date, form.checkIn);
      if (form.checkOut) payload.checkOut = dhakaWallClockToISO(form.date, form.checkOut);
      if (form.status) payload.status = form.status.toUpperCase();

      if (editingRecord) {
        await api.put<any>(`/attendance/${editingRecord.id}`, payload);
        alert('Attendance updated');
      } else {
        await api.post<any>('/attendance', payload);
        alert('Attendance added');
      }
      setModalOpen(false);
      fetchAttendance();
    } catch (e: any) {
      alert(e.message || 'Failed to save attendance');
    } finally {
      setSaving(false);
    }
  };

  const deleteRecord = async (record: any) => {
    if (!window.confirm(`Delete attendance for ${record.employee?.firstName || ''} ${record.employee?.lastName || ''} on ${formatDate(record.date)}?`)) return;
    setDeletingId(record.id);
    try {
      await api.delete<any>(`/attendance/${record.id}`);
      fetchAttendance();
    } catch (e: any) {
      alert(e.message || 'Failed to delete record');
    } finally {
      setDeletingId(null);
    }
  };

  const presentCount = attendance.filter(r => r.status === 'PRESENT').length;
  const lateCount = attendance.filter(r => r.status === 'LATE').length;
  const earlyCount = attendance.filter(r => r.status === 'EARLY').length;
  const totalPages = Math.max(1, Math.ceil(total / limit));

  const viewLabel =
    view === 'today' ? 'Today' :
    view === 'week' ? 'This Week (7 days)' :
    view === 'month' ? (() => { const { y, m } = getDhakaDate(new Date()); return new Date(y, m).toLocaleString('en-US', { month: 'long', year: 'numeric' }); })() :
    fromDate && toDate ? `${fromDate} to ${toDate}` :
    fromDate || toDate ? (fromDate || toDate) : 'Custom';

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3">
        <div className="flex flex-col lg:flex-row lg:items-center gap-3">
          <div className="shrink-0 lg:w-80">
            <h2 className="text-xl font-bold">Attendance</h2>
            <p className="text-sm text-muted-foreground">Daily attendance tracking from ZKT device + manual entry</p>
          </div>
          <div className="flex flex-wrap items-end gap-2 flex-1 min-w-0">
            <div className="flex flex-col gap-1 min-w-[150px] flex-1">
              <span className="text-[11px] text-muted-foreground">Employee</span>
              <select
                value={employeeId}
                onChange={(e) => { setEmployeeId(e.target.value); setPage(1); }}
                className="h-9 w-full rounded-lg border bg-background px-2 text-sm"
              >
                <option value="">All Employees</option>
                {employees.map(emp => (
                  <option key={emp.id} value={emp.id}>
                    {emp.firstName} {emp.lastName} ({emp.employeeId})
                  </option>
                ))}
              </select>
            </div>
            <div className="flex flex-col gap-1 min-w-[140px] flex-1">
              <span className="text-[11px] text-muted-foreground">From</span>
              <Input
                type="date"
                value={fromDate}
                onChange={(e) => applyDate('from', e.target.value)}
                className="h-9 w-full"
              />
            </div>
            <div className="flex flex-col gap-1 min-w-[140px] flex-1">
              <span className="text-[11px] text-muted-foreground">To</span>
              <Input
                type="date"
                value={toDate}
                onChange={(e) => applyDate('to', e.target.value)}
                className="h-9 w-full"
              />
            </div>
            <div className="shrink-0">
              <Button size="sm" variant="outline" className="px-3" onClick={() => handleExport('xlsx')} disabled={!!exporting}>
                <FileSpreadsheet className="h-4 w-4 mr-1" />
                {exporting === 'xlsx' ? 'Exporting...' : 'Excel'}
              </Button>
            </div>
            <div className="shrink-0">
              <Button size="sm" variant="outline" className="px-3" onClick={() => handleExport('pdf')} disabled={!!exporting}>
                <FileText className="h-4 w-4 mr-1" />
                {exporting === 'pdf' ? 'Exporting...' : 'PDF'}
              </Button>
            </div>
            <div className="shrink-0">
              <Button size="sm" className="px-3" onClick={handleSync} disabled={syncing}>
                {syncing ? 'Syncing...' : 'Sync from Device'}
              </Button>
            </div>
            <div className="shrink-0">
              <Button size="sm" className="px-3" onClick={openAdd}>
                <Plus className="h-4 w-4 mr-1" />
                Manual Entry
              </Button>
            </div>
          </div>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardContent className="pt-6">
            <p className="text-2xl font-bold text-green-600">{presentCount}</p>
            <p className="text-xs text-muted-foreground">Present</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <p className="text-2xl font-bold text-orange-600">{lateCount}</p>
            <p className="text-xs text-muted-foreground">Late</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <p className="text-2xl font-bold text-blue-600">{earlyCount}</p>
            <p className="text-xs text-muted-foreground">Early Departure</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <p className="text-2xl font-bold">{total.toLocaleString()}</p>
            <p className="text-xs text-muted-foreground">Records in range</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Attendance Records - {viewLabel}</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <p className="text-center text-muted-foreground py-8">Loading...</p>
          ) : error ? (
            <p className="text-center text-red-600 py-8">{error}</p>
          ) : attendance.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">No attendance records found</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Employee</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Day</TableHead>
                  <TableHead>In</TableHead>
                  <TableHead>Out</TableHead>
                  <TableHead>Errand</TableHead>
                  <TableHead>Work</TableHead>
                  <TableHead>OT</TableHead>
                  <TableHead>Early OT</TableHead>
                  <TableHead>Late (min)</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="w-24">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {attendance.map(record => (
                  <TableRow key={record.id}>
                    <TableCell>
                      <p className="font-medium">
                        {record.employee?.firstName} {record.employee?.lastName}
                      </p>
                      <p className="text-xs text-muted-foreground">{record.employee?.employeeId}</p>
                    </TableCell>
                    <TableCell>{formatDate(record.date)}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">{dhakaWeekdayShort(record.date)}</TableCell>
                    <TableCell>{formatTime(record.checkIn)}</TableCell>
                    <TableCell>{formatTime(record.checkOut)}{record.autoCheckOut ? ' (auto)' : ''}</TableCell>
                    <TableCell>{fmtHMFromMinutes(record.breakMinutes)}</TableCell>
                    <TableCell>{fmtHM(record.workHours)}</TableCell>
                    <TableCell>{fmtHM(record.overtimeHours)}</TableCell>
                    <TableCell>{fmtHM(record.earlyOvertimeHours)}</TableCell>
                    <TableCell>{record.lateMinutes ?? '—'}</TableCell>
                    <TableCell>
                      <span className={`px-2 py-1 text-xs rounded-full ${STATUS_STYLES[record.status] || STATUS_STYLES.PRESENT}`}>
                        {attendanceStatusLabel(record.status)}
                      </span>
                    </TableCell>
                    <TableCell>
                      {record.synthetic ? (
                        <span className="text-xs text-muted-foreground">auto</span>
                      ) : (
                      <div className="flex gap-1">
                        <Button variant="outline" size="xs" onClick={() => openEdit(record)}>
                          <Pencil className="h-3 w-3" />
                        </Button>
                        <Button
                          variant="destructive"
                          size="xs"
                          onClick={() => deleteRecord(record)}
                          disabled={deletingId === record.id}
                        >
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </div>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
          <div className="flex items-center justify-between pt-4">
            <p className="text-sm text-muted-foreground">
              Showing {attendance.length} of {total.toLocaleString()} records
            </p>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage(p => p - 1)}>
                Previous
              </Button>
              <span className="text-sm text-muted-foreground">
                Page {page} of {totalPages}
              </span>
              <Button variant="outline" size="sm" disabled={page >= totalPages} onClick={() => setPage(p => p + 1)}>
                Next
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Manual entry / edit modal */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/50" onClick={() => setModalOpen(false)} />
          <div className="relative w-full max-w-lg max-h-[90vh] overflow-y-auto rounded-lg bg-card p-6 shadow-xl">
            <h3 className="text-lg font-semibold mb-4">
              {editingRecord ? 'Edit Attendance' : 'Manual Attendance Entry'}
            </h3>
            <div className="grid gap-4">
              <div className="space-y-2">
                <Label>Employee</Label>
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
                <Label>Date (Dhaka)</Label>
                <Input
                  type="date"
                  value={form.date}
                  onChange={e => setForm({ ...form, date: e.target.value })}
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Sign In (Dhaka time)</Label>
                  <Input
                    type="time"
                    value={form.checkIn}
                    onChange={e => setForm({ ...form, checkIn: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Sign Out (Dhaka time)</Label>
                  <Input
                    type="time"
                    value={form.checkOut}
                    onChange={e => setForm({ ...form, checkOut: e.target.value })}
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Errand / Break (minutes)</Label>
                <Input
                  type="number"
                  value={form.breakMinutes}
                  onChange={e => setForm({ ...form, breakMinutes: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>Status (optional)</Label>
                <select
                  value={form.status}
                  onChange={e => setForm({ ...form, status: e.target.value.toUpperCase() })}
                  className="w-full rounded-lg border bg-background px-3 py-2 text-sm"
                >
                  <option value="">Auto (from punches)</option>
                  {Object.keys(ATTENDANCE_STATUS_LABELS).map(s => (
                    <option key={s} value={s}>{ATTENDANCE_STATUS_LABELS[s]}</option>
                  ))}
                </select>
              </div>
              <p className="text-xs text-muted-foreground">
                Leave a status blank to auto-calculate from the active shift. A status-only entry (no in/out times) records a LEAVE, ABSENT, HOLIDAY, HALF or WEEKEND day.
              </p>
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setModalOpen(false)}>Cancel</Button>
                <Button onClick={saveRecord} disabled={saving}>
                  {saving ? 'Saving...' : editingRecord ? 'Save Changes' : 'Add Record'}
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export { AttendancePage };