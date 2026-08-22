import React, { useState, useEffect, useCallback } from 'react';
import { api } from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import { fmtMoney, fmtDhakaDate } from '../../lib/format';
import {
  Card, CardHeader, CardTitle, CardContent, CardFooter,
  Button, Input, Label, Badge, Table, TableHeader, TableBody,
  TableRow, TableCell, TableHead,
  Pagination, PaginationContent, PaginationList, PaginationItem,
  PaginationPrevious, PaginationNext
} from '@/components/ui';

const BONUS_STATUS_STYLES: Record<string, string> = {
  PENDING: 'bg-yellow-100 text-yellow-800',
  APPROVED: 'bg-blue-100 text-blue-800',
  PAID: 'bg-green-100 text-green-800',
  CANCELLED: 'bg-red-100 text-red-800',
};

const FESTIVAL_LABELS: Record<string, string> = {
  EID_UL_FITR: 'Eid-ul-Fitr',
  EID_UL_ADHA: 'Eid-ul-Adha',
  OTHER: 'Other Festival',
};

const BONUS_TYPE_LABELS: Record<string, string> = {
  BASIC_SALARY: '2x Basic Salary',
  GROSS_SALARY: '1x Gross Salary',
};

const FestivalBonusPage = () => {
  const { user } = useAuth();
  const [bonuses, setBonuses] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [yearFilter, setYearFilter] = useState(new Date().getFullYear());
  const [statusFilter, setStatusFilter] = useState('');
  const [festivalFilter, setFestivalFilter] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);

  const [summary, setSummary] = useState({
    totalBonusCount: 0, totalBonusAmount: 0, paidAmount: 0,
    pendingAmount: 0, paidCount: 0, pendingCount: 0, approvedCount: 0,
  });

  const [employees, setEmployees] = useState<any[]>([]);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showAutoModal, setShowAutoModal] = useState(false);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [detailBonus, setDetailBonus] = useState<any>(null);

  const [createForm, setCreateForm] = useState({
    employeeId: '', festivalType: 'EID_UL_FITR', customFestivalName: '',
    year: new Date().getFullYear(), bonusType: 'BASIC_SALARY',
    paymentMode: 'ONE_TIME', notes: '',
  });

  const [autoForm, setAutoForm] = useState({
    year: new Date().getFullYear(), festivalType: 'EID_UL_FITR',
    bonusType: 'BASIC_SALARY', paymentMode: 'ONE_TIME',
  });

  const fetchBonuses = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: String(currentPage), limit: '20', year: String(yearFilter) });
      if (statusFilter) params.set('status', statusFilter);
      if (festivalFilter) params.set('festivalType', festivalFilter);
      const res = await api.get<any>(`/festival-bonuses?${params.toString()}`);
      let items = res.data.bonuses || [];
      if (search) {
        const q = search.toLowerCase();
        items = items.filter((b: any) =>
          b.employee?.firstName?.toLowerCase().includes(q) ||
          b.employee?.lastName?.toLowerCase().includes(q) ||
          b.employee?.employeeId?.toLowerCase().includes(q)
        );
      }
      setBonuses(items);
      setTotal(res.data.total || 0);
      setTotalPages(res.data.totalPages || 1);
      setError('');
    } catch (e: any) {
      setError(e.message || 'Failed to load festival bonuses');
    } finally {
      setLoading(false);
    }
  }, [currentPage, yearFilter, statusFilter, festivalFilter, search]);

  const fetchSummary = useCallback(async () => {
    try {
      const res = await api.get<any>(`/festival-bonuses/summary?year=${yearFilter}`);
      setSummary(res.data);
    } catch { /* ignore */ }
  }, [yearFilter]);

  const fetchEmployees = useCallback(async () => {
    try {
      const res = await api.get<any>('/employees?limit=500&status=ACTIVE');
      setEmployees(res.data.employees || []);
    } catch { /* ignore */ }
  }, []);

  useEffect(() => { fetchBonuses(); }, [fetchBonuses]);
  useEffect(() => { fetchSummary(); fetchEmployees(); }, [fetchSummary, fetchEmployees]);

  const handleCreate = async () => {
    try {
      await api.post('/festival-bonuses', createForm);
      setShowCreateModal(false);
      setCreateForm({ employeeId: '', festivalType: 'EID_UL_FITR', customFestivalName: '', year: new Date().getFullYear(), bonusType: 'BASIC_SALARY', paymentMode: 'ONE_TIME', notes: '' });
      fetchBonuses(); fetchSummary();
    } catch (e: any) { alert(e.message || 'Failed to create'); }
  };

  const handleAutoGenerate = async () => {
    try {
      const res = await api.post<any>('/festival-bonuses/auto-generate', autoForm);
      setShowAutoModal(false);
      alert(`Created ${res.data.created} bonuses, skipped ${res.data.skipped} (already exist)`);
      fetchBonuses(); fetchSummary();
    } catch (e: any) { alert(e.message || 'Failed to auto-generate'); }
  };

  const handleApprove = async (id: string) => {
    if (!confirm('Approve this bonus?')) return;
    try {
      await api.post(`/festival-bonuses/${id}/approve`, { approvedBy: user?.id });
      fetchBonuses(); fetchSummary();
    } catch (e: any) { alert(e.message || 'Failed to approve'); }
  };

  const handlePayInstallment = async (id: string, installmentNumber: number) => {
    if (!confirm(`Mark installment ${installmentNumber} as paid?`)) return;
    try {
      await api.post(`/festival-bonuses/${id}/installment`, { installmentNumber });
      fetchBonuses(); fetchSummary();
      if (detailBonus?.id === id) fetchDetail(id);
    } catch (e: any) { alert(e.message || 'Failed'); }
  };

  const handleCancel = async (id: string) => {
    if (!confirm('Cancel this bonus?')) return;
    try {
      await api.post(`/festival-bonuses/${id}/cancel`, {});
      fetchBonuses(); fetchSummary();
      setShowDetailModal(false);
    } catch (e: any) { alert(e.message || 'Failed to cancel'); }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this bonus? This cannot be undone.')) return;
    try {
      await api.delete(`/festival-bonuses/${id}`);
      fetchBonuses(); fetchSummary();
      setShowDetailModal(false);
    } catch (e: any) { alert(e.message || 'Failed to delete'); }
  };

  const fetchDetail = async (id: string) => {
    try {
      const res = await api.get<any>(`/festival-bonuses/${id}`);
      setDetailBonus(res.data);
      setShowDetailModal(true);
    } catch (e: any) { alert(e.message || 'Failed to load'); }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between">
        <CardHeader>
          <h2 className="text-xl font-bold">Festival Bonuses</h2>
          <p className="text-sm text-muted-foreground">Manage Eid and festival bonuses for employees</p>
        </CardHeader>
        <div className="flex gap-3 flex-wrap">
          <Input type="number" value={yearFilter} onChange={(e) => { setYearFilter(Number(e.target.value)); setCurrentPage(1); }} className="w-24" />
          <Input placeholder="Search employee..." value={search} onChange={(e) => { setSearch(e.target.value); setCurrentPage(1); }} className="w-48" />
          <Button onClick={() => setShowCreateModal(true)}>New Bonus</Button>
          <Button variant="outline" onClick={() => setShowAutoModal(true)}>Auto-Generate</Button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card><CardContent className="p-4">
          <p className="text-sm text-muted-foreground">Total Bonuses</p>
          <p className="text-2xl font-bold">{summary.totalBonusCount}</p>
        </CardContent></Card>
        <Card><CardContent className="p-4">
          <p className="text-sm text-muted-foreground">Total Amount</p>
          <p className="text-2xl font-bold">{fmtMoney(summary.totalBonusAmount)}</p>
        </CardContent></Card>
        <Card><CardContent className="p-4">
          <p className="text-sm text-muted-foreground">Paid</p>
          <p className="text-2xl font-bold text-green-600">{fmtMoney(summary.paidAmount)}</p>
        </CardContent></Card>
        <Card><CardContent className="p-4">
          <p className="text-sm text-muted-foreground">Pending</p>
          <p className="text-2xl font-bold text-orange-600">{fmtMoney(summary.pendingAmount)}</p>
        </CardContent></Card>
      </div>

      {/* Filters */}
      <div className="flex gap-2 flex-wrap">
        {[{ v: '', l: 'All' }, { v: 'PENDING', l: 'Pending' }, { v: 'APPROVED', l: 'Approved' }, { v: 'PAID', l: 'Paid' }, { v: 'CANCELLED', l: 'Cancelled' }].map(f => (
          <Button key={f.v} variant={statusFilter === f.v ? 'default' : 'outline'} size="xs" onClick={() => { setStatusFilter(f.v); setCurrentPage(1); }}>{f.l}</Button>
        ))}
        <span className="mx-2 border-l" />
        {[{ v: '', l: 'All Festivals' }, { v: 'EID_UL_FITR', l: 'Eid-ul-Fitr' }, { v: 'EID_UL_ADHA', l: 'Eid-ul-Adha' }, { v: 'OTHER', l: 'Other' }].map(f => (
          <Button key={f.v} variant={festivalFilter === f.v ? 'default' : 'outline'} size="xs" onClick={() => { setFestivalFilter(f.v); setCurrentPage(1); }}>{f.l}</Button>
        ))}
      </div>

      {/* Table */}
      {loading ? (
        <div className="text-center py-8"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto" /></div>
      ) : error ? (
        <div className="text-center py-8 text-red-600">{error}</div>
      ) : bonuses.length === 0 ? (
        <div className="text-center py-8 text-muted-foreground">No festival bonuses found</div>
      ) : (
        <Card>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Employee</TableHead>
                  <TableHead>Festival</TableHead>
                  <TableHead>Bonus Type</TableHead>
                  <TableHead>Total Amount</TableHead>
                  <TableHead>Payment Mode</TableHead>
                  <TableHead>Installments</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {bonuses.map((b) => (
                  <TableRow key={b.id}>
                    <TableCell>
                      <div>
                        <p className="font-medium">{b.employee?.firstName} {b.employee?.lastName}</p>
                        <p className="text-xs text-muted-foreground">{b.employee?.employeeId}</p>
                      </div>
                    </TableCell>
                    <TableCell>{b.festivalType === 'OTHER' ? (b.customFestivalName || 'Other') : FESTIVAL_LABELS[b.festivalType]}</TableCell>
                    <TableCell>{BONUS_TYPE_LABELS[b.bonusType]}</TableCell>
                    <TableCell className="font-semibold">{fmtMoney(b.totalAmount)}</TableCell>
                    <TableCell>{b.paymentMode === 'ONE_TIME' ? 'One Time' : '2 Installments'}</TableCell>
                    <TableCell>
                      {b.paymentMode === 'ONE_TIME' ? (
                        <Badge variant={b.status === 'PAID' ? 'default' : 'secondary'}>{b.status === 'PAID' ? 'Paid' : 'Pending'}</Badge>
                      ) : (
                        <div className="text-xs space-y-1">
                          <div>1: <Badge variant={b.installment1Status === 'PAID' ? 'default' : 'secondary'} size="sm">{b.installment1Status}</Badge> {fmtMoney(b.installment1Amount)}</div>
                          <div>2: <Badge variant={b.installment2Status === 'PAID' ? 'default' : 'secondary'} size="sm">{b.installment2Status}</Badge> {fmtMoney(b.installment2Amount)}</div>
                        </div>
                      )}
                    </TableCell>
                    <TableCell><span className={`px-2 py-1 text-xs rounded-full ${BONUS_STATUS_STYLES[b.status] || ''}`}>{b.status}</span></TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        <Button variant="outline" size="xs" onClick={() => fetchDetail(b.id)}>View</Button>
                        {b.status === 'PENDING' && <Button variant="outline" size="xs" onClick={() => handleApprove(b.id)}>Approve</Button>}
                        {b.status !== 'PAID' && b.status !== 'CANCELLED' && <Button variant="destructive" size="xs" onClick={() => handleCancel(b.id)}>Cancel</Button>}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
          <CardFooter className="flex justify-between items-center">
            <p className="text-sm text-muted-foreground">Page {currentPage} of {totalPages} ({total} bonuses)</p>
            <Pagination>
              <PaginationContent>
                <PaginationPrevious onClick={() => setCurrentPage(p => Math.max(1, p - 1))} />
                <PaginationList>
                  {[...Array(totalPages)].map((_, i) => (
                    <PaginationItem key={i} active={i + 1 === currentPage} onClick={() => setCurrentPage(i + 1)}>{i + 1}</PaginationItem>
                  ))}
                </PaginationList>
                <PaginationNext onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))} />
              </PaginationContent>
            </Pagination>
          </CardFooter>
        </Card>
      )}

      {/* Create Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/50" onClick={() => setShowCreateModal(false)} />
          <div className="relative bg-card rounded-lg shadow-lg w-full max-w-lg mx-4 max-h-[90vh] overflow-y-auto p-6">
            <h3 className="text-lg font-bold mb-4">Create Festival Bonus</h3>
            <div className="space-y-4">
              <div>
                <Label>Employee *</Label>
                <select className="w-full border border-input rounded-md px-3 py-2 text-sm bg-background" value={createForm.employeeId} onChange={(e) => setCreateForm({ ...createForm, employeeId: e.target.value })}>
                  <option value="">Select employee</option>
                  {employees.map(emp => <option key={emp.id} value={emp.id}>{emp.firstName} {emp.lastName} ({emp.employeeId})</option>)}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Festival Type *</Label>
                  <select className="w-full border border-input rounded-md px-3 py-2 text-sm bg-background" value={createForm.festivalType} onChange={(e) => setCreateForm({ ...createForm, festivalType: e.target.value })}>
                    <option value="EID_UL_FITR">Eid-ul-Fitr</option>
                    <option value="EID_UL_ADHA">Eid-ul-Adha</option>
                    <option value="OTHER">Other Festival</option>
                  </select>
                </div>
                <div>
                  <Label>Year *</Label>
                  <Input type="number" value={createForm.year} onChange={(e) => setCreateForm({ ...createForm, year: Number(e.target.value) })} />
                </div>
              </div>
              {createForm.festivalType === 'OTHER' && (
                <div>
                  <Label>Custom Festival Name</Label>
                  <Input value={createForm.customFestivalName} onChange={(e) => setCreateForm({ ...createForm, customFestivalName: e.target.value })} placeholder="e.g. Durga Puja, Christmas" />
                </div>
              )}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Bonus Calculation *</Label>
                  <select className="w-full border border-input rounded-md px-3 py-2 text-sm bg-background" value={createForm.bonusType} onChange={(e) => setCreateForm({ ...createForm, bonusType: e.target.value })}>
                    <option value="BASIC_SALARY">2x Basic Salary</option>
                    <option value="GROSS_SALARY">1x Gross Salary</option>
                  </select>
                </div>
                <div>
                  <Label>Payment Mode *</Label>
                  <select className="w-full border border-input rounded-md px-3 py-2 text-sm bg-background" value={createForm.paymentMode} onChange={(e) => setCreateForm({ ...createForm, paymentMode: e.target.value })}>
                    <option value="ONE_TIME">One Time</option>
                    <option value="TWO_INSTALLMENTS">2 Installments</option>
                  </select>
                </div>
              </div>
              <div>
                <Label>Notes</Label>
                <Input value={createForm.notes} onChange={(e) => setCreateForm({ ...createForm, notes: e.target.value })} placeholder="Optional notes" />
              </div>
            </div>
            <div className="flex justify-end gap-3 mt-6">
              <Button variant="outline" onClick={() => setShowCreateModal(false)}>Cancel</Button>
              <Button onClick={handleCreate} disabled={!createForm.employeeId}>Create</Button>
            </div>
          </div>
        </div>
      )}

      {/* Auto-Generate Modal */}
      {showAutoModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/50" onClick={() => setShowAutoModal(false)} />
          <div className="relative bg-card rounded-lg shadow-lg w-full max-w-md mx-4 p-6">
            <h3 className="text-lg font-bold mb-4">Auto-Generate Festival Bonuses</h3>
            <p className="text-sm text-muted-foreground mb-4">Creates bonuses for all eligible active employees based on their religion.</p>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Year *</Label>
                  <Input type="number" value={autoForm.year} onChange={(e) => setAutoForm({ ...autoForm, year: Number(e.target.value) })} />
                </div>
                <div>
                  <Label>Festival *</Label>
                  <select className="w-full border border-input rounded-md px-3 py-2 text-sm bg-background" value={autoForm.festivalType} onChange={(e) => setAutoForm({ ...autoForm, festivalType: e.target.value })}>
                    <option value="EID_UL_FITR">Eid-ul-Fitr (Muslims only)</option>
                    <option value="EID_UL_ADHA">Eid-ul-Adha (Muslims only)</option>
                    <option value="OTHER">Other Festival (Non-Muslims)</option>
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Bonus Calculation *</Label>
                  <select className="w-full border border-input rounded-md px-3 py-2 text-sm bg-background" value={autoForm.bonusType} onChange={(e) => setAutoForm({ ...autoForm, bonusType: e.target.value })}>
                    <option value="BASIC_SALARY">2x Basic Salary</option>
                    <option value="GROSS_SALARY">1x Gross Salary</option>
                  </select>
                </div>
                <div>
                  <Label>Payment Mode *</Label>
                  <select className="w-full border border-input rounded-md px-3 py-2 text-sm bg-background" value={autoForm.paymentMode} onChange={(e) => setAutoForm({ ...autoForm, paymentMode: e.target.value })}>
                    <option value="ONE_TIME">One Time</option>
                    <option value="TWO_INSTALLMENTS">2 Installments</option>
                  </select>
                </div>
              </div>
            </div>
            <div className="flex justify-end gap-3 mt-6">
              <Button variant="outline" onClick={() => setShowAutoModal(false)}>Cancel</Button>
              <Button onClick={handleAutoGenerate}>Generate</Button>
            </div>
          </div>
        </div>
      )}

      {/* Detail Modal */}
      {showDetailModal && detailBonus && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/50" onClick={() => setShowDetailModal(false)} />
          <div className="relative bg-card rounded-lg shadow-lg w-full max-w-2xl mx-4 max-h-[90vh] overflow-y-auto p-6">
            <div className="flex justify-between items-start mb-4">
              <div>
                <h3 className="text-lg font-bold">Festival Bonus Details</h3>
                <p className="text-sm text-muted-foreground">{detailBonus.employee?.firstName} {detailBonus.employee?.lastName} ({detailBonus.employee?.employeeId})</p>
              </div>
              <span className={`px-2 py-1 text-xs rounded-full ${BONUS_STATUS_STYLES[detailBonus.status] || ''}`}>{detailBonus.status}</span>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-6 text-sm">
              <div><p className="text-muted-foreground">Festival</p><p className="font-semibold">{detailBonus.festivalType === 'OTHER' ? detailBonus.customFestivalName : FESTIVAL_LABELS[detailBonus.festivalType]}</p></div>
              <div><p className="text-muted-foreground">Year</p><p className="font-semibold">{detailBonus.year}</p></div>
              <div><p className="text-muted-foreground">Bonus Type</p><p className="font-semibold">{BONUS_TYPE_LABELS[detailBonus.bonusType]}</p></div>
              <div><p className="text-muted-foreground">Total Amount</p><p className="font-semibold text-lg">{fmtMoney(detailBonus.totalAmount)}</p></div>
              <div><p className="text-muted-foreground">Payment Mode</p><p className="font-semibold">{detailBonus.paymentMode === 'ONE_TIME' ? 'One Time' : '2 Installments'}</p></div>
              <div><p className="text-muted-foreground">Department</p><p className="font-semibold">{detailBonus.employee?.department?.name || '—'}</p></div>
            </div>

            {detailBonus.paymentMode === 'TWO_INSTALLMENTS' && (
              <div className="mb-6">
                <h4 className="font-semibold mb-3">Installments</h4>
                <Table>
                  <TableHeader><TableRow><TableHead>#</TableHead><TableHead>Amount</TableHead><TableHead>Date</TableHead><TableHead>Status</TableHead><TableHead>Action</TableHead></TableRow></TableHeader>
                  <TableBody>
                    <TableRow>
                      <TableCell>1</TableCell>
                      <TableCell>{fmtMoney(detailBonus.installment1Amount)}</TableCell>
                      <TableCell>{detailBonus.installment1Date ? fmtDhakaDate(detailBonus.installment1Date) : '—'}</TableCell>
                      <TableCell><Badge variant={detailBonus.installment1Status === 'PAID' ? 'default' : 'secondary'}>{detailBonus.installment1Status}</Badge></TableCell>
                      <TableCell>{detailBonus.installment1Status !== 'PAID' && detailBonus.status !== 'CANCELLED' && <Button variant="outline" size="xs" onClick={() => handlePayInstallment(detailBonus.id, 1)}>Mark Paid</Button>}</TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell>2</TableCell>
                      <TableCell>{fmtMoney(detailBonus.installment2Amount)}</TableCell>
                      <TableCell>{detailBonus.installment2Date ? fmtDhakaDate(detailBonus.installment2Date) : '—'}</TableCell>
                      <TableCell><Badge variant={detailBonus.installment2Status === 'PAID' ? 'default' : 'secondary'}>{detailBonus.installment2Status}</Badge></TableCell>
                      <TableCell>{detailBonus.installment2Status !== 'PAID' && detailBonus.status !== 'CANCELLED' && <Button variant="outline" size="xs" onClick={() => handlePayInstallment(detailBonus.id, 2)}>Mark Paid</Button>}</TableCell>
                    </TableRow>
                  </TableBody>
                </Table>
              </div>
            )}

            <div className="flex justify-between">
              <div className="flex gap-2">
                {detailBonus.status === 'PENDING' && <Button size="sm" onClick={() => { handleApprove(detailBonus.id); setShowDetailModal(false); }}>Approve</Button>}
                {detailBonus.status !== 'PAID' && detailBonus.status !== 'CANCELLED' && <Button size="sm" variant="destructive" onClick={() => { handleCancel(detailBonus.id); }}>Cancel</Button>}
                {detailBonus.status !== 'PAID' && <Button size="sm" variant="destructive" onClick={() => handleDelete(detailBonus.id)}>Delete</Button>}
              </div>
              <Button variant="outline" onClick={() => setShowDetailModal(false)}>Close</Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default FestivalBonusPage;
