import React, { useState, useEffect, useCallback } from 'react';
import {
  Card,
  CardHeader,
  CardTitle,
  CardContent,
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
import { Clock, Plus, Pencil, Trash2, Power } from 'lucide-react';
import { api } from '../../services/api';
import { fmtDhakaDate, DHAKA_OFFSET_MS } from '../../lib/format';

const dhakaTodayRange = () => {
  const shifted = new Date(Date.now() + DHAKA_OFFSET_MS);
  const y = shifted.getUTCFullYear();
  const m = shifted.getUTCMonth();
  const d = shifted.getUTCDate();
  const start = Date.UTC(y, m, d) - DHAKA_OFFSET_MS;
  return {
    start: new Date(start).toISOString(),
    end: new Date(start + 24 * 3600 * 1000 - 1).toISOString()
  };
};

const emptyForm = () => ({
  name: '',
  description: '',
  startTime: '09:00',
  endTime: '18:00',
  breakTime: '60',
  isActive: true
});

const ShiftsPage = () => {
  const [shifts, setShifts] = useState<any[]>([]);
  const [assignments, setAssignments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  const [modalOpen, setModalOpen] = useState(false);
  const [editingShift, setEditingShift] = useState<any>(null);
  const [form, setForm] = useState(emptyForm());

  const fetchShifts = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get<any>('/shifts?limit=100');
      setShifts(res.data.shifts || []);
      setError('');
    } catch (e: any) {
      setError(e.message || 'Failed to load shifts');
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchAssignments = useCallback(async () => {
    try {
      const range = dhakaTodayRange();
      const params = new URLSearchParams({ startDate: range.start, endDate: range.end, limit: '100' });
      const res = await api.get<any>(`/shifts/assignments?${params.toString()}`);
      setAssignments(res.data.assignments || []);
    } catch (e) {
      setAssignments([]);
    }
  }, []);

  useEffect(() => {
    fetchShifts();
    fetchAssignments();
  }, [fetchShifts, fetchAssignments]);

  const openAdd = () => {
    setEditingShift(null);
    setForm(emptyForm());
    setModalOpen(true);
  };

  const openEdit = (shift: any) => {
    setEditingShift(shift);
    setForm({
      name: shift.name,
      description: shift.description || '',
      startTime: shift.startTime,
      endTime: shift.endTime,
      breakTime: String(shift.breakTime ?? 0),
      isActive: shift.isActive
    });
    setModalOpen(true);
  };

  const saveShift = async () => {
    if (!form.name || !form.startTime || !form.endTime) {
      alert('Shift name, start and end times are required');
      return;
    }
    setSaving(true);
    try {
      const payload = {
        name: form.name,
        description: form.description || undefined,
        startTime: form.startTime,
        endTime: form.endTime,
        breakTime: Number(form.breakTime) || 0,
        isActive: form.isActive
      };
      if (editingShift) {
        await api.put<any>(`/shifts/${editingShift.id}`, payload);
        alert('Shift updated');
      } else {
        await api.post<any>('/shifts', payload);
        alert('Shift created');
      }
      setModalOpen(false);
      fetchShifts();
    } catch (e: any) {
      alert(e.message || 'Failed to save shift');
    } finally {
      setSaving(false);
    }
  };

  const toggleActive = async (shift: any) => {
    try {
      await api.put<any>(`/shifts/${shift.id}`, { isActive: !shift.isActive });
      fetchShifts();
    } catch (e: any) {
      alert(e.message || 'Failed to update shift');
    }
  };

  const deleteShift = async (shift: any) => {
    if (!window.confirm(`Delete shift "${shift.name}"? This cannot be undone.`)) return;
    try {
      await api.delete<any>(`/shifts/${shift.id}`);
      fetchShifts();
    } catch (e: any) {
      alert(e.message || 'Failed to delete shift');
    }
  };

  const activeCount = shifts.filter(s => s.isActive).length;
  const running = shifts.find(s => s.isActive)?.name || '—';

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold">Shift Management</h2>
          <p className="text-sm text-muted-foreground">Add, edit, delete and save shifts</p>
        </div>
        <Button onClick={openAdd}>
          <Plus className="h-4 w-4 mr-1" />
          Add Shift
        </Button>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardContent className="pt-6">
            <p className="text-2xl font-bold">{shifts.length}</p>
            <p className="text-xs text-muted-foreground">Total Shifts</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <p className="text-2xl font-bold text-green-600">{activeCount}</p>
            <p className="text-xs text-muted-foreground">Active Shifts</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <p className="text-2xl font-bold text-amber-600">{shifts.length - activeCount}</p>
            <p className="text-xs text-muted-foreground">Inactive Shifts</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <p className="text-2xl font-bold">{running}</p>
            <p className="text-xs text-muted-foreground">Current Running Shift</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Shift Definitions</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <p className="text-center text-muted-foreground py-8">Loading...</p>
          ) : error ? (
            <p className="text-center text-red-600 py-8">{error}</p>
          ) : shifts.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">No shifts defined yet. Add one to get started.</p>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {shifts.map(shift => (
                <Card key={shift.id} className="border-border">
                  <CardContent className="pt-6 space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Clock className="h-4 w-4 text-primary" />
                        <span className="font-medium">{shift.name}</span>
                      </div>
                      <Badge variant={shift.isActive ? 'default' : 'secondary'}>
                        {shift.isActive ? 'Running' : 'Inactive'}
                      </Badge>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      {shift.startTime} - {shift.endTime} ({shift.breakTime || 0} min break)
                    </p>
                    {shift.description && (
                      <p className="text-xs text-muted-foreground">{shift.description}</p>
                    )}
                    <div className="flex items-center gap-2 pt-1">
                      <Button variant="outline" size="xs" onClick={() => toggleActive(shift)}>
                        <Power className="h-3 w-3 mr-1" />
                        {shift.isActive ? 'Deactivate' : 'Activate'}
                      </Button>
                      <Button variant="outline" size="xs" onClick={() => openEdit(shift)}>
                        <Pencil className="h-3 w-3 mr-1" />
                        Edit
                      </Button>
                      <Button variant="destructive" size="xs" onClick={() => deleteShift(shift)}>
                        <Trash2 className="h-3 w-3 mr-1" />
                        Delete
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Today's Assignments</CardTitle>
        </CardHeader>
        <CardContent>
          {assignments.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">
              No shift assignments for today. All employees currently run the active shift.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Employee</TableHead>
                  <TableHead>Shift</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Time</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {assignments.map(a => (
                  <TableRow key={a.id}>
                    <TableCell>
                      {a.employee?.firstName} {a.employee?.lastName} ({a.employee?.employeeId})
                    </TableCell>
                    <TableCell>{a.shift?.name}</TableCell>
                    <TableCell>{fmtDhakaDate(a.date)}</TableCell>
                    <TableCell>{a.shift?.startTime} - {a.shift?.endTime}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Add / edit modal */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/50" onClick={() => setModalOpen(false)} />
          <div className="relative w-full max-w-lg rounded-lg bg-card p-6 shadow-xl">
            <h3 className="text-lg font-semibold mb-4">
              {editingShift ? 'Edit Shift' : 'Add Shift'}
            </h3>
            <div className="grid gap-4">
              <div className="space-y-2">
                <Label>Shift Name *</Label>
                <Input
                  value={form.name}
                  onChange={e => setForm({ ...form, name: e.target.value })}
                  placeholder="e.g. Morning Shift"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Start Time *</Label>
                  <Input
                    type="time"
                    value={form.startTime}
                    onChange={e => setForm({ ...form, startTime: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label>End Time *</Label>
                  <Input
                    type="time"
                    value={form.endTime}
                    onChange={e => setForm({ ...form, endTime: e.target.value })}
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Break Time (minutes)</Label>
                <Input
                  type="number"
                  min="0"
                  value={form.breakTime}
                  onChange={e => setForm({ ...form, breakTime: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>Description</Label>
                <Input
                  value={form.description}
                  onChange={e => setForm({ ...form, description: e.target.value })}
                  placeholder="Optional notes about this shift"
                />
              </div>
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={form.isActive}
                  onChange={e => setForm({ ...form, isActive: e.target.checked })}
                />
                Active shift (used for attendance calculations)
              </label>
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setModalOpen(false)}>Cancel</Button>
                <Button onClick={saveShift} disabled={saving}>
                  {saving ? 'Saving...' : editingShift ? 'Save Changes' : 'Create Shift'}
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export { ShiftsPage };