/**
 * AnnouncementsPage - Company announcements management page.
 *
 * Features:
 * - Announcement listing with priority badges and inactive indicators
 * - Create/Edit announcement modal with title, content, priority, date range
 * - Priority levels: LOW, NORMAL, HIGH, URGENT
 * - Optional start and expiry dates for scheduled announcements
 * - Role-based permissions: Admin/HR can edit, Admin only can delete
 * - Author and creation date display
 *
 * State management:
 * - Edit mode toggle between create and update operations
 * - Date fields stored as YYYY-MM-DD strings for input compatibility
 */

import React, { useState, useEffect, useCallback } from 'react';
import { api } from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import { fmtDhakaDate } from '../../lib/format';
import {
  Card,
  CardHeader,
  CardTitle,
  CardContent,
  Button,
  Input,
  Label,
  Badge,
} from '@/components/ui';
import { Plus, Trash2, Megaphone, Edit } from 'lucide-react';

const PRIORITY_STYLES: Record<string, string> = {
  LOW: 'bg-gray-100 text-gray-800',
  NORMAL: 'bg-blue-100 text-blue-800',
  HIGH: 'bg-orange-100 text-orange-800',
  URGENT: 'bg-red-100 text-red-800',
};

const AnnouncementsPage = () => {
  const { user } = useAuth();
  const [announcements, setAnnouncements] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    title: '',
    content: '',
    priority: 'NORMAL',
    startsAt: '',
    expiresAt: '',
  });

  const canEdit = user?.role === 'ADMIN' || user?.role === 'HR';
  const canDelete = user?.role === 'ADMIN';

  const fetchAnnouncements = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get<any>('/announcements?limit=100');
      setAnnouncements(res.data?.announcements || []);
      setError('');
    } catch (e: any) {
      setError(e.message || 'Failed to load announcements');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAnnouncements();
  }, [fetchAnnouncements]);

  const openCreate = () => {
    setEditing(null);
    setForm({ title: '', content: '', priority: 'NORMAL', startsAt: '', expiresAt: '' });
    setShowModal(true);
  };

  const openEdit = (ann: any) => {
    setEditing(ann);
    setForm({
      title: ann.title || '',
      content: ann.content || '',
      priority: ann.priority || 'NORMAL',
      startsAt: ann.startsAt ? ann.startsAt.slice(0, 10) : '',
      expiresAt: ann.expiresAt ? ann.expiresAt.slice(0, 10) : '',
    });
    setShowModal(true);
  };

  const save = async () => {
    if (!form.title.trim() || !form.content.trim()) return;
    setSaving(true);
    try {
      const payload: any = {
        title: form.title,
        content: form.content,
        priority: form.priority,
      };
      if (form.startsAt) payload.startsAt = form.startsAt;
      if (form.expiresAt) payload.expiresAt = form.expiresAt;

      if (editing) {
        await api.put(`/announcements/${editing.id}`, payload);
      } else {
        await api.post('/announcements', payload);
      }
      setShowModal(false);
      fetchAnnouncements();
    } catch (e: any) {
      alert(e.message || 'Failed to save announcement');
    } finally {
      setSaving(false);
    }
  };

  const deleteAnnouncement = async (id: string) => {
    if (!confirm('Delete this announcement?')) return;
    try {
      await api.delete(`/announcements/${id}`);
      fetchAnnouncements();
    } catch (e: any) {
      alert(e.message || 'Failed to delete announcement');
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Announcements</h1>
        {canEdit && (
          <Button onClick={openCreate}>
            <Plus className="mr-2 h-4 w-4" /> New Announcement
          </Button>
        )}
      </div>

      {error && <div className="bg-destructive/10 text-destructive rounded-lg p-3 text-sm">{error}</div>}

      {loading ? (
        <div className="text-center text-muted-foreground py-8">Loading...</div>
      ) : announcements.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Megaphone className="h-12 w-12 text-muted-foreground mb-4" />
            <p className="text-muted-foreground">No announcements yet</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {announcements.map((ann) => (
            <Card key={ann.id}>
              <CardContent className="p-6">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-3 mb-2">
                      <h3 className="font-semibold text-lg">{ann.title}</h3>
                      <Badge className={PRIORITY_STYLES[ann.priority] || ''}>
                        {ann.priority}
                      </Badge>
                      {!ann.isActive && (
                        <Badge className="bg-gray-100 text-gray-500">Inactive</Badge>
                      )}
                    </div>
                    <p className="text-sm text-muted-foreground whitespace-pre-wrap">{ann.content}</p>
                    <div className="flex items-center gap-4 mt-3 text-xs text-muted-foreground">
                      {ann.author && (
                        <span>By {ann.author.firstName} {ann.author.lastName}</span>
                      )}
                      <span>Created {fmtDhakaDate(ann.createdAt)}</span>
                      {ann.startsAt && <span>Starts {fmtDhakaDate(ann.startsAt)}</span>}
                      {ann.expiresAt && <span>Expires {fmtDhakaDate(ann.expiresAt)}</span>}
                    </div>
                  </div>
                  {canEdit && (
                    <div className="flex items-center gap-1">
                      <Button variant="ghost" size="sm" onClick={() => openEdit(ann)} title="Edit">
                        <Edit className="h-4 w-4" />
                      </Button>
                      {canDelete && (
                        <Button variant="ghost" size="sm" onClick={() => deleteAnnouncement(ann.id)} title="Delete">
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      )}
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-card rounded-lg border shadow-lg p-6 w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <h2 className="text-lg font-semibold mb-4">
              {editing ? 'Edit Announcement' : 'New Announcement'}
            </h2>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="ann-title">Title *</Label>
                <Input
                  id="ann-title"
                  value={form.title}
                  onChange={(e) => setForm({ ...form, title: e.target.value })}
                  placeholder="Announcement title"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="ann-content">Content *</Label>
                <textarea
                  id="ann-content"
                  value={form.content}
                  onChange={(e) => setForm({ ...form, content: e.target.value })}
                  placeholder="Announcement content"
                  rows={5}
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                />
              </div>
              <div className="space-y-2">
                <Label>Priority</Label>
                <select
                  value={form.priority}
                  onChange={(e) => setForm({ ...form, priority: e.target.value })}
                  className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                >
                  <option value="LOW">Low</option>
                  <option value="NORMAL">Normal</option>
                  <option value="HIGH">High</option>
                  <option value="URGENT">Urgent</option>
                </select>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Starts At</Label>
                  <Input
                    type="date"
                    value={form.startsAt}
                    onChange={(e) => setForm({ ...form, startsAt: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Expires At</Label>
                  <Input
                    type="date"
                    value={form.expiresAt}
                    onChange={(e) => setForm({ ...form, expiresAt: e.target.value })}
                  />
                </div>
              </div>
            </div>
            <div className="flex justify-end gap-2 mt-6">
              <Button variant="outline" onClick={() => setShowModal(false)}>Cancel</Button>
              <Button onClick={save} disabled={saving || !form.title.trim() || !form.content.trim()}>
                {saving ? 'Saving...' : editing ? 'Update' : 'Publish'}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AnnouncementsPage;
