/**
 * PayrollPage - Payroll processing and pay slip generation page.
 *
 * Features:
 * - Auto-calculate payroll from attendance data for a selected month
 * - Process payroll button with confirmation dialog
 * - Employee table showing monthly salary and processed net pay
 * - Individual pay slip export (Excel/PDF) per employee
 * - Processed payroll records table with basic salary, overtime, tax, net pay
 * - Month selector for navigating between pay periods
 *
 * State management:
 * - Month state drives both employee and payroll record fetches
 * - recordByEmployee Map for O(1) lookup of processed records
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  Card,
  CardHeader,
  CardTitle,
  CardContent,
  Button,
  Input,
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableCell,
  TableHead
} from '@/components/ui';
import { FileSpreadsheet, FileText, Calculator } from 'lucide-react';
import { api } from '../../services/api';
import { fmtMoney } from '../../lib/format';

const currentMonth = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
};

const DHAKA_OFFSET_MS = 6 * 3600 * 1000;

const monthRange = (month: string) => {
  const [y, m] = month.split('-').map(Number);
  const start = Date.UTC(y, m - 1, 1) - DHAKA_OFFSET_MS;
  const end = Date.UTC(y, m, 1) - DHAKA_OFFSET_MS - 1;
  return {
    start: new Date(start).toISOString(),
    end: new Date(end).toISOString()
  };
};

const PayrollPage = () => {
  const [employees, setEmployees] = useState<any[]>([]);
  const [records, setRecords] = useState<any[]>([]);
  const [month, setMonth] = useState(currentMonth());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [exporting, setExporting] = useState<string | null>(null);
  const [processing, setProcessing] = useState(false);
  const [processMsg, setProcessMsg] = useState('');

  const fetchEmployees = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get<any>('/employees?limit=500&status=ACTIVE');
      setEmployees(res.data.employees || []);
      setError('');
    } catch (e: any) {
      setError(e.message || 'Failed to load employees');
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchRecords = useCallback(async () => {
    const { start, end } = monthRange(month);
    const params = new URLSearchParams({ limit: '500', startDate: start, endDate: end });
    try {
      const res = await api.get<any>(`/payroll?${params.toString()}`);
      setRecords(res.data.payrollRecords || []);
    } catch (e) {
      setRecords([]);
    }
  }, [month]);

  useEffect(() => {
    fetchEmployees();
    fetchRecords();
  }, [fetchEmployees, fetchRecords]);

  const exportPayslip = async (empId: string, empCode: string, format: string) => {
    const key = `${empId}:${format}`;
    setExporting(key);
    try {
      await api.download(
        `/payroll/payslip/${empId}?month=${month}&format=${format}`,
        `payslip-${empCode}-${month}.${format}`
      );
    } catch (e: any) {
      alert(e.message || 'Export failed');
    } finally {
      setExporting(null);
    }
  };

  const processPayroll = async () => {
    if (!window.confirm(`Automatically calculate payroll for ${month} from attendance?\n\nExisting payroll records for this month will be replaced.`)) return;
    setProcessing(true);
    setProcessMsg('');
    try {
      const res = await api.post<any>('/payroll/process', { month });
      setProcessMsg(res.data?.message || 'Payroll processed');
      fetchRecords();
    } catch (e: any) {
      setProcessMsg(e.message || 'Failed to process payroll');
    } finally {
      setProcessing(false);
    }
  };

  const recordByEmployee = new Map(records.map(r => [r.employeeId, r]));

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold">Payroll & Pay Slips</h2>
          <p className="text-sm text-muted-foreground">
            Auto-calculate salary from attendance, or generate pay slips (Excel / PDF)
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Input
            type="month"
            value={month}
            onChange={(e) => setMonth(e.target.value)}
            className="w-auto"
          />
          <Button onClick={processPayroll} disabled={processing}>
            <Calculator className="h-4 w-4 mr-1" />
            {processing ? 'Processing...' : 'Process Payroll'}
          </Button>
        </div>
      </div>

      {processMsg && <p className="text-sm text-muted-foreground">{processMsg}</p>}

      <Card>
        <CardHeader>
          <CardTitle>Employees - {month}</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <p className="text-center text-muted-foreground py-8">Loading...</p>
          ) : error ? (
            <p className="text-center text-red-600 py-8">{error}</p>
          ) : employees.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">No active employees found</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Employee ID</TableHead>
                  <TableHead>Name</TableHead>
                  <TableHead>Department</TableHead>
                  <TableHead>Monthly Salary</TableHead>
                  <TableHead>Net Pay (processed)</TableHead>
                  <TableHead className="text-right">Pay Slip</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {employees.map(emp => {
                  const busy = exporting && exporting.startsWith(`${emp.id}:`);
                  const pr = recordByEmployee.get(emp.id);
                  return (
                    <TableRow key={emp.id}>
                      <TableCell className="font-medium">{emp.employeeId}</TableCell>
                      <TableCell>{emp.firstName} {emp.lastName}</TableCell>
                      <TableCell>{emp.department?.name || '—'}</TableCell>
                      <TableCell>{fmtMoney(emp.salary)}</TableCell>
                      <TableCell>
                        {pr ? (
                          <span className="font-semibold">{fmtMoney(pr.netPay)}</span>
                        ) : (
                          <span className="text-muted-foreground">Not processed</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="flex justify-end gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => exportPayslip(emp.id, emp.employeeId, 'xlsx')}
                            disabled={!!exporting}
                          >
                            <FileSpreadsheet className="h-4 w-4 mr-1" />
                            {busy && exporting?.endsWith(':xlsx') ? '...' : 'Excel'}
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => exportPayslip(emp.id, emp.employeeId, 'pdf')}
                            disabled={!!exporting}
                          >
                            <FileText className="h-4 w-4 mr-1" />
                            {busy && exporting?.endsWith(':pdf') ? '...' : 'PDF'}
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {records.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Processed Payroll Records - {month}</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Employee</TableHead>
                  <TableHead>Basic</TableHead>
                  <TableHead>Overtime Pay</TableHead>
                  <TableHead>Tax</TableHead>
                  <TableHead>Net Pay</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {records.map(r => (
                  <TableRow key={r.id}>
                    <TableCell>
                      {r.employee?.firstName} {r.employee?.lastName} ({r.employee?.employeeId})
                    </TableCell>
                    <TableCell>{fmtMoney(r.basicSalary)}</TableCell>
                    <TableCell>{fmtMoney(r.overtimePay)}</TableCell>
                    <TableCell>{fmtMoney(r.tax)}</TableCell>
                    <TableCell className="font-semibold">{fmtMoney(r.netPay)}</TableCell>
                    <TableCell>{r.status}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export { PayrollPage };