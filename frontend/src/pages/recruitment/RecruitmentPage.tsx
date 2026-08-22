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
import {
  Plus,
  Pencil,
  Trash2,
  Users,
  Briefcase,
  Upload,
  FileText,
  Eye,
  X
} from 'lucide-react';
import { api } from '../../services/api';
import { RECRUITMENT_STATUS_STYLES, APPLICATION_STATUS_STYLES, ACCENT_BG } from '../../lib/colors';

const EMPLOYMENT_TYPES = ['FULL_TIME', 'PART_TIME', 'CONTRACT', 'INTERN', 'TEMPORARY'];
const RECRUITMENT_STATUSES = ['OPEN', 'CLOSED', 'ON_HOLD', 'CANCELLED'];
const APPLICATION_STATUSES = ['NEW', 'REVIEWED', 'INTERVIEWED', 'OFFERED', 'HIRED', 'REJECTED'];

interface EducationEntry {
  degree: string;
  institution: string;
  field: string;
  startYear: string;
  endYear: string;
}

const emptyJobForm = () => ({
  jobTitle: '',
  departmentId: '',
  positionId: '',
  openings: '1',
  employmentType: 'FULL_TIME',
  status: 'OPEN',
  location: '',
  salaryRangeMin: '',
  salaryRangeMax: '',
  closingDate: '',
  description: '',
  requirements: '',
  responsibilities: ''
});

const emptyApplicantForm = () => ({
  firstName: '',
  lastName: '',
  email: '',
  phone: '',
  address: '',
  city: '',
  state: '',
  zipCode: '',
  country: '',
  coverLetter: '',
  notes: '',
  education: [] as EducationEntry[]
});

const RecruitmentPage = () => {
  const [jobs, setJobs] = useState<any[]>([]);
  const [meta, setMeta] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  // Job post modal
  const [jobModalOpen, setJobModalOpen] = useState(false);
  const [editingJob, setEditingJob] = useState<any>(null);
  const [jobForm, setJobForm] = useState(emptyJobForm());

  // Applicants
  const [activeRecruitment, setActiveRecruitment] = useState<any>(null);
  const [applicants, setApplicants] = useState<any[]>([]);
  const [applicantsLoading, setApplicantsLoading] = useState(false);

  const [applicantModalOpen, setApplicantModalOpen] = useState(false);
  const [editingApplicant, setEditingApplicant] = useState<any>(null);
  const [applicantForm, setApplicantForm] = useState(emptyApplicantForm());
  const [cvFile, setCvFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);

  const fetchRecruitments = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get<any>('/recruitment?limit=100');
      setJobs(res.data.recruitments || []);
      setError('');
    } catch (e: any) {
      setError(e.message || 'Failed to load recruitments');
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchMeta = useCallback(async () => {
    try {
      const res = await api.get<any>('/employees/meta');
      setMeta(res.data);
      const deptId = res.data.departments[0]?.id || '';
      const posId = res.data.positions[0]?.id || '';
      setJobForm(f => ({ ...f, departmentId: f.departmentId || deptId, positionId: f.positionId || posId }));
    } catch (e) {
      console.warn('Failed to load form meta:', e);
    }
  }, []);

  useEffect(() => {
    fetchRecruitments();
    fetchMeta();
  }, [fetchRecruitments, fetchMeta]);

  const openApplicants = async (recruitment: any) => {
    setActiveRecruitment(recruitment);
    setApplicantsLoading(true);
    setApplicants([]);
    try {
      const res = await api.get<any>(`/recruitment/${recruitment.id}/applicants?limit=200`);
      setApplicants(res.data.applicants || []);
    } catch (e: any) {
      alert(e.message || 'Failed to load applicants');
    } finally {
      setApplicantsLoading(false);
    }
  };

  const closeApplicants = () => {
    setActiveRecruitment(null);
    setApplicants([]);
    setApplicantModalOpen(false);
  };

  const saveJob = async () => {
    if (!jobForm.jobTitle || !jobForm.departmentId || !jobForm.positionId) {
      alert('Job title, department and position are required');
      return;
    }
    setSaving(true);
    try {
      const payload: any = {
        jobTitle: jobForm.jobTitle,
        departmentId: jobForm.departmentId,
        positionId: jobForm.positionId,
        openings: Number(jobForm.openings) || 1,
        employmentType: jobForm.employmentType,
        status: jobForm.status,
        location: jobForm.location || undefined,
        salaryRangeMin: jobForm.salaryRangeMin ? Number(jobForm.salaryRangeMin) : undefined,
        salaryRangeMax: jobForm.salaryRangeMax ? Number(jobForm.salaryRangeMax) : undefined,
        closingDate: jobForm.closingDate ? new Date(`${jobForm.closingDate}T23:59:00Z`).toISOString() : undefined,
        description: jobForm.description || undefined,
        requirements: jobForm.requirements || undefined,
        responsibilities: jobForm.responsibilities || undefined
      };
      if (editingJob) {
        await api.put<any>(`/recruitment/${editingJob.id}`, payload);
        alert('Job posting updated');
      } else {
        await api.post<any>('/recruitment', payload);
        alert('Job posting created');
      }
      setJobModalOpen(false);
      fetchRecruitments();
    } catch (e: any) {
      alert(e.message || 'Failed to save job posting');
    } finally {
      setSaving(false);
    }
  };

  const deleteJob = async (job: any) => {
    if (!window.confirm(`Delete job posting "${job.jobTitle}"? All applicants will also be removed.`)) return;
    try {
      await api.delete<any>(`/recruitment/${job.id}`);
      fetchRecruitments();
    } catch (e: any) {
      alert(e.message || 'Failed to delete job posting');
    }
  };

  const openJobModal = (job?: any) => {
    setEditingJob(job || null);
    if (job) {
      setJobForm({
        jobTitle: job.jobTitle,
        departmentId: job.departmentId,
        positionId: job.positionId,
        openings: String(job.openings ?? 1),
        employmentType: job.employmentType || 'FULL_TIME',
        status: job.status || 'OPEN',
        location: job.location || '',
        salaryRangeMin: job.salaryRangeMin != null ? String(job.salaryRangeMin) : '',
        salaryRangeMax: job.salaryRangeMax != null ? String(job.salaryRangeMax) : '',
        closingDate: job.closingDate ? job.closingDate.slice(0, 10) : '',
        description: job.description || '',
        requirements: job.requirements || '',
        responsibilities: job.responsibilities || ''
      });
    } else {
      setJobForm(f => ({ ...emptyJobForm(), departmentId: f.departmentId, positionId: f.positionId }));
    }
    setJobModalOpen(true);
  };

  // ---- Applicant management ----

  const openApplicantModal = (applicant?: any) => {
    setEditingApplicant(applicant || null);
    if (applicant) {
      const edu = Array.isArray(applicant.education) ? applicant.education : [];
      setApplicantForm({
        firstName: applicant.firstName || '',
        lastName: applicant.lastName || '',
        email: applicant.email || '',
        phone: applicant.phone || '',
        address: applicant.address || '',
        city: applicant.city || '',
        state: applicant.state || '',
        zipCode: applicant.zipCode || '',
        country: applicant.country || '',
        coverLetter: applicant.coverLetter || '',
        notes: applicant.notes || '',
        education: edu.map((e: any) => ({
          degree: e.degree || '',
          institution: e.institution || '',
          field: e.field || '',
          startYear: e.startYear != null ? String(e.startYear) : '',
          endYear: e.endYear != null ? String(e.endYear) : ''
        }))
      });
    } else {
      setApplicantForm(emptyApplicantForm());
    }
    setCvFile(null);
    setApplicantModalOpen(true);
  };

  const updateEdu = (idx: number, key: keyof EducationEntry, value: string) => {
    const list = [...applicantForm.education];
    list[idx] = { ...list[idx], [key]: value };
    setApplicantForm({ ...applicantForm, education: list });
  };

  const addEduRow = () => {
    setApplicantForm({
      ...applicantForm,
      education: [...applicantForm.education, { degree: '', institution: '', field: '', startYear: '', endYear: '' }]
    });
  };

  const removeEduRow = (idx: number) => {
    setApplicantForm({
      ...applicantForm,
      education: applicantForm.education.filter((_, i) => i !== idx)
    });
  };

  const saveApplicant = async () => {
    if (!activeRecruitment) return;
    if (!applicantForm.firstName || !applicantForm.lastName || !applicantForm.email) {
      alert('First name, last name and email are required');
      return;
    }
    setSaving(true);
    try {
      const education = applicantForm.education
        .filter(e => e.degree || e.institution)
        .map(e => ({
          degree: e.degree || undefined,
          institution: e.institution || undefined,
          field: e.field || undefined,
          startYear: e.startYear ? Number(e.startYear) : undefined,
          endYear: e.endYear ? Number(e.endYear) : undefined
        }));

      const payload: any = {
        firstName: applicantForm.firstName,
        lastName: applicantForm.lastName,
        email: applicantForm.email,
        phone: applicantForm.phone || undefined,
        address: applicantForm.address || undefined,
        city: applicantForm.city || undefined,
        state: applicantForm.state || undefined,
        zipCode: applicantForm.zipCode || undefined,
        country: applicantForm.country || undefined,
        coverLetter: applicantForm.coverLetter || undefined,
        notes: applicantForm.notes || undefined,
        education: education.length > 0 ? education : undefined
      };

      let applicantId: string;
      if (editingApplicant) {
        await api.put<any>(`/recruitment/${activeRecruitment.id}/applicants/${editingApplicant.id}`, payload);
        applicantId = editingApplicant.id;
        alert('Applicant updated');
      } else {
        const res = await api.post<any>(`/recruitment/${activeRecruitment.id}/applicants`, payload);
        applicantId = res.data.id;
        alert('Applicant added');
      }

      // Upload CV if a file was selected
      if (cvFile && applicantId) {
        await uploadCv(applicantId);
      }

      setApplicantModalOpen(false);
      openApplicants(activeRecruitment);
    } catch (e: any) {
      alert(e.message || 'Failed to save applicant');
    } finally {
      setSaving(false);
    }
  };

  const uploadCv = async (applicantId: string) => {
    if (!cvFile || !activeRecruitment) return;
    setUploading(true);
    try {
      const reader = new FileReader();
      const base64: string = await new Promise((resolve, reject) => {
        reader.onload = () => resolve(String(reader.result));
        reader.onerror = reject;
        reader.readAsDataURL(cvFile);
      });
      await api.post<any>(`/recruitment/${activeRecruitment.id}/applicants/${applicantId}/cv`, {
        data: base64,
        filename: cvFile.name
      });
    } finally {
      setUploading(false);
    }
  };

  const onCvChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0] || null;
    if (file && !/\.(pdf|jpe?g)$/i.test(file.name)) {
      alert('CV must be a PDF or JPG file');
      setCvFile(null);
      e.target.value = '';
      return;
    }
    setCvFile(file);
  };

  const updateApplicantStatus = async (applicant: any, status: string) => {
    try {
      await api.put<any>(`/recruitment/${activeRecruitment.id}/applicants/${applicant.id}`, { status });
      openApplicants(activeRecruitment);
    } catch (e: any) {
      alert(e.message || 'Failed to update status');
    }
  };

  const deleteApplicant = async (applicant: any) => {
    if (!window.confirm(`Delete applicant ${applicant.firstName} ${applicant.lastName}?`)) return;
    try {
      await api.delete<any>(`/recruitment/${activeRecruitment.id}/applicants/${applicant.id}`);
      openApplicants(activeRecruitment);
    } catch (e: any) {
      alert(e.message || 'Failed to delete applicant');
    }
  };

  const openPositions = jobs.filter(j => j.status === 'OPEN').length;
  const onHold = jobs.filter(j => j.status === 'ON_HOLD').length;
  const closed = jobs.filter(j => j.status === 'CLOSED').length;

  const cvUrlOf = (a: any) => api.fileUrl(a?.cvUrl || a?.resumeUrl);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold">Recruitment</h2>
          <p className="text-sm text-muted-foreground">Job postings, candidates, education, address and CV upload</p>
        </div>
        <Button onClick={() => openJobModal()}>
          <Plus className="h-4 w-4 mr-1" />
          New Job Posting
        </Button>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardContent className="pt-6 flex items-center gap-3">
            <div className={`flex h-10 w-10 items-center justify-center rounded-lg ${ACCENT_BG.green}`}>
              <Briefcase className="h-5 w-5" />
            </div>
            <div>
              <p className="text-2xl font-bold">{openPositions}</p>
              <p className="text-xs text-muted-foreground">Open Positions</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6 flex items-center gap-3">
            <div className={`flex h-10 w-10 items-center justify-center rounded-lg ${ACCENT_BG.blue}`}>
              <Briefcase className="h-5 w-5" />
            </div>
            <div>
              <p className="text-2xl font-bold">{jobs.length}</p>
              <p className="text-xs text-muted-foreground">Total Positions</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6 flex items-center gap-3">
            <div className={`flex h-10 w-10 items-center justify-center rounded-lg ${ACCENT_BG.orange}`}>
              <Users className="h-5 w-5" />
            </div>
            <div>
              <p className="text-2xl font-bold">{onHold}</p>
              <p className="text-xs text-muted-foreground">On Hold</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6 flex items-center gap-3">
            <div className={`flex h-10 w-10 items-center justify-center rounded-lg ${ACCENT_BG.red}`}>
              <Briefcase className="h-5 w-5" />
            </div>
            <div>
              <p className="text-2xl font-bold">{closed}</p>
              <p className="text-xs text-muted-foreground">Closed</p>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Job Postings</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <p className="text-center text-muted-foreground py-8">Loading...</p>
          ) : error ? (
            <p className="text-center text-red-600 py-8">{error}</p>
          ) : jobs.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">No job postings yet. Create your first posting.</p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Job Title</TableHead>
                    <TableHead>Department</TableHead>
                    <TableHead>Position</TableHead>
                    <TableHead>Openings</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {jobs.map(job => (
                    <TableRow key={job.id}>
                      <TableCell className="font-medium">{job.jobTitle}</TableCell>
                      <TableCell>{job.department?.name || '—'}</TableCell>
                      <TableCell>{job.position?.title || '—'}</TableCell>
                      <TableCell>{job.openings}</TableCell>
                      <TableCell>{job.employmentType}</TableCell>
                      <TableCell>
                        <Badge className={`${RECRUITMENT_STATUS_STYLES[job.status] || ''} border-transparent`}>
                          {job.status}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex justify-end gap-2">
                          <Button variant="outline" size="xs" onClick={() => openApplicants(job)}>
                            <Users className="h-3 w-3 mr-1" />
                            Applicants
                          </Button>
                          <Button variant="outline" size="xs" onClick={() => openJobModal(job)}>
                            <Pencil className="h-3 w-3" />
                          </Button>
                          <Button variant="destructive" size="xs" onClick={() => deleteJob(job)}>
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* New / Edit job posting modal */}
      {jobModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/50" onClick={() => setJobModalOpen(false)} />
          <div className="relative w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-lg bg-card p-6 shadow-xl">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold">{editingJob ? 'Edit Job Posting' : 'New Job Posting'}</h3>
              <button onClick={() => setJobModalOpen(false)} className="rounded-md p-1 hover:bg-accent">
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>Job Title *</Label>
                <Input value={jobForm.jobTitle} onChange={e => setJobForm({ ...jobForm, jobTitle: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label>Department *</Label>
                <select
                  value={jobForm.departmentId}
                  onChange={e => setJobForm({ ...jobForm, departmentId: e.target.value })}
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
                  value={jobForm.positionId}
                  onChange={e => setJobForm({ ...jobForm, positionId: e.target.value })}
                  className="w-full rounded-lg border bg-background px-3 py-2 text-sm"
                >
                  {(meta?.positions || []).map((p: any) => (
                    <option key={p.id} value={p.id}>{p.title}</option>
                  ))}
                </select>
              </div>
              <div className="space-y-2">
                <Label>Openings *</Label>
                <Input
                  type="number"
                  min="1"
                  value={jobForm.openings}
                  onChange={e => setJobForm({ ...jobForm, openings: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>Employment Type</Label>
                <select
                  value={jobForm.employmentType}
                  onChange={e => setJobForm({ ...jobForm, employmentType: e.target.value })}
                  className="w-full rounded-lg border bg-background px-3 py-2 text-sm"
                >
                  {EMPLOYMENT_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>
              <div className="space-y-2">
                <Label>Status</Label>
                <select
                  value={jobForm.status}
                  onChange={e => setJobForm({ ...jobForm, status: e.target.value })}
                  className="w-full rounded-lg border bg-background px-3 py-2 text-sm"
                >
                  {RECRUITMENT_STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
              <div className="space-y-2">
                <Label>Location</Label>
                <Input value={jobForm.location} onChange={e => setJobForm({ ...jobForm, location: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label>Closing Date</Label>
                <Input
                  type="date"
                  value={jobForm.closingDate}
                  onChange={e => setJobForm({ ...jobForm, closingDate: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>Salary Min</Label>
                <Input
                  type="number"
                  value={jobForm.salaryRangeMin}
                  onChange={e => setJobForm({ ...jobForm, salaryRangeMin: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>Salary Max</Label>
                <Input
                  type="number"
                  value={jobForm.salaryRangeMax}
                  onChange={e => setJobForm({ ...jobForm, salaryRangeMax: e.target.value })}
                />
              </div>
              <div className="space-y-2 sm:col-span-2">
                <Label>Description</Label>
                <textarea
                  value={jobForm.description}
                  onChange={e => setJobForm({ ...jobForm, description: e.target.value })}
                  rows={3}
                  className="w-full rounded-lg border bg-background px-3 py-2 text-sm"
                />
              </div>
              <div className="space-y-2 sm:col-span-2">
                <Label>Requirements</Label>
                <textarea
                  value={jobForm.requirements}
                  onChange={e => setJobForm({ ...jobForm, requirements: e.target.value })}
                  rows={3}
                  className="w-full rounded-lg border bg-background px-3 py-2 text-sm"
                />
              </div>
              <div className="space-y-2 sm:col-span-2">
                <Label>Responsibilities</Label>
                <textarea
                  value={jobForm.responsibilities}
                  onChange={e => setJobForm({ ...jobForm, responsibilities: e.target.value })}
                  rows={3}
                  className="w-full rounded-lg border bg-background px-3 py-2 text-sm"
                />
              </div>
            </div>
            <div className="flex justify-end gap-2 mt-6">
              <Button variant="outline" onClick={() => setJobModalOpen(false)}>Cancel</Button>
              <Button onClick={saveJob} disabled={saving}>
                {saving ? 'Saving...' : editingJob ? 'Save Changes' : 'Create Posting'}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Applicants modal */}
      {activeRecruitment && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/50" onClick={closeApplicants} />
          <div className="relative w-full max-w-4xl max-h-[90vh] overflow-y-auto rounded-lg bg-card p-6 shadow-xl">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-lg font-semibold">Applicants — {activeRecruitment.jobTitle}</h3>
                <p className="text-sm text-muted-foreground">
                  {applicants.length} candidate(s) · {activeRecruitment.department?.name}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <Button size="sm" onClick={() => openApplicantModal()}>
                  <Plus className="h-4 w-4 mr-1" />
                  Add Applicant
                </Button>
                <button onClick={closeApplicants} className="rounded-md p-1 hover:bg-accent">
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>

            {applicantsLoading ? (
              <p className="text-center text-muted-foreground py-8">Loading applicants...</p>
            ) : applicants.length === 0 ? (
              <p className="text-center text-muted-foreground py-8">No applicants yet. Add the first candidate.</p>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Candidate</TableHead>
                      <TableHead>Contact</TableHead>
                      <TableHead>Address</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>CV</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {applicants.map(a => (
                      <TableRow key={a.id}>
                        <TableCell>
                          <p className="font-medium">{a.firstName} {a.lastName}</p>
                          <p className="text-xs text-muted-foreground">
                            {(Array.isArray(a.education) && a.education.length > 0)
                              ? a.education.map((e: any) => [e.degree, e.institution].filter(Boolean).join(', ')).join('; ')
                              : 'No education listed'}
                          </p>
                        </TableCell>
                        <TableCell>
                          <p className="text-xs">{a.email}</p>
                          {a.phone && <p className="text-xs text-muted-foreground">{a.phone}</p>}
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground">
                          {[a.address, a.city, a.state, a.country].filter(Boolean).join(', ') || '—'}
                        </TableCell>
                        <TableCell>
                          <select
                            value={a.status}
                            onChange={e => updateApplicantStatus(a, e.target.value)}
                            className={`rounded-full border-0 px-2 py-1 text-xs font-semibold ${APPLICATION_STATUS_STYLES[a.status] || ''}`}
                          >
                            {APPLICATION_STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
                          </select>
                        </TableCell>
                        <TableCell>
                          {cvUrlOf(a) ? (
                            <a
                              href={cvUrlOf(a)}
                              target="_blank"
                              rel="noreferrer"
                              className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
                            >
                              <FileText className="h-3 w-3" /> View
                            </a>
                          ) : (
                            <span className="text-xs text-muted-foreground">—</span>
                          )}
                        </TableCell>
                        <TableCell>
                          <div className="flex justify-end gap-2">
                            <Button variant="outline" size="xs" onClick={() => openApplicantModal(a)}>
                              <Pencil className="h-3 w-3" />
                            </Button>
                            <Button variant="destructive" size="xs" onClick={() => deleteApplicant(a)}>
                              <Trash2 className="h-3 w-3" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Add / edit applicant modal */}
      {applicantModalOpen && activeRecruitment && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center">
          <div className="absolute inset-0 bg-black/50" onClick={() => setApplicantModalOpen(false)} />
          <div className="relative w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-lg bg-card p-6 shadow-xl">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold">
                {editingApplicant ? 'Edit Applicant' : 'Add Applicant'} — {activeRecruitment.jobTitle}
              </h3>
              <button onClick={() => setApplicantModalOpen(false)} className="rounded-md p-1 hover:bg-accent">
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>First Name *</Label>
                <Input value={applicantForm.firstName} onChange={e => setApplicantForm({ ...applicantForm, firstName: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label>Last Name *</Label>
                <Input value={applicantForm.lastName} onChange={e => setApplicantForm({ ...applicantForm, lastName: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label>Email *</Label>
                <Input type="email" value={applicantForm.email} onChange={e => setApplicantForm({ ...applicantForm, email: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label>Phone</Label>
                <Input value={applicantForm.phone} onChange={e => setApplicantForm({ ...applicantForm, phone: e.target.value })} />
              </div>

              <div className="sm:col-span-2 border-t pt-4">
                <div className="flex items-center justify-between mb-2">
                  <Label>Education</Label>
                  <Button variant="outline" size="xs" onClick={addEduRow}>
                    <Plus className="h-3 w-3 mr-1" /> Add Degree
                  </Button>
                </div>
                {applicantForm.education.length === 0 && (
                  <p className="text-xs text-muted-foreground">No education entries yet.</p>
                )}
                <div className="space-y-3">
                  {applicantForm.education.map((e, idx) => (
                    <div key={idx} className="grid gap-2 sm:grid-cols-6 border rounded-lg p-3">
                      <div className="sm:col-span-2">
                        <Input
                          placeholder="Degree (e.g. BSc CSE)"
                          value={e.degree}
                          onChange={ev => updateEdu(idx, 'degree', ev.target.value)}
                        />
                      </div>
                      <div className="sm:col-span-2">
                        <Input
                          placeholder="Institution"
                          value={e.institution}
                          onChange={ev => updateEdu(idx, 'institution', ev.target.value)}
                        />
                      </div>
                      <div className="sm:col-span-2">
                        <Input
                          placeholder="Field of study"
                          value={e.field}
                          onChange={ev => updateEdu(idx, 'field', ev.target.value)}
                        />
                      </div>
                      <Input
                        className="sm:col-span-1"
                        placeholder="From"
                        value={e.startYear}
                        onChange={ev => updateEdu(idx, 'startYear', ev.target.value)}
                      />
                      <Input
                        className="sm:col-span-1"
                        placeholder="To"
                        value={e.endYear}
                        onChange={ev => updateEdu(idx, 'endYear', ev.target.value)}
                      />
                      <Button
                        variant="destructive"
                        size="xs"
                        className="sm:col-span-1"
                        onClick={() => removeEduRow(idx)}
                      >
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </div>
                  ))}
                </div>
              </div>

              <div className="sm:col-span-2 border-t pt-4">
                <Label>Address & Communication</Label>
                <div className="grid gap-3 sm:grid-cols-2 mt-2">
                  <div className="sm:col-span-2">
                    <Input
                      placeholder="Street address"
                      value={applicantForm.address}
                      onChange={e => setApplicantForm({ ...applicantForm, address: e.target.value })}
                    />
                  </div>
                  <Input placeholder="City" value={applicantForm.city} onChange={e => setApplicantForm({ ...applicantForm, city: e.target.value })} />
                  <Input placeholder="State" value={applicantForm.state} onChange={e => setApplicantForm({ ...applicantForm, state: e.target.value })} />
                  <Input placeholder="Zip code" value={applicantForm.zipCode} onChange={e => setApplicantForm({ ...applicantForm, zipCode: e.target.value })} />
                  <Input placeholder="Country" value={applicantForm.country} onChange={e => setApplicantForm({ ...applicantForm, country: e.target.value })} />
                </div>
              </div>

              <div className="space-y-2">
                <Label>CV Upload (PDF or JPG)</Label>
                <label className="flex items-center gap-2 cursor-pointer rounded-lg border border-dashed px-3 py-2 text-sm text-muted-foreground hover:bg-accent">
                  <Upload className="h-4 w-4" />
                  {cvFile ? cvFile.name : 'Choose file'}
                  <input type="file" accept=".pdf,.jpg,.jpeg" className="hidden" onChange={onCvChange} />
                </label>
                {editingApplicant && cvUrlOf(editingApplicant) && !cvFile && (
                  <a href={cvUrlOf(editingApplicant)} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-xs text-primary hover:underline">
                    <Eye className="h-3 w-3" /> View current CV
                  </a>
                )}
              </div>
              <div className="space-y-2">
                <Label>Notes</Label>
                <Input value={applicantForm.notes} onChange={e => setApplicantForm({ ...applicantForm, notes: e.target.value })} />
              </div>
              <div className="space-y-2 sm:col-span-2">
                <Label>Cover Letter</Label>
                <textarea
                  value={applicantForm.coverLetter}
                  onChange={e => setApplicantForm({ ...applicantForm, coverLetter: e.target.value })}
                  rows={3}
                  className="w-full rounded-lg border bg-background px-3 py-2 text-sm"
                />
              </div>
            </div>
            <div className="flex justify-end gap-2 mt-6">
              <Button variant="outline" onClick={() => setApplicantModalOpen(false)}>Cancel</Button>
              <Button onClick={saveApplicant} disabled={saving || uploading}>
                {saving || uploading ? 'Saving...' : editingApplicant ? 'Save Changes' : 'Add Applicant'}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export { RecruitmentPage };