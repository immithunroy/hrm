/**
 * DashboardPage - Main organization overview dashboard.
 *
 * Features:
 * - Employee count overview (total, active, present, absent)
 * - Today's attendance summary with holiday/weekly-off detection
 * - Attendance trend chart (last 30 days) via Recharts AreaChart
 * - Status distribution pie chart (present/late/absent/leave)
 * - Monthly attendance calendar with color-coded days
 * - Department-wise employee vs present bar chart
 * - Overtime, leave, holidays, and open positions metrics
 * - Recent attendance table for today
 * - Upcoming holidays badges
 *
 * Data is fetched from /api/dashboard endpoint.
 */

import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { api } from '../../services/api';
import {
  Card,
  CardHeader,
  CardTitle,
  CardContent,
  Button,
  Badge
} from '@/components/ui';
import {
  Users,
  UserCheck,
  UserX,
  Wallet,
  Clock,
  CalendarDays,
  Briefcase,
  TrendingUp
} from 'lucide-react';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar,
  Legend
} from 'recharts';
import { STATUS_HEX, STATUS_STYLES, attendanceStatusLabel } from '../../lib/colors';
import { fmtHM, fmtMoney, dhakaWeekdayShort, WEEKDAY_SHORT, weekdayNameOfDayStr } from '../../lib/format';

const formatTime = (value: any) => {
  if (!value) return '—';
  return new Date(value).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
};

const formatDate = (value: any) => {
  if (!value) return '—';
  return new Date(value).toLocaleDateString();
};

// Monthly calendar synced with attendance + holidays (data from /api/dashboard.calendar).
const AttendanceCalendar = ({ calendar }: { calendar: any[] }) => {
  if (!calendar || calendar.length === 0) return null;

  const monthLabel = calendar.length > 0
    ? new Date(Date.UTC(Number(calendar[0].date.slice(0, 4)), Number(calendar[0].date.slice(5, 7)) - 1, 1))
        .toLocaleDateString([], { year: 'numeric', month: 'long' })
    : '';

  // Leading blanks so day 1 lines up with its weekday (Sunday-first).
  const firstWeekday = new Date(Date.UTC(
    Number(calendar[0].date.slice(0, 4)),
    Number(calendar[0].date.slice(5, 7)) - 1,
    1
  )).getUTCDay();
  const blanks = Array.from({ length: firstWeekday }, (_, i) => i);

  const cellClass = (c: any) => {
    if (c.isHoliday) return 'bg-purple-100 border-purple-300';
    if (c.expected > 0 && c.present === 0) return 'bg-red-50 border-red-200';
    if (c.expected > 0 && c.present >= c.expected) return 'bg-green-50 border-green-200';
    if (c.expected > 0 && c.present > 0) return 'bg-yellow-50 border-yellow-200';
    return 'bg-muted/20 border-border';
  };

  const todayDhaka = `${new Date(Date.now() + 6 * 3600 * 1000).getUTCFullYear()}-${String(new Date(Date.now() + 6 * 3600 * 1000).getUTCMonth() + 1).padStart(2, '0')}-${String(new Date(Date.now() + 6 * 3600 * 1000).getUTCDate()).padStart(2, '0')}`;

  return (
    <Card className="flex flex-col">
      <CardHeader>
        <CardTitle className="text-sm font-medium">Attendance Calendar — {monthLabel}</CardTitle>
      </CardHeader>
      <CardContent className="flex-1 flex flex-col">
        <div className="grid grid-cols-7 gap-1 text-center text-[11px] font-semibold text-muted-foreground mb-2">
          {WEEKDAY_SHORT.map(d => <div key={d} className="py-1">{d}</div>)}
        </div>
        <div className="grid grid-cols-7 gap-1 flex-1">
          {blanks.map(i => <div key={`b${i}`} />)}
          {calendar.map(c => {
            const isToday = c.date === todayDhaka;
            return (
              <div
                key={c.date}
                title={[
                  c.date,
                  weekdayNameOfDayStr(c.date),
                  c.isHoliday ? `Holiday: ${c.holidayName}` : '',
                  c.expected > 0 ? `Present ${c.present}/${c.expected}` : '',
                  c.late > 0 ? `Late ${c.late}` : '',
                  c.absent > 0 ? `Absent ${c.absent}` : ''
                ].filter(Boolean).join(' · ')}
                className={`rounded border p-1.5 min-h-[56px] flex flex-col text-xs ${cellClass(c)} ${isToday ? 'ring-2 ring-primary' : ''}`}
              >
                <div className="flex items-center justify-between">
                  <span className="font-semibold">{Number(c.date.slice(8, 10))}</span>
                  {c.isHoliday && <span className="h-2 w-2 rounded-full bg-purple-500" />}
                </div>
                {c.expected > 0 && !c.isHoliday && (
                  <div className="mt-auto space-y-0.5">
                    {c.present > 0 && (
                      <div className="flex items-center gap-1 text-[10px] text-green-700">
                        <span className="h-1.5 w-1.5 rounded-full bg-green-500" />{c.present}
                      </div>
                    )}
                    {c.late > 0 && (
                      <div className="flex items-center gap-1 text-[10px] text-orange-700">
                        <span className="h-1.5 w-1.5 rounded-full bg-orange-500" />{c.late}
                      </div>
                    )}
                    {c.absent > 0 && (
                      <div className="flex items-center gap-1 text-[10px] text-red-700">
                        <span className="h-1.5 w-1.5 rounded-full bg-red-500" />{c.absent}
                      </div>
                    )}
                  </div>
                )}
                {c.isHoliday && c.holidayName && (
                  <p className="mt-auto text-[9px] leading-tight text-purple-700 truncate">{c.holidayName}</p>
                )}
              </div>
            );
          })}
        </div>
        <div className="flex flex-wrap items-center gap-4 mt-3 text-[11px] text-muted-foreground">
          <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-green-500" /> Present</span>
          <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-orange-500" /> Late</span>
          <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-red-500" /> Absent</span>
          <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-purple-500" /> Holiday</span>
        </div>
      </CardContent>
    </Card>
  );
};

const DashboardPage = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const fetchDashboard = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get<any>('/dashboard');
      setData(res.data);
      setError('');
    } catch (e: any) {
      setError(e.message || 'Failed to load dashboard');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchDashboard();
  }, [fetchDashboard]);

  if (loading) {
    return (
      <div className="text-center py-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
        <p className="mt-2">Loading dashboard...</p>
      </div>
    );
  }

  if (error || !data) {
    return <p className="text-center text-muted-foreground py-8">{error || 'No data available'}</p>;
  }

  const { overview, today, trend, statusDistribution, totalOvertimeHoursMonth, departmentBreakdown, payroll, approvedLeaveDays, holidays, calendar, recentAttendance } = data;

  const pieData = Object.entries(statusDistribution).map(([key, value]) => ({
    name: key,
    value: value as number
  }));

  const departmentData = departmentBreakdown.map((d: any) => ({
    name: d.name,
    Employees: d.employeeCount,
    Present: d.presentToday
  }));

  const shortTrend = trend.map((t: any) => ({
    ...t,
    label: t.date.slice(5)
  }));

  const dhakaDayStr = (value: string | Date): string => {
    const local = new Date(new Date(value).getTime() + 6 * 3600 * 1000);
    return `${local.getUTCFullYear()}-${String(local.getUTCMonth() + 1).padStart(2, '0')}-${String(local.getUTCDate()).padStart(2, '0')}`;
  };
  const todayAttendance = recentAttendance.filter((r: any) => dhakaDayStr(r.date) === today.date);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold">Dashboard</h2>
          <p className="text-sm text-muted-foreground">
            Welcome back, {user?.firstName}! Here's what's happening in your organization.
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={fetchDashboard}>
          <TrendingUp className="h-4 w-4 mr-1" />
          Refresh
        </Button>
      </div>

      {/* Overview cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardContent className="pt-6 flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-100 text-blue-600">
              <Users className="h-5 w-5" />
            </div>
            <div>
              <p className="text-2xl font-bold">{overview.totalEmployees}</p>
              <p className="text-xs text-muted-foreground">Total Employees ({overview.activeEmployees} active)</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6 flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-green-100 text-green-600">
              <UserCheck className="h-5 w-5" />
            </div>
            <div>
              <p className="text-2xl font-bold">{today.presentToday}</p>
              <p className="text-xs text-muted-foreground">Present Today ({today.attendanceRate}% rate)</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6 flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-red-100 text-red-600">
              <UserX className="h-5 w-5" />
            </div>
            <div>
              <p className="text-2xl font-bold">{today.absentToday}</p>
              <p className="text-xs text-muted-foreground">Absent Today</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6 flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-purple-100 text-purple-600">
              <Wallet className="h-5 w-5" />
            </div>
            <div>
              <p className="text-2xl font-bold">{fmtMoney(payroll.totalNetPay)}</p>
              <p className="text-xs text-muted-foreground">Net Pay ({payroll.month})</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Today's attendance + weekly holiday note */}
      <div className="grid gap-4 lg:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium">Today's Attendance — {today.date}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {today.isHoliday && (
              <Badge variant="outline" className="bg-purple-100 text-purple-800 border-purple-200">
                Marked Holiday
              </Badge>
            )}
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Expected</span>
              <span className="font-bold">{today.expectedToday}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Present</span>
              <span className="font-bold text-green-600">{today.presentToday}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Late</span>
              <span className="font-bold text-orange-600">{today.lateToday}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Early Departure</span>
              <span className="font-bold text-blue-600">{today.earlyToday}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Absent</span>
              <span className="font-bold text-red-600">{today.absentToday}</span>
            </div>
            {today.weeklyHolidayToday > 0 && (
              <p className="text-xs text-muted-foreground border-t pt-2">
                {today.weeklyHolidayToday} employee(s) have today as their weekly holiday.
              </p>
            )}
            <Button variant="outline" size="sm" className="w-full" onClick={() => navigate('/attendance')}>
              View Attendance
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium">Attendance Trend (last 30 days)</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={260}>
              <AreaChart data={shortTrend}>
                <defs>
                  <linearGradient id="presentGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#22c55e" stopOpacity={0.6} />
                    <stop offset="95%" stopColor="#22c55e" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                <XAxis dataKey="label" tick={{ fontSize: 10 }} interval="preserveStartEnd" />
                <YAxis tick={{ fontSize: 10 }} allowDecimals={false} />
                <Tooltip />
                <Area type="monotone" dataKey="present" stroke="#22c55e" fill="url(#presentGrad)" name="Present" />
                <Area type="monotone" dataKey="late" stroke="#f97316" fill="none" name="Late" />
                <Area type="monotone" dataKey="absent" stroke="#ef4444" fill="none" name="Absent" />
              </AreaChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium">Status Distribution (this month)</CardTitle>
          </CardHeader>
          <CardContent>
            {pieData.length === 0 ? (
              <p className="text-center text-muted-foreground py-8">No records this month</p>
            ) : (
              <ResponsiveContainer width="100%" height={240}>
                <PieChart>
                  <Pie data={pieData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80} label>
                    {pieData.map((entry, i) => (
                      <Cell key={i} fill={STATUS_HEX[entry.name] || '#9ca3af'} />
                    ))}
                  </Pie>
                  <Tooltip />
                  <Legend wrapperStyle={{ fontSize: 12 }} />
                </PieChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Attendance calendar + employees vs present — equal row */}
      <div className="grid gap-4 lg:grid-cols-2">
        <AttendanceCalendar calendar={calendar} />

        <Card className="flex flex-col">
          <CardHeader>
            <CardTitle className="text-sm font-medium">Employees vs Present by Department</CardTitle>
          </CardHeader>
          <CardContent className="flex-1 flex flex-col">
            <ResponsiveContainer width="100%" height="100%" minHeight={280}>
              <BarChart data={departmentData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                <XAxis dataKey="name" tick={{ fontSize: 10 }} />
                <YAxis tick={{ fontSize: 10 }} allowDecimals={false} />
                <Tooltip />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Bar dataKey="Employees" fill="#3b82f6" />
                <Bar dataKey="Present" fill="#22c55e" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* Secondary metrics */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardContent className="pt-6 flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-orange-100 text-orange-600">
              <Clock className="h-5 w-5" />
            </div>
            <div>
              <p className="text-2xl font-bold">{fmtHM(totalOvertimeHoursMonth)}</p>
              <p className="text-xs text-muted-foreground">Overtime This Month</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6 flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-green-100 text-green-600">
              <CalendarDays className="h-5 w-5" />
            </div>
            <div>
              <p className="text-2xl font-bold">{approvedLeaveDays}</p>
              <p className="text-xs text-muted-foreground">Approved Leave Days</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6 flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-purple-100 text-purple-600">
              <CalendarDays className="h-5 w-5" />
            </div>
            <div>
              <p className="text-2xl font-bold">{overview.holidaysThisMonth}</p>
              <p className="text-xs text-muted-foreground">Holidays This Month</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6 flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-100 text-blue-600">
              <Briefcase className="h-5 w-5" />
            </div>
            <div>
              <p className="text-2xl font-bold">{overview.openPositions}</p>
              <p className="text-xs text-muted-foreground">Open Positions</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Recent attendance */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-medium">Recent Attendance</CardTitle>
        </CardHeader>
        <CardContent>
          {todayAttendance.length === 0 ? (
            <p className="text-center text-muted-foreground py-6">No attendance records yet</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left text-xs text-muted-foreground">
                    <th className="py-2 pr-4">Employee</th>
                    <th className="py-2 pr-4">Date</th>
                    <th className="py-2 pr-4">Day</th>
                    <th className="py-2 pr-4">In</th>
                    <th className="py-2 pr-4">Out</th>
                    <th className="py-2 pr-4">Work</th>
                    <th className="py-2 pr-4">OT</th>
                    <th className="py-2">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {todayAttendance.map((r: any) => (
                    <tr key={r.id} className="border-b last:border-0">
                      <td className="py-2 pr-4">
                        <p className="font-medium">{r.employee?.firstName} {r.employee?.lastName}</p>
                        <p className="text-xs text-muted-foreground">{r.employee?.employeeId}</p>
                      </td>
                      <td className="py-2 pr-4">{formatDate(r.date)}</td>
                      <td className="py-2 pr-4 text-xs text-muted-foreground">{dhakaWeekdayShort(r.date)}</td>
                      <td className="py-2 pr-4">{formatTime(r.checkIn)}</td>
                      <td className="py-2 pr-4">{formatTime(r.checkOut)}</td>
                      <td className="py-2 pr-4">{fmtHM(r.workHours)}</td>
                      <td className="py-2 pr-4">{fmtHM(r.overtimeHours)}</td>
                      <td className="py-2">
                        <span className={`px-2 py-1 text-xs rounded-full ${STATUS_STYLES[r.status] || STATUS_STYLES.PRESENT}`}>
                          {attendanceStatusLabel(r.status)}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Upcoming holidays */}
      {holidays.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium">Holidays This Month</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {holidays.map((h: any) => (
                <Badge key={h.id} variant="outline" className="bg-purple-100 text-purple-800 border-purple-200">
                  {h.name} — {h.date}
                </Badge>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default DashboardPage;