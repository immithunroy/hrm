import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
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
import {
  ArrowLeft,
  Mail,
  Phone,
  MapPin,
  Calendar,
  Clock,
  FileSpreadsheet,
  FileText,
  Save,
  Pencil,
  Cpu,
  Fingerprint,
  Lock,
  Trash2,
  UserX,
  UserMinus,
  Award,
  Upload,
  CreditCard,
  Image as ImageIcon
} from 'lucide-react';
import { api } from '../../services/api';
import { EMPLOYEE_STATUS_STYLES, STATUS_STYLES, attendanceStatusLabel } from '../../lib/colors';
import { fmtHM, fmtHMFromMinutes, fmtMoney, dhakaWeekdayShort } from '../../lib/format';

type ViewMode = 'today' | 'week' | 'month' | 'range';

const DHAKA_OFFSET_MS = 6 * 3600 * 1000;

const getDhakaDate = (d: Date) => {
  const shifted = new Date(d.getTime() + DHAKA_OFFSET_MS);
  return { y: shifted.getUTCFullYear(), m: shifted.getUTCMonth(), day: shifted.getUTCDate() };
};

const dhakaDayRange = (d: Date) => {
  const { y, m, day } = getDhakaDate(d);
  const start = Date.UTC(y, m, day) - DHAKA_OFFSET_MS;
  return { start: new Date(start).toISOString(), end: new Date(start + 24 * 3600 * 1000 - 1).toISOString() };
};

const dhakaDateRange = (dateStr: string) => {
  const [y, m, d] = dateStr.split('-').map(Number);
  const start = Date.UTC(y, m - 1, d) - DHAKA_OFFSET_MS;
  return { start: new Date(start).toISOString(), end: new Date(start + 24 * 3600 * 1000 - 1).toISOString() };
};

const getRangeForView = (view: ViewMode) => {
  const now = new Date();
  if (view === 'week') {
    const startDate = new Date(now.getTime() - 6 * 24 * 3600 * 1000);
    return { start: dhakaDayRange(startDate).start, end: dhakaDayRange(now).end };
  }
  if (view === 'month') {
    const startDate = new Date(now.getTime() - 29 * 24 * 3600 * 1000);
    return { start: dhakaDayRange(startDate).start, end: dhakaDayRange(now).end };
  }
  return dhakaDayRange(now);
};

const formatTime = (value: any) => {
  if (!value) return '—';
  return new Date(value).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
};

const formatDate = (value: any) => {
  if (!value) return '—';
  return new Date(value).toLocaleDateString();
};

const toDateInput = (value: any) => {
  if (!value) return '';
  const d = new Date(value);
  if (isNaN(d.getTime())) return '';
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

const GENDER_OPTIONS = ['MALE', 'FEMALE', 'OTHER'];
const MARITAL_OPTIONS = ['SINGLE', 'MARRIED', 'DIVORCED', 'WIDOWED'];
const EMPLOYMENT_TYPES = ['FULL_TIME', 'PART_TIME', 'CONTRACT', 'INTERN', 'TEMPORARY'];
const EMPLOYEE_STATUSES = ['ACTIVE', 'INACTIVE', 'ON_LEAVE', 'TERMINATED', 'RESIGNED', 'RETIRED', 'SUSPENDED'];
const GOVT_ID_TYPES = ['NID', 'DRIVING_LICENSE', 'PASSPORT'];

const emptyForm = () => ({
  firstName: '',
  lastName: '',
  middleName: '',
  email: '',
  phone: '',
  dateOfBirth: '',
  gender: 'MALE',
  maritalStatus: 'SINGLE',
  hireDate: toDateInput(new Date()),
  employeeId: '',
  departmentId: '',
  positionId: '',
  employmentType: 'FULL_TIME',
  salary: '',
  salaryType: 'GROSS',
  basicScale: '',
  accommodationRate: '50',
  medicalRate: '25',
  transportRate: '15',
  mobileInternet: '',
  bankAccountNumber: '',
  bankName: '',
  emergencyContactName: '',
  emergencyContactPhone: '',
  address: '',
  city: '',
  state: '',
  zipCode: '',
  country: '',
  status: 'ACTIVE',
  weeklyHoliday: 'FRIDAY',
  attendanceExempt: false,
  payrollExempt: false,
  govtIdType: '',
  govtIdNumber: '',
  pin: '',
  password: ''
});

const EmployeeDetailPage = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const isNew = !id;

  const [employee, setEmployee] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [meta, setMeta] = useState<any>(null);
  const [editing, setEditing] = useState(isNew);
  const [form, setForm] = useState(emptyForm());
  const [saving, setSaving] = useState(false);

  const [syncing, setSyncing] = useState(false);
  const [enrolling, setEnrolling] = useState(false);
  const [deviceMsg, setDeviceMsg] = useState('');

  const [view, setView] = useState<ViewMode>('month');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [range, setRange] = useState(() => getRangeForView('month'));
  const [attendance, setAttendance] = useState<any[]>([]);
  const [attLoading, setAttLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [limit] = useState(20);
  const [exporting, setExporting] = useState<string | null>(null);

  const [leave, setLeave] = useState<any>(null);
  const [casualTotal, setCasualTotal] = useState(0);
  const [medicalTotal, setMedicalTotal] = useState(0);
  const [savingLeave, setSavingLeave] = useState(false);

  const [uploading, setUploading] = useState<string | null>(null);
  const [actionBusy, setActionBusy] = useState<string | null>(null);

  // Load form meta (departments/positions/defaults)
  useEffect(() => {
    api.get<any>('/employees/meta')
      .then(res => {
        const m = res.data;
        setMeta(m);
        const deptId = m.departments[0]?.id || '';
        const posId = m.positions[0]?.id || '';
        setForm(f => ({
          ...f,
          departmentId: f.departmentId || deptId,
          positionId: f.positionId || posId,
          weeklyHoliday: m.defaultWeeklyHoliday || 'FRIDAY'
        }));
      })
      .catch(() => { /* meta is non-critical */ });
  }, []);

  useEffect(() => {
    if (!id) {
      setLoading(false);
      return;
    }
    const load = async () => {
      setLoading(true);
      try {
        const res = await api.get<any>(`/employees/${id}`);
        setEmployee(res.data);
        setError('');
      } catch (e: any) {
        setError(e.message || 'Failed to load employee');
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [id]);

  const startEditing = () => {
    const e = employee || {};
    setForm({
      firstName: e.firstName || '',
      lastName: e.lastName || '',
      middleName: e.middleName || '',
      email: e.email || '',
      phone: e.phone || '',
      dateOfBirth: toDateInput(e.dateOfBirth),
      gender: e.gender || 'MALE',
      maritalStatus: e.maritalStatus || 'SINGLE',
      hireDate: toDateInput(e.hireDate) || toDateInput(new Date()),
      employeeId: e.employeeId || '',
      departmentId: e.departmentId || meta?.departments[0]?.id || '',
      positionId: e.positionId || meta?.positions[0]?.id || '',
      employmentType: e.employmentType || 'FULL_TIME',
      salary: e.salary != null ? String(e.salary) : '',
      salaryType: e.salaryType || 'GROSS',
      basicScale: e.basicScale != null ? String(e.basicScale) : '',
      accommodationRate: e.accommodationRate != null ? String(e.accommodationRate) : '50',
      medicalRate: e.medicalRate != null ? String(e.medicalRate) : '25',
      transportRate: e.transportRate != null ? String(e.transportRate) : '15',
      mobileInternet: e.mobileInternet != null ? String(e.mobileInternet) : '',
      bankAccountNumber: e.bankAccountNumber || '',
      bankName: e.bankName || '',
      emergencyContactName: e.emergencyContactName || '',
      emergencyContactPhone: e.emergencyContactPhone || '',
      address: e.address || '',
      city: e.city || '',
      state: e.state || '',
      zipCode: e.zipCode || '',
      country: e.country || '',
      status: e.status || 'ACTIVE',
      weeklyHoliday: e.weeklyHoliday || meta?.defaultWeeklyHoliday || 'FRIDAY',
      attendanceExempt: !!e.attendanceExempt,
      payrollExempt: !!e.payrollExempt,
      govtIdType: e.govtIdType || '',
      govtIdNumber: e.govtIdNumber || '',
      pin: e.pin || '',
      password: ''
    });
    setEditing(true);
  };

  const saveEmployee = async () => {
    if (!form.firstName || !form.lastName || !form.email) {
      alert('First name, last name and email are required');
      return;
    }
    if (isNew && !form.departmentId) {
      alert('Department is required');
      return;
    }
    setSaving(true);
    try {
      const raw: any = {
        ...form,
        salary: form.salary ? Number(form.salary) : undefined,
        basicScale: form.basicScale ? Number(form.basicScale) : undefined,
        accommodationRate: form.accommodationRate ? Number(form.accommodationRate) : undefined,
        medicalRate: form.medicalRate ? Number(form.medicalRate) : undefined,
        transportRate: form.transportRate ? Number(form.transportRate) : undefined,
        mobileInternet: form.mobileInternet ? Number(form.mobileInternet) : undefined,
      };
      // Strip empty strings so optional/enum Zod fields pass validation
      const payload: any = {};
      for (const [k, v] of Object.entries(raw)) {
        if (v === '') continue;
        payload[k] = v;
      }
      if (!payload.password) delete payload.password;
      if (isNew) {
        const res = await api.post<any>('/employees', payload);
        alert('Employee created');
        navigate(`/employees/${res.data.id}`, { replace: true });
      } else {
        await api.put<any>(`/employees/${id}`, payload);
        alert('Employee updated');
        const res = await api.get<any>(`/employees/${id}`);
        setEmployee(res.data);
        setEditing(false);
      }
    } catch (e: any) {
      alert(e.message || 'Failed to save employee');
    } finally {
      setSaving(false);
    }
  };

  const syncToDevice = async () => {
    if (!id) return;
    setSyncing(true);
    setDeviceMsg('');
    try {
      const res = await api.post<any>(`/devices/users/${id}/sync`, {});
      const d = res.data;
      setDeviceMsg(d?.uid != null ? `Synced to device — UID ${d.uid} (${d.userId})` : 'User synced to device');
    } catch (e: any) {
      setDeviceMsg(e.message || 'Sync failed');
    } finally {
      setSyncing(false);
    }
  };

  const enrollFingerprint = async () => {
    if (!id) return;
    setEnrolling(true);
    setDeviceMsg('');
    try {
      const res = await api.post<any>(`/devices/users/${id}/enroll`, {});
      const d = res.data;
      setDeviceMsg(
        d?.saved ? `Fingerprint enrolled — UID ${d.uid}, finger ${d.fingerIndex}` : 'Fingerprint enrolled'
      );
    } catch (e: any) {
      setDeviceMsg(e.message || 'Enrollment failed');
    } finally {
      setEnrolling(false);
    }
  };

  const fetchLeave = useCallback(async () => {
    if (!id) return;
    try {
      const res = await api.get<any>(`/employees/${id}/leave-balance`);
      setLeave(res.data);
      setCasualTotal(res.data.casualTotal);
      setMedicalTotal(res.data.medicalTotal);
    } catch (e) {
      console.warn('Failed to load leave balance:', e);
    }
  }, [id]);

  useEffect(() => {
    fetchLeave();
  }, [fetchLeave]);

  const fetchAttendance = useCallback(async () => {
    if (!id) return;
    setAttLoading(true);
    try {
      const params = new URLSearchParams({ page: String(page), limit: String(limit) });
      params.set('employeeId', id);
      params.set('startDate', range.start);
      params.set('endDate', range.end);
      const res = await api.get<any>(`/attendance?${params.toString()}`);
      setAttendance(res.data.attendanceRecords || []);
      setTotal(res.data.pagination?.total || 0);
    } catch (e: any) {
      setAttendance([]);
      setTotal(0);
    } finally {
      setAttLoading(false);
    }
  }, [id, range, page, limit]);

  useEffect(() => {
    fetchAttendance();
  }, [fetchAttendance]);

  const selectView = (v: ViewMode) => {
    setView(v);
    setFromDate('');
    setToDate('');
    setRange(getRangeForView(v));
    setPage(1);
  };

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

  const handleExport = async (format: string) => {
    if (!id) return;
    setExporting(format);
    try {
      const params = new URLSearchParams();
      params.set('employeeId', id);
      params.set('startDate', range.start);
      params.set('endDate', range.end);
      await api.download(`/attendance/export?${params.toString()}&format=${format}`, `attendance-${format}`);
    } catch (e: any) {
      alert(e.message || 'Export failed');
    } finally {
      setExporting(null);
    }
  };

  const saveLeave = async () => {
    if (!id) return;
    setSavingLeave(true);
    try {
      const year = new Date().getFullYear();
      await api.put<any>(`/employees/${id}/leave-balance`, {
        year,
        casualTotal: Number(casualTotal) || 0,
        medicalTotal: Number(medicalTotal) || 0
      });
      alert('Leave balance updated');
      fetchLeave();
    } catch (e: any) {
      alert(e.message || 'Failed to save leave balance');
    } finally {
      setSavingLeave(false);
    }
  };

  const uploadDocument = async (file: File, type: 'PHOTO' | 'ID' | 'CV') => {
    if (!id) return;
    setUploading(type);
    try {
      const reader = new FileReader();
      const dataUrl = await new Promise<string>((resolve, reject) => {
        reader.onload = () => resolve(String(reader.result));
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });
      const res = await api.post<any>(`/employees/${id}/documents`, {
        data: dataUrl,
        filename: file.name,
        type
      });
      setEmployee(res.data);
      alert('Document uploaded');
    } catch (e: any) {
      alert(e.message || 'Upload failed');
    } finally {
      setUploading(null);
    }
  };

  const employmentAction = async (action: 'terminate' | 'resign' | 'retire') => {
    if (!id) return;
    const labels: Record<string, string> = { terminate: 'Terminate', resign: 'Resign', retire: 'Retire' };
    const confirmed = window.confirm(
      `${labels[action]} ${employee.firstName} ${employee.lastName}? This changes their employment status and records the end date.`
    );
    if (!confirmed) return;
    setActionBusy(action);
    try {
      const res = await api.post<any>(`/employees/${id}/${action}`, { endDate: new Date().toISOString() });
      setEmployee(res.data);
      alert(`Employee ${labels[action].toLowerCase()}d`);
    } catch (e: any) {
      alert(e.message || `Failed to ${action} employee`);
    } finally {
      setActionBusy(null);
    }
  };

  const deleteEmployee = async () => {
    if (!id) return;
    const confirmed = window.confirm(
      `PERMANENTLY DELETE ${employee.firstName} ${employee.lastName}?\n\nThis removes the employee and ALL their attendance, payroll, leave and device data. This cannot be undone.`
    );
    if (!confirmed) return;
    setActionBusy('delete');
    try {
      await api.delete(`/employees/${id}`);
      alert('Employee deleted');
      navigate('/employees');
    } catch (e: any) {
      alert(e.message || 'Failed to delete employee');
    } finally {
      setActionBusy(null);
    }
  };

  const setField = (key: string, value: any) => setForm(f => ({ ...f, [key]: value }));

  const renderFormFields = (
    <>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <div className="space-y-2">
          <Label>First Name *</Label>
          <Input value={form.firstName} onChange={e => setField('firstName', e.target.value)} />
        </div>
        <div className="space-y-2">
          <Label>Last Name *</Label>
          <Input value={form.lastName} onChange={e => setField('lastName', e.target.value)} />
        </div>
        <div className="space-y-2">
          <Label>Middle Name</Label>
          <Input value={form.middleName} onChange={e => setField('middleName', e.target.value)} />
        </div>
        <div className="space-y-2">
          <Label>Email *</Label>
          <Input type="email" value={form.email} onChange={e => setField('email', e.target.value)} />
        </div>
        <div className="space-y-2">
          <Label>Phone</Label>
          <Input value={form.phone} onChange={e => setField('phone', e.target.value)} />
        </div>
        <div className="space-y-2">
          <Label>Employee ID (max 9 chars for device)</Label>
          <Input value={form.employeeId} onChange={e => setField('employeeId', e.target.value)} />
        </div>
        <div className="space-y-2">
          <Label>Govt. Photo ID Type</Label>
          <select
            value={form.govtIdType}
            onChange={e => setField('govtIdType', e.target.value)}
            className="w-full rounded-lg border bg-background px-3 py-2 text-sm"
          >
            <option value="">None</option>
            {GOVT_ID_TYPES.map(t => (
              <option key={t} value={t}>{t.replace('_', ' ')}</option>
            ))}
          </select>
        </div>
        <div className="space-y-2">
          <Label>Govt. Photo ID Number</Label>
          <Input
            value={form.govtIdNumber}
            onChange={e => setField('govtIdNumber', e.target.value)}
            placeholder={form.govtIdType === 'DRIVING_LICENSE' ? 'e.g. DL-1234567890' : form.govtIdType === 'PASSPORT' ? 'e.g. BB1234567' : 'NID / DL / Passport number'}
          />
        </div>
        <div className="space-y-2">
          <Label>Department *</Label>
          <select
            value={form.departmentId}
            onChange={e => setField('departmentId', e.target.value)}
            className="w-full rounded-lg border bg-background px-3 py-2 text-sm"
          >
            {(meta?.departments || []).map((d: any) => (
              <option key={d.id} value={d.id}>{d.name}</option>
            ))}
          </select>
        </div>
        <div className="space-y-2">
          <Label>Position *</Label>
          <select
            value={form.positionId}
            onChange={e => setField('positionId', e.target.value)}
            className="w-full rounded-lg border bg-background px-3 py-2 text-sm"
          >
            {(meta?.positions || []).map((p: any) => (
              <option key={p.id} value={p.id}>{p.title}</option>
            ))}
          </select>
        </div>
        <div className="space-y-2">
          <Label>Employment Type</Label>
          <select
            value={form.employmentType}
            onChange={e => setField('employmentType', e.target.value)}
            className="w-full rounded-lg border bg-background px-3 py-2 text-sm"
          >
            {EMPLOYMENT_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
          </select>
        </div>
        <div className="space-y-2">
          <Label>Salary Type</Label>
          <select
            value={form.salaryType}
            onChange={e => setField('salaryType', e.target.value)}
            className="w-full rounded-lg border bg-background px-3 py-2 text-sm"
          >
            <option value="GROSS">Gross Salary</option>
            <option value="SCALED">Scaled Salary</option>
          </select>
        </div>
        {form.salaryType === 'GROSS' ? (
          <div className="space-y-2">
            <Label>Gross Salary</Label>
            <Input type="number" value={form.salary} onChange={e => setField('salary', e.target.value)} />
          </div>
        ) : (
          <>
            <div className="space-y-2">
              <Label>Basic Scale</Label>
              <Input type="number" value={form.basicScale} onChange={e => setField('basicScale', e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Accommodation (%)</Label>
              <Input type="number" value={form.accommodationRate} onChange={e => setField('accommodationRate', e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Medical (%)</Label>
              <Input type="number" value={form.medicalRate} onChange={e => setField('medicalRate', e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Transport (%)</Label>
              <Input type="number" value={form.transportRate} onChange={e => setField('transportRate', e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Mobile & Internet</Label>
              <Input type="number" value={form.mobileInternet} onChange={e => setField('mobileInternet', e.target.value)} />
            </div>
          </>
        )}
        <div className="space-y-2">
          <Label>Hire Date</Label>
          <Input type="date" value={form.hireDate} onChange={e => setField('hireDate', e.target.value)} />
        </div>
        <div className="space-y-2">
          <Label>Date of Birth</Label>
          <Input type="date" value={form.dateOfBirth} onChange={e => setField('dateOfBirth', e.target.value)} />
        </div>
        <div className="space-y-2">
          <Label>Gender</Label>
          <select
            value={form.gender}
            onChange={e => setField('gender', e.target.value)}
            className="w-full rounded-lg border bg-background px-3 py-2 text-sm"
          >
            {GENDER_OPTIONS.map(g => <option key={g} value={g}>{g}</option>)}
          </select>
        </div>
        <div className="space-y-2">
          <Label>Marital Status</Label>
          <select
            value={form.maritalStatus}
            onChange={e => setField('maritalStatus', e.target.value)}
            className="w-full rounded-lg border bg-background px-3 py-2 text-sm"
          >
            {MARITAL_OPTIONS.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>
        <div className="space-y-2">
          <Label>Status</Label>
          <select
            value={form.status}
            onChange={e => setField('status', e.target.value)}
            className="w-full rounded-lg border bg-background px-3 py-2 text-sm"
          >
            {EMPLOYEE_STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>
        <div className="space-y-2">
          <Label>Weekly Holiday</Label>
          <select
            value={form.weeklyHoliday}
            onChange={e => setField('weeklyHoliday', e.target.value)}
            className="w-full rounded-lg border bg-background px-3 py-2 text-sm"
          >
            {['MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY', 'SUNDAY'].map(d => (
              <option key={d} value={d}>{d.charAt(0) + d.slice(1).toLowerCase()}</option>
            ))}
          </select>
          <p className="text-xs text-muted-foreground">Friday is the default; staff can have a dedicated weekend day.</p>
        </div>
        <div className="space-y-2 flex items-center gap-2 pt-1">
          <input
            type="checkbox"
            id="attendanceExempt"
            checked={!!form.attendanceExempt}
            onChange={e => setField('attendanceExempt', e.target.checked)}
            className="h-4 w-4 rounded border-border"
          />
          <Label htmlFor="attendanceExempt">Exempt from attendance (no punching required)</Label>
        </div>
        <div className="space-y-2 flex items-center gap-2 pt-1">
          <input
            type="checkbox"
            id="payrollExempt"
            checked={!!form.payrollExempt}
            onChange={e => setField('payrollExempt', e.target.checked)}
            className="h-4 w-4 rounded border-border"
          />
          <Label htmlFor="payrollExempt">Exempt from payroll (will not be included in payroll processing)</Label>
        </div>
        <div className="space-y-2">
          <Label>Device PIN (max 8 digits)</Label>
          <Input value={form.pin} onChange={e => setField('pin', e.target.value)} />
          <p className="text-xs text-muted-foreground">Required to sync this employee to the ZKT device.</p>
        </div>
        <div className="space-y-2">
          <Label>{isNew ? 'Password *' : 'Password (leave blank to keep)'}</Label>
          <Input type="password" value={form.password} onChange={e => setField('password', e.target.value)} />
          <p className="text-xs text-muted-foreground">Used for web login.</p>
        </div>
        <div className="space-y-2">
          <Label>Bank Account Number</Label>
          <Input value={form.bankAccountNumber} onChange={e => setField('bankAccountNumber', e.target.value)} />
        </div>
        <div className="space-y-2">
          <Label>Bank Name</Label>
          <Input value={form.bankName} onChange={e => setField('bankName', e.target.value)} />
        </div>
        <div className="space-y-2">
          <Label>Address</Label>
          <Input value={form.address} onChange={e => setField('address', e.target.value)} />
        </div>
        <div className="space-y-2">
          <Label>City</Label>
          <Input value={form.city} onChange={e => setField('city', e.target.value)} />
        </div>
        <div className="space-y-2">
          <Label>State</Label>
          <Input value={form.state} onChange={e => setField('state', e.target.value)} />
        </div>
        <div className="space-y-2">
          <Label>Zip Code</Label>
          <Input value={form.zipCode} onChange={e => setField('zipCode', e.target.value)} />
        </div>
        <div className="space-y-2">
          <Label>Country</Label>
          <Input value={form.country} onChange={e => setField('country', e.target.value)} />
        </div>
        <div className="space-y-2">
          <Label>Emergency Contact Name</Label>
          <Input value={form.emergencyContactName} onChange={e => setField('emergencyContactName', e.target.value)} />
        </div>
        <div className="space-y-2">
          <Label>Emergency Contact Phone</Label>
          <Input value={form.emergencyContactPhone} onChange={e => setField('emergencyContactPhone', e.target.value)} />
        </div>
      </div>
    </>
  );

  if (loading) {
    return (
      <div className="text-center py-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
        <p className="mt-2">Loading employee...</p>
      </div>
    );
  }

  if (!isNew && (error || !employee)) {
    return <p className="text-center text-muted-foreground py-8">{error || 'Employee not found'}</p>;
  }

  // Create mode
  if (isNew) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <Button variant="outline" size="sm" onClick={() => navigate('/employees')}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back
          </Button>
          <h2 className="text-xl font-bold">Add Employee</h2>
        </div>
        <Card>
          <CardHeader>
            <CardTitle>Employee Information</CardTitle>
          </CardHeader>
          <CardContent>{renderFormFields}</CardContent>
          <div className="flex justify-end gap-2 px-6 pb-6">
            <Button variant="outline" onClick={() => navigate('/employees')}>Cancel</Button>
            <Button onClick={saveEmployee} disabled={saving}>
              <Save className="h-4 w-4 mr-1" />
              {saving ? 'Saving...' : 'Create Employee'}
            </Button>
          </div>
        </Card>
      </div>
    );
  }

  const presentCount = attendance.filter(r => r.status === 'PRESENT').length;
  const lateCount = attendance.filter(r => r.status === 'LATE').length;
  const earlyCount = attendance.filter(r => r.status === 'EARLY').length;
  const totalPages = Math.max(1, Math.ceil(total / limit));

  const viewLabel =
    view === 'today' ? 'Today' :
    view === 'week' ? 'This Week (7 days)' :
    view === 'month' ? 'This Month (30 days)' :
    fromDate && toDate ? `${fromDate} to ${toDate}` :
    fromDate || toDate ? (fromDate || toDate) : 'Custom';

  // Edit mode
  if (editing) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <Button variant="outline" size="sm" onClick={() => navigate('/employees')}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back
          </Button>
          <h2 className="text-xl font-bold">Edit — {employee.firstName} {employee.lastName}</h2>
        </div>
        <Card>
          <CardHeader>
            <CardTitle>Employee Information</CardTitle>
          </CardHeader>
          <CardContent>{renderFormFields}</CardContent>
          <div className="flex justify-end gap-2 px-6 pb-6">
            <Button variant="outline" onClick={() => setEditing(false)}>Cancel</Button>
            <Button onClick={saveEmployee} disabled={saving}>
              <Save className="h-4 w-4 mr-1" />
              {saving ? 'Saving...' : 'Save Changes'}
            </Button>
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="outline" size="sm" onClick={() => navigate('/employees')}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back
        </Button>
        <h2 className="text-xl font-bold">Employee Details</h2>
        <div className="ml-auto">
          <Button variant="outline" size="sm" onClick={startEditing}>
            <Pencil className="h-4 w-4 mr-1" />
            Edit Profile
          </Button>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-1">
          <CardContent className="pt-6 text-center space-y-3">
            {employee.profileImageUrl ? (
              <img
                src={api.fileUrl(employee.profileImageUrl)}
                alt="Employee"
                className="mx-auto h-20 w-20 rounded-full object-cover border-2 border-border"
              />
            ) : (
              <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-primary text-2xl font-bold text-primary-foreground">
                {employee.firstName?.charAt(0)}{employee.lastName?.charAt(0)}
              </div>
            )}
            <div>
              <h3 className="text-lg font-semibold">{employee.firstName} {employee.lastName}</h3>
              <p className="text-sm text-muted-foreground">{employee.position?.title}</p>
            </div>
            <div className="flex items-center justify-center gap-2 flex-wrap">
              <span className={`px-2 py-1 text-xs rounded-full ${EMPLOYEE_STATUS_STYLES[employee.status] || 'bg-gray-100 text-gray-800'}`}>
                {employee.status}
              </span>
              {employee.attendanceExempt && (
                <Badge variant="outline" className="border-purple-300 text-purple-700">Attendance Exempt</Badge>
              )}
              {employee.payrollExempt && (
                <Badge variant="outline" className="border-orange-300 text-orange-700">Payroll Exempt</Badge>
              )}
              <Badge variant="outline">{employee.employmentType}</Badge>
              <Badge variant="outline">{employee.weeklyHoliday} weekly holiday</Badge>
            </div>
            <div className="border-t pt-4 space-y-2 text-sm">
              {employee.email && <p className="flex items-center justify-center gap-2"><Mail className="h-4 w-4 text-muted-foreground" /> {employee.email}</p>}
              {employee.phone && <p className="flex items-center justify-center gap-2"><Phone className="h-4 w-4 text-muted-foreground" /> {employee.phone}</p>}
              {employee.address && <p className="flex items-center justify-center gap-2"><MapPin className="h-4 w-4 text-muted-foreground" /> {employee.address}</p>}
              {employee.govtIdNumber && (
                <p className="flex items-center justify-center gap-2">
                  <CreditCard className="h-4 w-4 text-muted-foreground" />
                  {employee.govtIdType ? employee.govtIdType.replace('_', ' ') : 'Govt ID'}: {employee.govtIdNumber}
                </p>
              )}
            </div>
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Employment Information</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2">
            <div>
              <Label>Employee ID</Label>
              <Input value={employee.employeeId} readOnly />
            </div>
            <div>
              <Label>Department</Label>
              <Input value={employee.department?.name || '—'} readOnly />
            </div>
            <div>
              <Label>Hire Date</Label>
              <Input value={employee.hireDate ? formatDate(employee.hireDate) : '—'} readOnly />
            </div>
            <div>
              <Label>Salary Type</Label>
              <Input value={employee.salaryType === 'SCALED' ? 'Scaled Salary' : 'Gross Salary'} readOnly />
            </div>
            {employee.salaryType === 'SCALED' ? (
              <>
                <div>
                  <Label>Basic Scale</Label>
                  <Input value={employee.basicScale != null ? fmtMoney(employee.basicScale) : '—'} readOnly />
                </div>
                <div>
                  <Label>Accommodation ({employee.accommodationRate || 50}%)</Label>
                  <Input value={employee.basicScale ? fmtMoney(Number(employee.basicScale) * Number(employee.accommodationRate || 50) / 100) : '—'} readOnly />
                </div>
                <div>
                  <Label>Medical ({employee.medicalRate || 25}%)</Label>
                  <Input value={employee.basicScale ? fmtMoney(Number(employee.basicScale) * Number(employee.medicalRate || 25) / 100) : '—'} readOnly />
                </div>
                <div>
                  <Label>Transport ({employee.transportRate || 15}%)</Label>
                  <Input value={employee.basicScale ? fmtMoney(Number(employee.basicScale) * Number(employee.transportRate || 15) / 100) : '—'} readOnly />
                </div>
                <div>
                  <Label>Mobile & Internet</Label>
                  <Input value={employee.mobileInternet != null ? fmtMoney(employee.mobileInternet) : '—'} readOnly />
                </div>
                <div>
                  <Label>Gross Salary</Label>
                  <Input value={(() => {
                    const b = Number(employee.basicScale || 0);
                    const gross = b + b * Number(employee.accommodationRate || 50) / 100 + b * Number(employee.medicalRate || 25) / 100 + b * Number(employee.transportRate || 15) / 100 + Number(employee.mobileInternet || 0);
                    return fmtMoney(gross);
                  })()} readOnly />
                </div>
              </>
            ) : (
              <div>
                <Label>Salary</Label>
                <Input value={employee.salary != null ? fmtMoney(employee.salary) : '—'} readOnly />
              </div>
            )}
            <div>
              <Label>Device UID</Label>
              <Input value={employee.deviceUid != null ? employee.deviceUid : 'Not synced'} readOnly />
            </div>
            <div>
              <Label>Device PIN</Label>
              <Input value={employee.pin ? '••••••••' : 'Not set'} readOnly />
            </div>
            {employee.employmentEndDate && (
              <div>
                <Label>Employment End Date</Label>
                <Input value={formatDate(employee.employmentEndDate)} readOnly />
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Device sync */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Cpu className="h-4 w-4" />
            ZKT Device
          </CardTitle>
        </CardHeader>
        <CardContent className="flex flex-wrap items-center gap-3">
          <Button variant="outline" onClick={syncToDevice} disabled={syncing}>
            <Cpu className="h-4 w-4 mr-1" />
            {syncing ? 'Syncing...' : 'Sync to Device'}
          </Button>
          <Button variant="outline" onClick={enrollFingerprint} disabled={enrolling}>
            <Fingerprint className="h-4 w-4 mr-1" />
            {enrolling ? 'Press finger on device...' : 'Enroll Fingerprint'}
          </Button>
          {deviceMsg && <span className="text-sm text-muted-foreground">{deviceMsg}</span>}
          <p className="text-xs text-muted-foreground w-full">
            Set a PIN (max 8 digits) in Edit Profile before syncing. Enrollment requires the employee to press their
            finger on the device when prompted.
          </p>
        </CardContent>
      </Card>

      {/* Documents & assets */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Upload className="h-4 w-4" />
            Documents & Assets
          </CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-3">
          <div className="space-y-2">
            <Label>Photograph</Label>
            {employee.profileImageUrl ? (
              <a href={api.fileUrl(employee.profileImageUrl)} target="_blank" rel="noreferrer">
                <img
                  src={api.fileUrl(employee.profileImageUrl)}
                  alt="Photograph"
                  className="h-24 w-24 rounded-lg object-cover border border-border"
                />
              </a>
            ) : (
              <div className="flex h-24 w-24 items-center justify-center rounded-lg border border-dashed text-muted-foreground">
                <ImageIcon className="h-6 w-6" />
              </div>
            )}
            <Label className="text-xs text-muted-foreground">JPG / PNG</Label>
            <input
              type="file"
              accept="image/jpeg,image/png,image/webp"
              className="w-full text-xs"
              onChange={(e) => e.target.files?.[0] && uploadDocument(e.target.files[0], 'PHOTO')}
            />
          </div>
          <div className="space-y-2">
            <Label>Govt. Photo ID Document</Label>
            {employee.idDocumentUrl ? (
              <a
                href={api.fileUrl(employee.idDocumentUrl)}
                target="_blank"
                rel="noreferrer"
                className="flex h-24 w-24 items-center justify-center rounded-lg border border-border text-xs text-muted-foreground hover:bg-muted"
              >
                <CreditCard className="h-5 w-5 mr-1" /> View
              </a>
            ) : (
              <div className="flex h-24 w-24 items-center justify-center rounded-lg border border-dashed text-muted-foreground">
                <CreditCard className="h-6 w-6" />
              </div>
            )}
            <Label className="text-xs text-muted-foreground">PDF / image</Label>
            <input
              type="file"
              accept="application/pdf,image/jpeg,image/png,image/webp"
              className="w-full text-xs"
              onChange={(e) => e.target.files?.[0] && uploadDocument(e.target.files[0], 'ID')}
            />
          </div>
          <div className="space-y-2">
            <Label>CV / Resume</Label>
            {employee.cvUrl ? (
              <a
                href={api.fileUrl(employee.cvUrl)}
                target="_blank"
                rel="noreferrer"
                className="flex h-24 w-24 items-center justify-center rounded-lg border border-border text-xs text-muted-foreground hover:bg-muted"
              >
                <FileText className="h-5 w-5 mr-1" /> View
              </a>
            ) : (
              <div className="flex h-24 w-24 items-center justify-center rounded-lg border border-dashed text-muted-foreground">
                <FileText className="h-6 w-6" />
              </div>
            )}
            <Label className="text-xs text-muted-foreground">PDF / image</Label>
            <input
              type="file"
              accept="application/pdf,image/jpeg,image/png,image/webp"
              className="w-full text-xs"
              onChange={(e) => e.target.files?.[0] && uploadDocument(e.target.files[0], 'CV')}
            />
          </div>
          {uploading && <p className="text-xs text-muted-foreground sm:col-span-3">Uploading {uploading.toLowerCase()}...</p>}
        </CardContent>
      </Card>

      {/* Employment lifecycle */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <UserMinus className="h-4 w-4" />
            Employment Actions
          </CardTitle>
        </CardHeader>
        <CardContent className="flex flex-wrap items-center gap-3">
          <Button variant="outline" onClick={() => employmentAction('terminate')} disabled={!!actionBusy || employee.status === 'TERMINATED'}>
            <UserX className="h-4 w-4 mr-1" />
            Terminate
          </Button>
          <Button variant="outline" onClick={() => employmentAction('resign')} disabled={!!actionBusy || employee.status === 'RESIGNED'}>
            <UserMinus className="h-4 w-4 mr-1" />
            Resign
          </Button>
          <Button variant="outline" onClick={() => employmentAction('retire')} disabled={!!actionBusy || employee.status === 'RETIRED'}>
            <Award className="h-4 w-4 mr-1" />
            Retire
          </Button>
          <Button variant="destructive" onClick={deleteEmployee} disabled={!!actionBusy}>
            <Trash2 className="h-4 w-4 mr-1" />
            Delete Permanently
          </Button>
          <p className="text-xs text-muted-foreground w-full">
            Terminate / resign / retire sets the employment status and records the end date. Delete permanently removes
            the employee and all related records from the system.
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-3">
          <CardTitle>Leave Balance ({new Date().getFullYear()})</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-3">
          <div>
            <Label>Casual Leave Total (input)</Label>
            <Input type="number" value={casualTotal} onChange={(e) => setCasualTotal(Number(e.target.value))} />
            {leave && (
              <p className="text-xs text-muted-foreground mt-1">
                Used {leave.casualUsed} Â· Remaining {leave.casualRemaining}
              </p>
            )}
          </div>
          <div>
            <Label>Medical Leave Total (input)</Label>
            <Input type="number" value={medicalTotal} onChange={(e) => setMedicalTotal(Number(e.target.value))} />
            {leave && (
              <p className="text-xs text-muted-foreground mt-1">
                Used {leave.medicalUsed} Â· Remaining {leave.medicalRemaining}
              </p>
            )}
          </div>
          <div className="flex items-end">
            <Button onClick={saveLeave} disabled={savingLeave}>
              {savingLeave ? 'Saving...' : 'Save Leave Balance'}
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-3">
          <CardTitle>Attendance History</CardTitle>
          <div className="flex items-center gap-2">
            <div className="flex rounded-lg border shrink-0">
              <button
                onClick={() => selectView('today')}
                className={`px-3 py-1.5 text-sm rounded-l-lg ${view === 'today' ? 'bg-primary text-primary-foreground' : 'hover:bg-muted'}`}
              >
                Today
              </button>
              <button
                onClick={() => selectView('week')}
                className={`px-3 py-1.5 text-sm border-l ${view === 'week' ? 'bg-primary text-primary-foreground' : 'hover:bg-muted'}`}
              >
                Week
              </button>
              <button
                onClick={() => selectView('month')}
                className={`px-3 py-1.5 text-sm border-l rounded-r-lg ${view === 'month' ? 'bg-primary text-primary-foreground' : 'hover:bg-muted'}`}
              >
                Month
              </button>
            </div>
            <Input
              type="date"
              value={fromDate}
              onChange={(e) => applyDate('from', e.target.value)}
              className="w-auto"
            />
            <span className="text-sm text-muted-foreground shrink-0">to</span>
            <Input
              type="date"
              value={toDate}
              onChange={(e) => applyDate('to', e.target.value)}
              className="w-auto"
            />
            <Button variant="outline" size="sm" onClick={() => handleExport('xlsx')} disabled={!!exporting}>
              <FileSpreadsheet className="h-4 w-4 mr-1" />
              {exporting === 'xlsx' ? '...' : 'Excel'}
            </Button>
            <Button variant="outline" size="sm" onClick={() => handleExport('pdf')} disabled={!!exporting}>
              <FileText className="h-4 w-4 mr-1" />
              {exporting === 'pdf' ? '...' : 'PDF'}
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-4">
            <Card>
              <CardContent className="pt-6 flex items-center gap-3">
                <Calendar className="h-8 w-8 text-green-600" />
                <div>
                  <p className="text-2xl font-bold">{presentCount + lateCount + earlyCount}</p>
                  <p className="text-xs text-muted-foreground">Days Present</p>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6 flex items-center gap-3">
                <Clock className="h-8 w-8 text-orange-600" />
                <div>
                  <p className="text-2xl font-bold">{lateCount}</p>
                  <p className="text-xs text-muted-foreground">Late</p>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6 flex items-center gap-3">
                <Clock className="h-8 w-8 text-blue-600" />
                <div>
                  <p className="text-2xl font-bold">{earlyCount}</p>
                  <p className="text-xs text-muted-foreground">Early Departure</p>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6 flex items-center gap-3">
                <Calendar className="h-8 w-8 text-purple-600" />
                <div>
                  <p className="text-2xl font-bold">{total}</p>
                  <p className="text-xs text-muted-foreground">Records ({viewLabel})</p>
                </div>
              </CardContent>
            </Card>
          </div>

          {attLoading ? (
            <p className="text-center text-muted-foreground py-6">Loading attendance...</p>
          ) : attendance.length === 0 ? (
            <p className="text-center text-muted-foreground py-6">No attendance records for this period</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
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
                </TableRow>
              </TableHeader>
              <TableBody>
                {attendance.map(record => (
                  <TableRow key={record.id}>
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
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
          <div className="flex items-center justify-between pt-2">
            <p className="text-sm text-muted-foreground">
              Showing {attendance.length} of {total.toLocaleString()} records
            </p>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage(p => p - 1)}>
                Previous
              </Button>
              <span className="text-sm text-muted-foreground">Page {page} of {totalPages}</span>
              <Button variant="outline" size="sm" disabled={page >= totalPages} onClick={() => setPage(p => p + 1)}>
                Next
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export { EmployeeDetailPage };
