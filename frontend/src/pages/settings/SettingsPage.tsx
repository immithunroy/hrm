import React, { useState, useEffect, useCallback } from 'react';
import {
  Card,
  CardHeader,
  CardTitle,
  CardContent,
  CardFooter,
  Button,
  Input,
  Label
} from '@/components/ui';
import { api } from '../../services/api';

type RateMode = 'DECIMAL' | 'PERCENT';

type RoleEmployee = {
  id: string;
  employeeId: string;
  firstName: string;
  lastName: string;
  email: string;
  role: string;
  department: { name: string } | null;
};

const ROLES = ['ADMIN', 'HR', 'MANAGER', 'FINANCE', 'EMPLOYEE'];

const SettingsPage = () => {
  const [payroll, setPayroll] = useState({
    overtimeRate: '1.5',
    overtimeRateMode: 'DECIMAL' as RateMode,
    holidayOvertimeRate: '2',
    holidayOvertimeRateMode: 'DECIMAL' as RateMode,
    taxRate: '0.1',
    workingDaysPerMonth: '26',
    workingHoursPerDay: '8',
    defaultWeeklyHoliday: 'FRIDAY',
    errandDeductionMode: 'SKIP' as 'SKIP' | 'DEDUCT_FROM_OT',
    earlyOvertimeMode: 'INCLUDE' as 'INCLUDE' | 'EXCLUDE',
    currency: 'BDT'
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState('');

  // Role management state
  const [roleEmployees, setRoleEmployees] = useState<RoleEmployee[]>([]);
  const [roleLoading, setRoleLoading] = useState(true);
  const [roleSaving, setRoleSaving] = useState<string | null>(null);
  const [roleError, setRoleError] = useState('');

  const fetchSettings = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get<any>('/settings');
      const s = res.data || {};
      setPayroll({
        overtimeRate: String(s.overtimeRateRaw ?? s.overtimeRate ?? 1.5),
        overtimeRateMode: s.overtimeRateMode || 'DECIMAL',
        holidayOvertimeRate: String(s.holidayOvertimeRateRaw ?? s.holidayOvertimeRate ?? 2),
        holidayOvertimeRateMode: s.holidayOvertimeRateMode || 'DECIMAL',
        taxRate: String(s.taxRate ?? 0.1),
        workingDaysPerMonth: String(s.workingDaysPerMonth ?? 26),
        workingHoursPerDay: String(s.workingHoursPerDay ?? 8),
        defaultWeeklyHoliday: s.defaultWeeklyHoliday || 'FRIDAY',
        errandDeductionMode: s.errandDeductionMode || 'SKIP',
        earlyOvertimeMode: s.earlyOvertimeMode || 'INCLUDE',
        currency: s.currency || 'BDT'
      });
      setError('');
    } catch (e: any) {
      setError(e.message || 'Failed to load settings');
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchRoles = useCallback(async () => {
    setRoleLoading(true);
    try {
      const res = await api.get<any>('/settings/roles');
      setRoleEmployees(res.data || []);
      setRoleError('');
    } catch (e: any) {
      setRoleError(e.message || 'Failed to load roles');
    } finally {
      setRoleLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchSettings();
    fetchRoles();
  }, [fetchSettings, fetchRoles]);

  const handleSave = async () => {
    setSaving(true);
    setSaved(false);
    try {
      await api.put<any>('/settings', {
        overtimeRate: Number(payroll.overtimeRate) || 0,
        overtimeRateMode: payroll.overtimeRateMode,
        holidayOvertimeRate: Number(payroll.holidayOvertimeRate) || 0,
        holidayOvertimeRateMode: payroll.holidayOvertimeRateMode,
        taxRate: Number(payroll.taxRate) || 0,
        workingDaysPerMonth: Number(payroll.workingDaysPerMonth) || 26,
        workingHoursPerDay: Number(payroll.workingHoursPerDay) || 8,
        defaultWeeklyHoliday: payroll.defaultWeeklyHoliday,
        errandDeductionMode: payroll.errandDeductionMode,
        earlyOvertimeMode: payroll.earlyOvertimeMode,
        currency: payroll.currency
      });
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (e: any) {
      alert(e.message || 'Failed to save settings');
    } finally {
      setSaving(false);
    }
  };

  const handleRoleChange = async (employeeId: string, newRole: string) => {
    setRoleSaving(employeeId);
    setRoleError('');
    try {
      await api.put<any>('/settings/roles', { employeeId, role: newRole });
      setRoleEmployees(prev =>
        prev.map(e => (e.id === employeeId ? { ...e, role: newRole } : e))
      );
    } catch (e: any) {
      setRoleError(e.response?.data?.message || e.message || 'Failed to update role');
    } finally {
      setRoleSaving(null);
    }
  };

  const effMultiplier = (raw: string, mode: RateMode) => {
    const n = Number(raw);
    if (!Number.isFinite(n)) return null;
    return mode === 'PERCENT' ? n / 100 : n;
  };

  const modeToggle = (value: RateMode, onChange: (v: RateMode) => void) => (
    <div className="flex rounded-lg border w-fit">
      <button
        type="button"
        onClick={() => onChange('DECIMAL')}
        className={`px-3 py-1 text-xs rounded-l-lg ${value === 'DECIMAL' ? 'bg-primary text-primary-foreground' : 'hover:bg-muted'}`}
      >
        Decimal
      </button>
      <button
        type="button"
        onClick={() => onChange('PERCENT')}
        className={`px-3 py-1 text-xs border-l rounded-r-lg ${value === 'PERCENT' ? 'bg-primary text-primary-foreground' : 'hover:bg-muted'}`}
      >
        Percent
      </button>
    </div>
  );

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold">Settings</h2>
        <p className="text-sm text-muted-foreground">
          Payroll rules, default weekly holiday and role management
        </p>
      </div>

      {loading ? (
        <p className="text-center text-muted-foreground py-8">Loading settings...</p>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>Payroll Rules</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <div className="space-y-2">
              <Label>Regular Overtime Rate / Hour</Label>
              <div className="flex gap-2">
                <Input
                  type="number"
                  min="0"
                  step={payroll.overtimeRateMode === 'PERCENT' ? '5' : '0.1'}
                  value={payroll.overtimeRate}
                  onChange={e => setPayroll({ ...payroll, overtimeRate: e.target.value })}
                />
                {modeToggle(payroll.overtimeRateMode, (v) => setPayroll({ ...payroll, overtimeRateMode: v }))}
              </div>
              <p className="text-xs text-muted-foreground">
                {payroll.overtimeRateMode === 'PERCENT'
                  ? `${payroll.overtimeRate}% = ${(effMultiplier(payroll.overtimeRate, 'PERCENT') ?? 0).toFixed(2)}x the hourly rate (default 150%)`
                  : `${payroll.overtimeRate}x the hourly rate (default 1.5x)`}
              </p>
            </div>
            <div className="space-y-2">
              <Label>Holiday Overtime Rate / Hour</Label>
              <div className="flex gap-2">
                <Input
                  type="number"
                  min="0"
                  step={payroll.holidayOvertimeRateMode === 'PERCENT' ? '5' : '0.1'}
                  value={payroll.holidayOvertimeRate}
                  onChange={e => setPayroll({ ...payroll, holidayOvertimeRate: e.target.value })}
                />
                {modeToggle(payroll.holidayOvertimeRateMode, (v) => setPayroll({ ...payroll, holidayOvertimeRateMode: v }))}
              </div>
              <p className="text-xs text-muted-foreground">
                {payroll.holidayOvertimeRateMode === 'PERCENT'
                  ? `${payroll.holidayOvertimeRate}% = ${(effMultiplier(payroll.holidayOvertimeRate, 'PERCENT') ?? 0).toFixed(2)}x the hourly rate (default 200%)`
                  : `${payroll.holidayOvertimeRate}x the hourly rate for weekly &amp; marked holidays (default 2x)`}
              </p>
            </div>
            <div className="space-y-2">
              <Label>Tax Rate</Label>
              <div className="flex gap-2">
                <Input
                  type="number"
                  min="0"
                  step="0.01"
                  value={payroll.taxRate}
                  onChange={e => setPayroll({ ...payroll, taxRate: e.target.value })}
                />
              </div>
              <p className="text-xs text-muted-foreground">Decimal of gross, e.g. 0.10 = 10%</p>
            </div>
            <div className="space-y-2">
              <Label>Working Days / Month</Label>
              <Input
                type="number"
                value={payroll.workingDaysPerMonth}
                onChange={e => setPayroll({ ...payroll, workingDaysPerMonth: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label>Working Hours / Day</Label>
              <Input
                type="number"
                value={payroll.workingHoursPerDay}
                onChange={e => setPayroll({ ...payroll, workingHoursPerDay: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label>Default Weekly Holiday</Label>
              <select
                value={payroll.defaultWeeklyHoliday}
                onChange={e => setPayroll({ ...payroll, defaultWeeklyHoliday: e.target.value })}
                className="w-full rounded-lg border bg-background px-3 py-2 text-sm"
              >
                {['MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY', 'SUNDAY'].map(d => (
                  <option key={d} value={d}>{d.charAt(0) + d.slice(1).toLowerCase()}</option>
                ))}
              </select>
              <p className="text-xs text-muted-foreground">
                Each employee can override this on their profile.
              </p>
            </div>
            <div className="space-y-2">
              <Label>Currency</Label>
              <select
                value={payroll.currency}
                onChange={e => setPayroll({ ...payroll, currency: e.target.value })}
                className="w-full rounded-lg border bg-background px-3 py-2 text-sm"
              >
                <option value="BDT">BDT (৳)</option>
                <option value="USD">USD ($)</option>
              </select>
              <p className="text-xs text-muted-foreground">
                Used across pay slips, payroll and the dashboard.
              </p>
            </div>
            <div className="space-y-2">
              <Label>Errand Time vs Overtime</Label>
              <select
                value={payroll.errandDeductionMode}
                onChange={e => setPayroll({ ...payroll, errandDeductionMode: e.target.value as 'SKIP' | 'DEDUCT_FROM_OT' })}
                className="w-full rounded-lg border bg-background px-3 py-2 text-sm"
              >
                <option value="SKIP">Don't deduct errand from OT</option>
                <option value="DEDUCT_FROM_OT">Deduct from regular OT</option>
              </select>
              <p className="text-xs text-muted-foreground">
                Errand time is never deducted from holiday OT. When deducting, it reduces regular OT hours before overtime pay is calculated.
              </p>
            </div>
            <div className="space-y-2">
              <Label>Early Attendance OT</Label>
              <select
                value={payroll.earlyOvertimeMode}
                onChange={e => setPayroll({ ...payroll, earlyOvertimeMode: e.target.value as 'INCLUDE' | 'EXCLUDE' })}
                className="w-full rounded-lg border bg-background px-3 py-2 text-sm"
              >
                <option value="INCLUDE">Include in OT pay</option>
                <option value="EXCLUDE">Exclude from OT pay</option>
              </select>
              <p className="text-xs text-muted-foreground">
                Early arrival before the shift start counts up to 10 minutes as Early OT. When excluded, it is reported but not paid.
              </p>
            </div>
          </CardContent>
          <CardFooter className="justify-end">
            {error && <span className="text-sm text-red-600 mr-auto">{error}</span>}
            {saved && <span className="text-sm text-green-600 mr-auto">Settings saved</span>}
            <Button onClick={handleSave} disabled={saving}>
              {saving ? 'Saving...' : 'Save Settings'}
            </Button>
          </CardFooter>
        </Card>
      )}

      {/* Role Management */}
      <Card>
        <CardHeader>
          <CardTitle>Role Management</CardTitle>
        </CardHeader>
        <CardContent>
          {roleLoading ? (
            <p className="text-sm text-muted-foreground">Loading roles...</p>
          ) : roleEmployees.length === 0 ? (
            <p className="text-sm text-muted-foreground">No employees found.</p>
          ) : (
            <div className="space-y-1">
              {/* Header */}
              <div className="grid grid-cols-12 gap-2 px-3 py-2 text-xs font-semibold text-muted-foreground border-b">
                <div className="col-span-2">ID</div>
                <div className="col-span-3">Name</div>
                <div className="col-span-3">Email</div>
                <div className="col-span-2">Department</div>
                <div className="col-span-2">Role</div>
              </div>
              {roleEmployees.map((emp) => (
                <div
                  key={emp.id}
                  className="grid grid-cols-12 gap-2 px-3 py-2 items-center text-sm hover:bg-muted/50 rounded"
                >
                  <div className="col-span-2 font-mono text-xs">{emp.employeeId}</div>
                  <div className="col-span-3">{emp.firstName} {emp.lastName}</div>
                  <div className="col-span-3 text-muted-foreground text-xs truncate">{emp.email}</div>
                  <div className="col-span-2 text-xs">{emp.department?.name || '—'}</div>
                  <div className="col-span-2">
                    <select
                      value={emp.role}
                      onChange={e => handleRoleChange(emp.id, e.target.value)}
                      disabled={roleSaving === emp.id}
                      className="w-full rounded border bg-background px-2 py-1 text-xs"
                    >
                      {ROLES.map(r => (
                        <option key={r} value={r}>{r}</option>
                      ))}
                    </select>
                  </div>
                </div>
              ))}
            </div>
          )}
          {roleError && (
            <p className="text-sm text-red-600 mt-2">{roleError}</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export { SettingsPage };
