/**
 * HolidaysPage - Official holiday management page.
 *
 * Features:
 * - Holiday listing for a selected month with date and name
 * - Add individual holiday with date picker and name
 * - Bulk upload holidays via textarea (format: YYYY-MM-DD, Name)
 * - Sync Bangladesh government holidays from external source
 * - Delete individual holidays
 * - Month selector for navigation between periods
 *
 * State management:
 * - Bulk upload with line-by-line validation before API call
 * - Sync message display for operation feedback
 */

import React, { useState, useEffect, useCallback } from 'react';
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
import { CalendarDays, Plus, Trash2, Upload, RefreshCw } from 'lucide-react';
import { api } from '../../services/api';

const currentMonth = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
};

const HolidaysPage = () => {
  const [month, setMonth] = useState(currentMonth());
  const [holidays, setHolidays] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [newDate, setNewDate] = useState('');
  const [newName, setNewName] = useState('');
  const [adding, setAdding] = useState(false);

  const [bulkText, setBulkText] = useState('');
  const [bulkError, setBulkError] = useState('');
  const [bulking, setBulking] = useState(false);
  const [bulkResult, setBulkResult] = useState('');

  const [deleting, setDeleting] = useState<string | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [syncMsg, setSyncMsg] = useState('');

  const fetchHolidays = useCallback(async () => {
    setLoading(true);
    try {
      const [y, m] = month.split('-').map(Number);
      const res = await api.get<any>(`/holidays?year=${y}&month=${m}`);
      setHolidays(res.data?.holidays || []);
      setError('');
    } catch (e: any) {
      setError(e.message || 'Failed to load holidays');
    } finally {
      setLoading(false);
    }
  }, [month]);

  useEffect(() => {
    fetchHolidays();
  }, [fetchHolidays]);

  const addHoliday = async () => {
    if (!newDate) {
      alert('Select a date');
      return;
    }
    setAdding(true);
    try {
      await api.post<any>('/holidays', { date: newDate, name: newName || 'Holiday' });
      setNewDate('');
      setNewName('');
      fetchHolidays();
    } catch (e: any) {
      alert(e.message || 'Failed to add holiday');
    } finally {
      setAdding(false);
    }
  };

  const bulkUpload = async () => {
    const lines = bulkText
      .split('\n')
      .map(l => l.trim())
      .filter(Boolean);
    const holidaysArr: Array<{ date: string; name: string }> = [];
    for (const line of lines) {
      const [date, ...nameParts] = line.split(',');
      if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date.trim())) {
        setBulkError(`Invalid line: "${line}" — expected "YYYY-MM-DD, Holiday Name"`);
        return;
      }
      holidaysArr.push({ date: date.trim(), name: nameParts.join(',').trim() || 'Holiday' });
    }
    if (holidaysArr.length === 0) {
      setBulkError('No valid lines');
      return;
    }
    setBulking(true);
    setBulkError('');
    setBulkResult('');
    try {
      const res = await api.post<any>('/holidays/bulk', { holidays: holidaysArr });
      const r = res.data;
      setBulkResult(r?.created != null ? `Uploaded ${r.created} holiday(s)${r.skipped ? ` (${r.skipped} already existed)` : ''}` : 'Holidays added');
      setBulkText('');
      fetchHolidays();
    } catch (e: any) {
      setBulkError(e.message || 'Bulk upload failed');
    } finally {
      setBulking(false);
    }
  };

  const removeHoliday = async (id: string) => {
    if (!window.confirm('Delete this holiday?')) return;
    setDeleting(id);
    try {
      await api.delete<any>(`/holidays/${id}`);
      fetchHolidays();
    } catch (e: any) {
      alert(e.message || 'Failed to delete holiday');
    } finally {
      setDeleting(null);
    }
  };

  const syncGoogle = async () => {
    setSyncing(true);
    setSyncMsg('');
    try {
      const res = await api.post<any>('/holidays/sync-google', {});
      setSyncMsg(res.data?.message || 'Bangladesh government holidays synced');
      fetchHolidays();
    } catch (e: any) {
      setSyncMsg(e.message || 'Google sync failed');
    } finally {
      setSyncing(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold">Holidays</h2>
          <p className="text-sm text-muted-foreground">
            Mark official holidays each month — holiday overtime is paid at the holiday rate
          </p>
        </div>
        <Input
          type="month"
          value={month}
          onChange={(e) => setMonth(e.target.value)}
          className="w-auto"
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Plus className="h-4 w-4" />
              Add Holiday
            </CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>Date</Label>
              <Input type="date" value={newDate} onChange={(e) => setNewDate(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Name</Label>
              <Input
                placeholder="e.g. Independence Day"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
              />
            </div>
            <Button onClick={addHoliday} disabled={adding} className="sm:col-span-2">
              {adding ? 'Adding...' : 'Add Holiday'}
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Upload className="h-4 w-4" />
              Bulk Upload (one per line)
            </CardTitle>
          </CardHeader>
          <CardContent className="grid gap-3">
            <textarea
              rows={6}
              placeholder={'2026-01-21, Eid ul-Fitr\n2026-03-26, Independence Day'}
              value={bulkText}
              onChange={(e) => setBulkText(e.target.value)}
              className="w-full rounded-lg border bg-background px-3 py-2 text-sm font-mono"
            />
            <p className="text-xs text-muted-foreground">Format: YYYY-MM-DD, Holiday Name</p>
            {bulkError && <p className="text-sm text-red-600">{bulkError}</p>}
            {bulkResult && <p className="text-sm text-green-600">{bulkResult}</p>}
            <Button variant="outline" onClick={bulkUpload} disabled={bulking}>
              {bulking ? 'Uploading...' : 'Upload Holidays'}
            </Button>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-3">
          <CardTitle className="flex items-center gap-2">
            <CalendarDays className="h-4 w-4" />
            Holidays — {month}
          </CardTitle>
          <Button variant="outline" size="sm" onClick={syncGoogle} disabled={syncing}>
            <RefreshCw className={`h-4 w-4 mr-1 ${syncing ? 'animate-spin' : ''}`} />
            {syncing ? 'Syncing...' : 'Sync Govt Holidays'}
          </Button>
        </CardHeader>
        <CardContent>
          {syncMsg && <p className="text-sm text-muted-foreground mb-3">{syncMsg}</p>}
          {loading ? (
            <p className="text-center text-muted-foreground py-8">Loading...</p>
          ) : error ? (
            <p className="text-center text-red-600 py-8">{error}</p>
          ) : holidays.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">
              No holidays marked for this month
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Name</TableHead>
                  <TableHead className="w-20">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {holidays.map(h => (
                  <TableRow key={h.id}>
                    <TableCell className="font-medium">{h.date}</TableCell>
                    <TableCell>{h.name}</TableCell>
                    <TableCell>
                      <Button
                        variant="destructive"
                        size="xs"
                        onClick={() => removeHoliday(h.id)}
                        disabled={deleting === h.id}
                      >
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export { HolidaysPage };