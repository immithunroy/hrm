import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { api } from '../../services/api';
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

interface ProfileData {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  phone?: string;
  employeeId?: string;
  role?: string;
  department?: { name: string };
  position?: { title: string };
}

const ProfilePage = () => {
  const { user } = useAuth();
  const [form, setForm] = useState({
    firstName: '',
    lastName: '',
    phone: ''
  });
  const [profile, setProfile] = useState<ProfileData | null>(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState('');
  const [pwForm, setPwForm] = useState({ currentPassword: '', newPassword: '', confirmPassword: '' });
  const [pwSaving, setPwSaving] = useState(false);
  const [pwSaved, setPwSaved] = useState(false);
  const [pwError, setPwError] = useState('');

  useEffect(() => {
    api.get<{ success: boolean; data: ProfileData }>('/auth/me')
      .then((res) => {
        setProfile(res.data);
        setForm({
          firstName: res.data.firstName,
          lastName: res.data.lastName,
          phone: res.data.phone || ''
        });
      })
      .catch(() => {});
  }, []);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setForm(prev => ({ ...prev, [e.target.name]: e.target.value }));
    setSaved(false);
  };

  const handleSave = async () => {
    if (!profile) return;
    setSaving(true);
    setError('');
    try {
      await api.put(`/employees/${profile.id}`, {
        firstName: form.firstName,
        lastName: form.lastName,
        phone: form.phone || undefined
      });
      setSaved(true);
    } catch (err: any) {
      setError(err.message || 'Failed to update profile');
    } finally {
      setSaving(false);
    }
  };

  const handlePwChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setPwForm(prev => ({ ...prev, [e.target.name]: e.target.value }));
    setPwSaved(false);
    setPwError('');
  };

  const handlePwSave = async () => {
    setPwSaving(true);
    setPwError('');
    setPwSaved(false);
    if (pwForm.newPassword !== pwForm.confirmPassword) {
      setPwError('New passwords do not match');
      setPwSaving(false);
      return;
    }
    if (pwForm.newPassword.length < 8) {
      setPwError('New password must be at least 8 characters');
      setPwSaving(false);
      return;
    }
    try {
      await api.post('/auth/change-password', {
        currentPassword: pwForm.currentPassword,
        newPassword: pwForm.newPassword
      });
      setPwSaved(true);
      setPwForm({ currentPassword: '', newPassword: '', confirmPassword: '' });
    } catch (err: any) {
      setPwError(err.message || 'Failed to change password');
    } finally {
      setPwSaving(false);
    }
  };

  const displayName = profile ? `${profile.firstName} ${profile.lastName}` : (user ? `${user.firstName} ${user.lastName}` : 'User');
  const initials = profile
    ? `${profile.firstName.charAt(0)}${profile.lastName.charAt(0)}`
    : (user ? `${user.firstName.charAt(0)}${user.lastName.charAt(0)}` : 'U');

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold">My Profile</h2>
        <p className="text-sm text-muted-foreground">Manage your personal information</p>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-1">
          <CardContent className="pt-6 text-center space-y-3">
            <div className="mx-auto flex h-24 w-24 items-center justify-center rounded-full bg-primary text-3xl font-bold text-primary-foreground">
              {initials}
            </div>
            <div>
              <h3 className="text-lg font-semibold">{displayName}</h3>
              <p className="text-sm text-muted-foreground">{profile?.employeeId || user?.employeeId || 'Employee'}</p>
              {profile?.role && (
                <span className="inline-block mt-1 px-2 py-0.5 text-xs font-medium rounded bg-secondary text-secondary-foreground">
                  {profile.role}
                </span>
              )}
            </div>
            <div className="border-t pt-4 text-sm text-muted-foreground">
              <p>{profile?.email || user?.email}</p>
              {profile?.department && <p className="mt-1">{profile.department.name}</p>}
              {profile?.position && <p>{profile.position.title}</p>}
            </div>
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Personal Information</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="firstName">First Name</Label>
              <Input
                id="firstName"
                name="firstName"
                value={form.firstName}
                onChange={handleChange}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="lastName">Last Name</Label>
              <Input
                id="lastName"
                name="lastName"
                value={form.lastName}
                onChange={handleChange}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                value={profile?.email || user?.email || ''}
                disabled
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="phone">Phone</Label>
              <Input
                id="phone"
                name="phone"
                value={form.phone}
                onChange={handleChange}
              />
            </div>
          </CardContent>
          <CardFooter className="justify-end gap-3">
            {error && <span className="text-sm text-red-600 mr-auto">{error}</span>}
            {saved && <span className="text-sm text-green-600 mr-auto">Profile updated</span>}
            <Button onClick={handleSave} disabled={saving}>
              {saving ? 'Saving...' : 'Save Changes'}
            </Button>
          </CardFooter>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Change Password</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-3">
          <div className="space-y-2">
            <Label htmlFor="currentPassword">Current Password</Label>
            <Input
              id="currentPassword"
              name="currentPassword"
              type="password"
              value={pwForm.currentPassword}
              onChange={handlePwChange}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="newPassword">New Password</Label>
            <Input
              id="newPassword"
              name="newPassword"
              type="password"
              value={pwForm.newPassword}
              onChange={handlePwChange}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="confirmPassword">Confirm New Password</Label>
            <Input
              id="confirmPassword"
              name="confirmPassword"
              type="password"
              value={pwForm.confirmPassword}
              onChange={handlePwChange}
            />
          </div>
        </CardContent>
        <CardFooter className="justify-end gap-3">
          {pwError && <span className="text-sm text-red-600 mr-auto">{pwError}</span>}
          {pwSaved && <span className="text-sm text-green-600 mr-auto">Password changed</span>}
          <Button onClick={handlePwSave} disabled={pwSaving}>
            {pwSaving ? 'Changing...' : 'Change Password'}
          </Button>
        </CardFooter>
      </Card>
    </div>
  );
};

export { ProfilePage };
