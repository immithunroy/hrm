/**
 * LoansPage - Employee loan management page with installment tracking.
 *
 * Features:
 * - Loan listing with search, status filter, and pagination
 * - Create loan modal with amount, interest rate, installment config
 * - Loan lifecycle actions: Approve, Disburse, Cancel
 * - Loan detail modal with installment table and payment recording
 * - Summary stats: Active loans, total borrowed, outstanding, overdue
 * - Partial installment payments supported
 *
 * State management:
 * - Multiple modals: create, detail, and pay installment
 * - Search filter applied client-side on paginated results
 * - Summary fetched per logged-in user
 */

import React, { useState, useEffect, useCallback } from 'react';
import { api } from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import { fmtMoney, fmtDhakaDate } from '../../lib/format';
import {
  Card,
  CardHeader,
  CardTitle,
  CardContent,
  CardFooter,
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
  Pagination,
  PaginationContent,
  PaginationList,
  PaginationItem,
  PaginationPrevious,
  PaginationNext,
} from '@/components/ui';

const LOAN_STATUS_STYLES: Record<string, string> = {
  PENDING: 'bg-yellow-100 text-yellow-800',
  APPROVED: 'bg-blue-100 text-blue-800',
  ACTIVE: 'bg-green-100 text-green-800',
  COMPLETED: 'bg-gray-100 text-gray-800',
  CANCELLED: 'bg-red-100 text-red-800',
  DEFAULTED: 'bg-red-100 text-red-800',
};

const INSTALLMENT_STATUS_STYLES: Record<string, string> = {
  PENDING: 'bg-yellow-100 text-yellow-800',
  PAID: 'bg-green-100 text-green-800',
  PARTIAL: 'bg-blue-100 text-blue-800',
  OVERDUE: 'bg-red-100 text-red-800',
  WAIVED: 'bg-gray-100 text-gray-800',
};

const FREQUENCY_OPTIONS = ['WEEKLY', 'BIWEEKLY', 'MONTHLY', 'QUARTERLY'];

const LoansPage = () => {
  const { user } = useAuth();
  const [loans, setLoans] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [totalLoans, setTotalLoans] = useState(0);
  const [totalPages, setTotalPages] = useState(1);

  const [summary, setSummary] = useState({
    totalLoans: 0,
    activeLoans: 0,
    totalBorrowed: 0,
    totalRepaid: 0,
    totalOutstanding: 0,
    overdueCount: 0,
    overdueAmount: 0,
  });

  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [showPayModal, setShowPayModal] = useState(false);
  const [selectedLoan, setSelectedLoan] = useState<any>(null);
  const [detailLoan, setDetailLoan] = useState<any>(null);
  const [employees, setEmployees] = useState<any[]>([]);

  const [createForm, setCreateForm] = useState({
    employeeId: '',
    amount: '',
    interestRate: '0',
    purpose: '',
    startDate: '',
    installmentAmount: '',
    installmentCount: '',
    frequency: 'MONTHLY',
    notes: '',
  });

  const [payAmount, setPayAmount] = useState('');

  const fetchLoans = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: String(currentPage),
        limit: '20',
      });
      if (statusFilter) params.set('status', statusFilter);
      const res = await api.get<any>(`/loans?${params.toString()}`);
      let items = res.data.loans || [];
      if (search) {
        const q = search.toLowerCase();
        items = items.filter(
          (l: any) =>
            l.employee?.firstName?.toLowerCase().includes(q) ||
            l.employee?.lastName?.toLowerCase().includes(q) ||
            l.employee?.employeeId?.toLowerCase().includes(q) ||
            l.purpose?.toLowerCase().includes(q)
        );
      }
      setLoans(items);
      setTotalLoans(res.data.total || 0);
      setTotalPages(res.data.totalPages || 1);
      setError('');
    } catch (e: any) {
      setError(e.message || 'Failed to load loans');
    } finally {
      setLoading(false);
    }
  }, [currentPage, statusFilter, search]);

  const fetchSummary = useCallback(async () => {
    if (!user) return;
    try {
      const res = await api.get<any>(`/loans/${user.id}/summary`);
      setSummary(res.data);
    } catch {
      // summary is optional
    }
  }, [user]);

  const fetchEmployees = useCallback(async () => {
    try {
      const res = await api.get<any>('/employees?limit=500');
      setEmployees(res.data.employees || []);
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    fetchLoans();
  }, [fetchLoans]);

  useEffect(() => {
    fetchSummary();
    fetchEmployees();
  }, [fetchSummary, fetchEmployees]);

  const handleCreateLoan = async () => {
    try {
      const payload: any = {
        employeeId: createForm.employeeId,
        amount: Number(createForm.amount),
        interestRate: Number(createForm.interestRate),
        purpose: createForm.purpose,
        startDate: new Date(createForm.startDate).toISOString(),
        frequency: createForm.frequency,
      };
      if (createForm.installmentAmount) payload.installmentAmount = Number(createForm.installmentAmount);
      if (createForm.installmentCount) payload.installmentCount = Number(createForm.installmentCount);
      if (createForm.notes) payload.notes = createForm.notes;

      await api.post('/loans', payload);
      setShowCreateModal(false);
      setCreateForm({
        employeeId: '',
        amount: '',
        interestRate: '0',
        purpose: '',
        startDate: '',
        installmentAmount: '',
        installmentCount: '',
        frequency: 'MONTHLY',
        notes: '',
      });
      fetchLoans();
    } catch (e: any) {
      alert(e.message || 'Failed to create loan');
    }
  };

  const handleApprove = async (loanId: string) => {
    if (!confirm('Approve this loan?')) return;
    try {
      await api.post(`/loans/${loanId}/approve`, { approvedBy: user?.id });
      fetchLoans();
      if (detailLoan?.id === loanId) fetchDetail(loanId);
    } catch (e: any) {
      alert(e.message || 'Failed to approve');
    }
  };

  const handleDisburse = async (loanId: string) => {
    if (!confirm('Disburse this loan?')) return;
    try {
      await api.post(`/loans/${loanId}/disburse`, {});
      fetchLoans();
      if (detailLoan?.id === loanId) fetchDetail(loanId);
    } catch (e: any) {
      alert(e.message || 'Failed to disburse');
    }
  };

  const handleCancel = async (loanId: string) => {
    if (!confirm('Cancel this loan? This action cannot be undone.')) return;
    try {
      await api.post(`/loans/${loanId}/cancel`, {});
      fetchLoans();
      setShowDetailModal(false);
    } catch (e: any) {
      alert(e.message || 'Failed to cancel');
    }
  };

  const fetchDetail = async (loanId: string) => {
    try {
      const res = await api.get<any>(`/loans/${loanId}`);
      setDetailLoan(res.data);
      setShowDetailModal(true);
    } catch (e: any) {
      alert(e.message || 'Failed to load loan details');
    }
  };

  const openPayModal = (installment: any) => {
    setSelectedLoan(installment);
    setPayAmount(String(installment.amount ? Number(installment.amount) - Number(installment.paidAmount || 0) : ''));
    setShowPayModal(true);
  };

  const handlePayInstallment = async () => {
    if (!selectedLoan || !detailLoan) return;
    try {
      await api.post(`/loans/${detailLoan.id}/installments/${selectedLoan.id}/pay`, {
        amount: Number(payAmount),
      });
      setShowPayModal(false);
      fetchDetail(detailLoan.id);
      fetchLoans();
    } catch (e: any) {
      alert(e.message || 'Failed to record payment');
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between">
        <CardHeader>
          <h2 className="text-xl font-bold">Loan Management</h2>
          <p className="text-sm text-muted-foreground">Manage employee loans and installments</p>
        </CardHeader>
        <div className="flex gap-3">
          <Input
            placeholder="Search employee or purpose..."
            value={search}
            onChange={(e) => { setSearch(e.target.value); setCurrentPage(1); }}
            className="w-full max-w-xs"
          />
          <Button onClick={() => setShowCreateModal(true)}>New Loan</Button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <p className="text-sm text-muted-foreground">Active Loans</p>
            <p className="text-2xl font-bold">{summary.activeLoans}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-sm text-muted-foreground">Total Borrowed</p>
            <p className="text-2xl font-bold">{fmtMoney(summary.totalBorrowed)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-sm text-muted-foreground">Outstanding</p>
            <p className="text-2xl font-bold text-orange-600">{fmtMoney(summary.totalOutstanding)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-sm text-muted-foreground">Overdue Installments</p>
            <p className="text-2xl font-bold text-red-600">{summary.overdueCount}</p>
          </CardContent>
        </Card>
      </div>

      {/* Status filter */}
      <div className="flex gap-2 flex-wrap">
        {['', 'PENDING', 'APPROVED', 'ACTIVE', 'COMPLETED', 'CANCELLED', 'DEFAULTED'].map((s) => (
          <Button
            key={s}
            variant={statusFilter === s ? 'default' : 'outline'}
            size="xs"
            onClick={() => { setStatusFilter(s); setCurrentPage(1); }}
          >
            {s || 'All'}
          </Button>
        ))}
      </div>

      {/* Table */}
      {loading ? (
        <div className="text-center py-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
          <p className="mt-2 text-muted-foreground">Loading loans...</p>
        </div>
      ) : error ? (
        <div className="text-center py-8 text-red-600">{error}</div>
      ) : loans.length === 0 ? (
        <div className="text-center py-8 text-muted-foreground">No loans found</div>
      ) : (
        <Card>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Employee</TableHead>
                  <TableHead>Amount</TableHead>
                  <TableHead>Interest</TableHead>
                  <TableHead>Total</TableHead>
                  <TableHead>Remaining</TableHead>
                  <TableHead>Frequency</TableHead>
                  <TableHead>Start Date</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loans.map((loan) => (
                  <TableRow key={loan.id}>
                    <TableCell>
                      <div>
                        <p className="font-medium">{loan.employee?.firstName} {loan.employee?.lastName}</p>
                        <p className="text-xs text-muted-foreground">{loan.employee?.employeeId}</p>
                      </div>
                    </TableCell>
                    <TableCell>{fmtMoney(loan.amount)}</TableCell>
                    <TableCell>{Number(loan.interestRate)}%</TableCell>
                    <TableCell>{fmtMoney(loan.totalAmount)}</TableCell>
                    <TableCell className={Number(loan.remainingAmount) > 0 ? 'text-orange-600 font-medium' : ''}>
                      {fmtMoney(loan.remainingAmount)}
                    </TableCell>
                    <TableCell>{loan.frequency}</TableCell>
                    <TableCell>{fmtDhakaDate(loan.startDate)}</TableCell>
                    <TableCell>
                      <span className={`px-2 py-1 text-xs rounded-full ${LOAN_STATUS_STYLES[loan.status] || ''}`}>
                        {loan.status}
                      </span>
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        <Button variant="outline" size="xs" onClick={() => fetchDetail(loan.id)}>
                          View
                        </Button>
                        {loan.status === 'PENDING' && (
                          <>
                            <Button variant="outline" size="xs" onClick={() => handleApprove(loan.id)}>
                              Approve
                            </Button>
                            <Button variant="destructive" size="xs" onClick={() => handleCancel(loan.id)}>
                              Cancel
                            </Button>
                          </>
                        )}
                        {loan.status === 'APPROVED' && (
                          <Button variant="outline" size="xs" onClick={() => handleDisburse(loan.id)}>
                            Disburse
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
          <CardFooter className="flex justify-between items-center">
            <p className="text-sm text-muted-foreground">
              Page {currentPage} of {totalPages} ({totalLoans} loans)
            </p>
            <Pagination>
              <PaginationContent>
                <PaginationPrevious onClick={() => setCurrentPage((p) => Math.max(1, p - 1))} />
                <PaginationList>
                  {[...Array(totalPages)].map((_, i) => (
                    <PaginationItem
                      key={i}
                      active={i + 1 === currentPage}
                      onClick={() => setCurrentPage(i + 1)}
                    >
                      {i + 1}
                    </PaginationItem>
                  ))}
                </PaginationList>
                <PaginationNext onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))} />
              </PaginationContent>
            </Pagination>
          </CardFooter>
        </Card>
      )}

      {/* Create Loan Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/50" onClick={() => setShowCreateModal(false)} />
          <div className="relative bg-card rounded-lg shadow-lg w-full max-w-lg mx-4 max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <h3 className="text-lg font-bold mb-4">Create New Loan</h3>
              <div className="space-y-4">
                <div>
                  <Label>Employee *</Label>
                  <select
                    className="w-full border border-input rounded-md px-3 py-2 text-sm bg-background"
                    value={createForm.employeeId}
                    onChange={(e) => setCreateForm({ ...createForm, employeeId: e.target.value })}
                  >
                    <option value="">Select employee</option>
                    {employees.map((emp) => (
                      <option key={emp.id} value={emp.id}>
                        {emp.firstName} {emp.lastName} ({emp.employeeId})
                      </option>
                    ))}
                  </select>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label>Loan Amount *</Label>
                    <Input
                      type="number"
                      value={createForm.amount}
                      onChange={(e) => setCreateForm({ ...createForm, amount: e.target.value })}
                      placeholder="0.00"
                    />
                  </div>
                  <div>
                    <Label>Interest Rate (%)</Label>
                    <Input
                      type="number"
                      value={createForm.interestRate}
                      onChange={(e) => setCreateForm({ ...createForm, interestRate: e.target.value })}
                      placeholder="0"
                    />
                  </div>
                </div>
                <div>
                  <Label>Purpose</Label>
                  <Input
                    value={createForm.purpose}
                    onChange={(e) => setCreateForm({ ...createForm, purpose: e.target.value })}
                    placeholder="Loan purpose"
                  />
                </div>
                <div>
                  <Label>Start Date *</Label>
                  <Input
                    type="date"
                    value={createForm.startDate}
                    onChange={(e) => setCreateForm({ ...createForm, startDate: e.target.value })}
                  />
                </div>
                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <Label>Installment Amount</Label>
                    <Input
                      type="number"
                      value={createForm.installmentAmount}
                      onChange={(e) => setCreateForm({ ...createForm, installmentAmount: e.target.value })}
                      placeholder="0.00"
                    />
                  </div>
                  <div>
                    <Label>Installments</Label>
                    <Input
                      type="number"
                      value={createForm.installmentCount}
                      onChange={(e) => setCreateForm({ ...createForm, installmentCount: e.target.value })}
                      placeholder="0"
                    />
                  </div>
                  <div>
                    <Label>Frequency</Label>
                    <select
                      className="w-full border border-input rounded-md px-3 py-2 text-sm bg-background"
                      value={createForm.frequency}
                      onChange={(e) => setCreateForm({ ...createForm, frequency: e.target.value })}
                    >
                      {FREQUENCY_OPTIONS.map((f) => (
                        <option key={f} value={f}>{f}</option>
                      ))}
                    </select>
                  </div>
                </div>
                <div>
                  <Label>Notes</Label>
                  <Input
                    value={createForm.notes}
                    onChange={(e) => setCreateForm({ ...createForm, notes: e.target.value })}
                    placeholder="Optional notes"
                  />
                </div>
              </div>
              <div className="flex justify-end gap-3 mt-6">
                <Button variant="outline" onClick={() => setShowCreateModal(false)}>Cancel</Button>
                <Button
                  onClick={handleCreateLoan}
                  disabled={!createForm.employeeId || !createForm.amount || !createForm.startDate}
                >
                  Create Loan
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Detail Modal */}
      {showDetailModal && detailLoan && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/50" onClick={() => setShowDetailModal(false)} />
          <div className="relative bg-card rounded-lg shadow-lg w-full max-w-3xl mx-4 max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex justify-between items-start mb-4">
                <div>
                  <h3 className="text-lg font-bold">Loan Details</h3>
                  <p className="text-sm text-muted-foreground">
                    {detailLoan.employee?.firstName} {detailLoan.employee?.lastName} ({detailLoan.employee?.employeeId})
                  </p>
                </div>
                <span className={`px-2 py-1 text-xs rounded-full ${LOAN_STATUS_STYLES[detailLoan.status] || ''}`}>
                  {detailLoan.status}
                </span>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                <div>
                  <p className="text-xs text-muted-foreground">Loan Amount</p>
                  <p className="font-semibold">{fmtMoney(detailLoan.amount)}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Interest Rate</p>
                  <p className="font-semibold">{Number(detailLoan.interestRate)}%</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Total Amount</p>
                  <p className="font-semibold">{fmtMoney(detailLoan.totalAmount)}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Remaining</p>
                  <p className="font-semibold text-orange-600">{fmtMoney(detailLoan.remainingAmount)}</p>
                </div>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-6 text-sm">
                <div>
                  <p className="text-muted-foreground">Purpose</p>
                  <p>{detailLoan.purpose || '—'}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Start Date</p>
                  <p>{fmtDhakaDate(detailLoan.startDate)}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Frequency</p>
                  <p>{detailLoan.frequency}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Installment Amount</p>
                  <p>{detailLoan.installmentAmount ? fmtMoney(detailLoan.installmentAmount) : '—'}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Total Installments</p>
                  <p>{detailLoan.installmentCount || '—'}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Notes</p>
                  <p>{detailLoan.notes || '—'}</p>
                </div>
              </div>

              {/* Action buttons */}
              <div className="flex gap-2 mb-6">
                {detailLoan.status === 'PENDING' && (
                  <>
                    <Button size="sm" onClick={() => handleApprove(detailLoan.id)}>Approve</Button>
                    <Button size="sm" variant="destructive" onClick={() => handleCancel(detailLoan.id)}>Cancel</Button>
                  </>
                )}
                {detailLoan.status === 'APPROVED' && (
                  <Button size="sm" onClick={() => handleDisburse(detailLoan.id)}>Disburse</Button>
                )}
                {(detailLoan.status === 'ACTIVE' || detailLoan.status === 'APPROVED') && (
                  <Button size="sm" variant="destructive" onClick={() => handleCancel(detailLoan.id)}>Cancel Loan</Button>
                )}
              </div>

              {/* Installments */}
              {detailLoan.installments && detailLoan.installments.length > 0 && (
                <div>
                  <h4 className="font-semibold mb-3">Installments</h4>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>#</TableHead>
                        <TableHead>Due Date</TableHead>
                        <TableHead>Amount</TableHead>
                        <TableHead>Paid</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Action</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {detailLoan.installments.map((inst: any, idx: number) => (
                        <TableRow key={inst.id}>
                          <TableCell>{idx + 1}</TableCell>
                          <TableCell>{fmtDhakaDate(inst.dueDate)}</TableCell>
                          <TableCell>{fmtMoney(inst.amount)}</TableCell>
                          <TableCell>{fmtMoney(inst.paidAmount)}</TableCell>
                          <TableCell>
                            <span className={`px-2 py-1 text-xs rounded-full ${INSTALLMENT_STATUS_STYLES[inst.status] || ''}`}>
                              {inst.status}
                            </span>
                          </TableCell>
                          <TableCell>
                            {(inst.status === 'PENDING' || inst.status === 'PARTIAL' || inst.status === 'OVERDUE') && (
                              <Button variant="outline" size="xs" onClick={() => openPayModal(inst)}>
                                Pay
                              </Button>
                            )}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}

              <div className="flex justify-end mt-6">
                <Button variant="outline" onClick={() => setShowDetailModal(false)}>Close</Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Pay Installment Modal */}
      {showPayModal && selectedLoan && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/50" onClick={() => setShowPayModal(false)} />
          <div className="relative bg-card rounded-lg shadow-lg w-full max-w-sm mx-4">
            <div className="p-6">
              <h3 className="text-lg font-bold mb-4">Record Payment</h3>
              <div className="space-y-4">
                <div>
                  <Label>Payment Amount</Label>
                  <Input
                    type="number"
                    value={payAmount}
                    onChange={(e) => setPayAmount(e.target.value)}
                    placeholder="0.00"
                  />
                </div>
              </div>
              <div className="flex justify-end gap-3 mt-6">
                <Button variant="outline" onClick={() => setShowPayModal(false)}>Cancel</Button>
                <Button onClick={handlePayInstallment} disabled={!payAmount || Number(payAmount) <= 0}>
                  Record Payment
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default LoansPage;
