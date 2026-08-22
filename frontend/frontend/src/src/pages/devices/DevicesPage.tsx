import React, { useState, useEffect, useCallback } from 'react';
import {
  Card,
  CardHeader,
  CardTitle,
  CardContent,
  CardFooter,
  Button,
  Badge,
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableCell,
  TableHead
} from '@/components/ui';
import { Cpu, Wifi, WifiOff, RefreshCw, Trash2, Upload, Users, Info } from 'lucide-react';
import { api } from '../../services/api';

const DevicesPage = () => {
  const [devices, setDevices] = useState<any[]>([]);
  const [deviceUsers, setDeviceUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [testingId, setTestingId] = useState<string | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [clearing, setClearing] = useState(false);
  const [syncAllUsers, setSyncAllUsers] = useState(false);
  const [statusMessage, setStatusMessage] = useState('');
  const [usersLoading, setUsersLoading] = useState(false);

  const fetchDevices = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get<any>('/devices?limit=50');
      setDevices(res.data.devices || []);
      setError('');
    } catch (e: any) {
      setError(e.message || 'Failed to load devices');
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchDeviceUsers = useCallback(async () => {
    setUsersLoading(true);
    try {
      const res = await api.get<any>('/devices/users');
      setDeviceUsers(res.data?.users || []);
    } catch (e) {
      setDeviceUsers([]);
    } finally {
      setUsersLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchDevices();
    fetchDeviceUsers();
  }, [fetchDevices, fetchDeviceUsers]);

  const testConnection = async (id: string) => {
    setTestingId(id);
    setStatusMessage('');
    try {
      const res = await api.post<any>(`/devices/${id}/test`, {});
      setStatusMessage(res.data?.data?.message || 'Test complete');
      await fetchDevices();
    } catch (e: any) {
      setStatusMessage(e.message || 'Test failed');
    } finally {
      setTestingId(null);
    }
  };

  const syncLogs = async () => {
    setSyncing(true);
    setStatusMessage('');
    try {
      const res = await api.post<any>('/devices/sync', {});
      setStatusMessage(res.data?.data?.message || 'Attendance sync started');
    } catch (e: any) {
      setStatusMessage(e.message || 'Sync failed');
    } finally {
      setSyncing(false);
    }
  };

  const clearOldLogs = async () => {
    if (!window.confirm('Delete attendance logs older than 180 days from the device? Data stays archived in the database.')) return;
    setClearing(true);
    setStatusMessage('');
    try {
      const res = await api.post<any>('/devices/clear-old-logs', {});
      setStatusMessage(res.data?.data?.message || 'Device log clear started');
    } catch (e: any) {
      setStatusMessage(e.message || 'Failed to start clear');
    } finally {
      setClearing(false);
      setTimeout(fetchDevices, 15000);
    }
  };

  const pushAllUsers = async () => {
    if (!window.confirm('Push ALL active employees with a PIN to the device? Existing users are updated; employees without a PIN are skipped.')) return;
    setSyncAllUsers(true);
    setStatusMessage('');
    try {
      const res = await api.post<any>('/devices/users/sync-all', {});
      const r = res.data;
      setStatusMessage(r?.pushed != null ? `Users pushed: ${r.pushed} of ${r.total} (${r.failed} failed)` : 'User sync started');
      setTimeout(fetchDeviceUsers, 10000);
    } catch (e: any) {
      setStatusMessage(e.message || 'Failed to start user sync');
    } finally {
      setSyncAllUsers(false);
    }
  };

  const removeDeviceUser = async (uid: number) => {
    if (!window.confirm(`Delete user UID ${uid} from the device? The employee record stays in the system.`)) return;
    setStatusMessage('');
    try {
      const res = await api.delete<any>(`/devices/users/${uid}`);
      setStatusMessage(res.data?.deleted ? `User ${uid} removed from device` : 'User removed from device');
      setTimeout(fetchDeviceUsers, 5000);
    } catch (e: any) {
      setStatusMessage(e.message || 'Failed to remove user');
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold">Devices</h2>
          <p className="text-sm text-muted-foreground">ZKTeco biometric device management</p>
        </div>
        {statusMessage && (
          <p className="text-sm text-muted-foreground">{statusMessage}</p>
        )}
      </div>

      <Card className="border-blue-200 bg-blue-50/50 dark:border-blue-800 dark:bg-blue-950/30">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <Info className="h-5 w-5 text-blue-600" />
            Compatible Devices
          </CardTitle>
        </CardHeader>
        <CardContent className="text-sm space-y-3">
          <p className="text-muted-foreground">
            This system connects to ZKTeco biometric devices via TCP/UDP (port 4370).
            All ZKTeco devices that support the ZKT protocol are compatible.
          </p>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <div>
              <p className="font-medium text-foreground">Fingerprint Terminals</p>
              <p className="text-muted-foreground">F22, F18, F7</p>
            </div>
            <div>
              <p className="font-medium text-foreground">Face + Fingerprint</p>
              <p className="text-muted-foreground">K40, K14, K50, K60</p>
            </div>
            <div>
              <p className="font-medium text-foreground">Face Recognition</p>
              <p className="text-muted-foreground">uFace 202, 302, 800</p>
            </div>
            <div>
              <p className="font-medium text-foreground">SpeedFace Series</p>
              <p className="text-muted-foreground">All SpeedFace models</p>
            </div>
            <div>
              <p className="font-medium text-foreground">Other Models</p>
              <p className="text-muted-foreground">Any ZKTeco device supporting TCP/UDP on port 4370</p>
            </div>
          </div>
          <p className="text-xs text-muted-foreground border-t border-blue-200 dark:border-blue-800 pt-2">
            Non-ZKTeco brands (HID, Suprema, Anviz, etc.) are not supported. Devices using cloud-only connectivity without local TCP/UDP may also be incompatible.
          </p>
        </CardContent>
      </Card>

      {loading ? (
        <p className="text-center text-muted-foreground py-8">Loading...</p>
      ) : error ? (
        <p className="text-center text-red-600 py-8">{error}</p>
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          {devices.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">No devices found</p>
          ) : devices.map(device => (
            <Card key={device.id}>
              <CardHeader>
                <CardTitle className="flex items-center justify-between">
                  <span className="flex items-center gap-2">
                    <Cpu className="h-5 w-5" />
                    {device.name}
                  </span>
                  <Badge variant={device.isActive ? 'default' : 'destructive'}>
                    {device.isActive ? 'Online' : 'Offline'}
                  </Badge>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <p className="text-muted-foreground text-xs">IP Address</p>
                    <p className="font-medium flex items-center gap-1">
                      {device.isActive ? <Wifi className="h-3 w-3 text-green-600" /> : <WifiOff className="h-3 w-3 text-red-600" />}
                      {device.ipAddress}
                    </p>
                  </div>
                  <div>
                    <p className="text-muted-foreground text-xs">Port</p>
                    <p className="font-medium">{device.port}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground text-xs">Location</p>
                    <p className="font-medium">{device.location || '—'}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground text-xs">Total Logs</p>
                    <p className="font-medium">{(device.totalLogs || 0).toLocaleString()}</p>
                  </div>
                </div>
                <div className="flex items-center justify-between rounded-md bg-secondary/50 p-3">
                  <div className="flex items-center gap-2">
                    <RefreshCw className={`h-4 w-4 ${testingId === device.id ? 'animate-spin text-primary' : 'text-muted-foreground'}`} />
                    <span className="text-sm text-muted-foreground">
                      {device.lastSeen ? `Last seen: ${new Date(device.lastSeen).toLocaleString()}` : 'Never seen'}
                    </span>
                  </div>
                  <Button variant="outline" size="sm" onClick={() => testConnection(device.id)} disabled={testingId === device.id}>
                    Test Connection
                  </Button>
                </div>
              </CardContent>
              <CardFooter className="justify-end gap-2">
                <Button variant="outline" size="sm" onClick={pushAllUsers} disabled={syncAllUsers}>
                  <Upload className="h-4 w-4 mr-1" />
                  {syncAllUsers ? 'Pushing...' : 'Push All Users'}
                </Button>
                <Button variant="outline" size="sm" onClick={syncLogs} disabled={syncing}>
                  {syncing ? 'Syncing...' : 'Sync Logs'}
                </Button>
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={clearOldLogs}
                  disabled={clearing}
                  title="Delete attendance logs older than 180 days from the device"
                >
                  <Trash2 className="h-4 w-4 mr-1" />
                  {clearing ? 'Clearing...' : 'Delete Logs > 180 Days'}
                </Button>
              </CardFooter>
            </Card>
          ))}
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-4 w-4" />
            Users on Device
          </CardTitle>
        </CardHeader>
        <CardContent>
          {usersLoading ? (
            <p className="text-center text-muted-foreground py-6">Loading device users...</p>
          ) : deviceUsers.length === 0 ? (
            <p className="text-center text-muted-foreground py-6">
              No users on the device yet. Push all users from the device card above, or sync an employee from their profile.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>UID</TableHead>
                  <TableHead>User ID</TableHead>
                  <TableHead>Name</TableHead>
                  <TableHead>PIN</TableHead>
                  <TableHead>Linked Employee</TableHead>
                  <TableHead className="w-20">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {deviceUsers.map(u => (
                  <TableRow key={u.uid}>
                    <TableCell>{u.uid}</TableCell>
                    <TableCell>{u.userId}</TableCell>
                    <TableCell>{u.name}</TableCell>
                    <TableCell>{u.pin}</TableCell>
                    <TableCell>
                      {u.employee ? (
                        <span className="text-sm">{u.employee.firstName} {u.employee.lastName} ({u.employee.employeeId})</span>
                      ) : (
                        <span className="text-muted-foreground">Unlinked</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <Button variant="destructive" size="xs" onClick={() => removeDeviceUser(u.uid)}>
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

      <Card>
        <CardHeader>
          <CardTitle>Device Status</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Device</TableHead>
                <TableHead>IP</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Total Logs</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {devices.map(device => (
                <TableRow key={device.id}>
                  <TableCell>{device.name}</TableCell>
                  <TableCell>{device.ipAddress}</TableCell>
                  <TableCell>
                    <Badge variant={device.isActive ? 'default' : 'destructive'}>
                      {device.isActive ? 'Online' : 'Offline'}
                    </Badge>
                  </TableCell>
                  <TableCell>{(device.totalLogs || 0).toLocaleString()}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
};

export { DevicesPage };