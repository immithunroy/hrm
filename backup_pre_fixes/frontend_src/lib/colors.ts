// Shared status color maps so the whole system uses the same colors as the dashboard.

export const STATUS_HEX: Record<string, string> = {
  PRESENT: '#22c55e',
  LATE: '#f97316',
  EARLY: '#3b82f6',
  ABSENT: '#ef4444',
  LEAVE: '#06b6d4',
  HOLIDAY: '#a855f7',
  HALF: '#eab308',
  WEEKEND: '#9ca3af'
};

export const STATUS_STYLES: Record<string, string> = {
  PRESENT: 'bg-green-100 text-green-800',
  LATE: 'bg-orange-100 text-orange-800',
  ABSENT: 'bg-red-100 text-red-800',
  LEAVE: 'bg-cyan-100 text-cyan-800',
  HOLIDAY: 'bg-purple-100 text-purple-800',
  HALF: 'bg-yellow-100 text-yellow-800',
  EARLY: 'bg-blue-100 text-blue-800',
  WEEKEND: 'bg-gray-100 text-gray-800'
};

export const LEAVE_STATUS_STYLES: Record<string, string> = {
  PENDING: 'bg-yellow-100 text-yellow-800',
  APPROVED: 'bg-green-100 text-green-800',
  REJECTED: 'bg-red-100 text-red-800',
  CANCELLED: 'bg-gray-100 text-gray-800'
};

export const RECRUITMENT_STATUS_STYLES: Record<string, string> = {
  OPEN: 'bg-green-100 text-green-800',
  ON_HOLD: 'bg-yellow-100 text-yellow-800',
  CLOSED: 'bg-gray-100 text-gray-800',
  CANCELLED: 'bg-red-100 text-red-800'
};

// Human-readable labels for attendance status values.
export const ATTENDANCE_STATUS_LABELS: Record<string, string> = {
  PRESENT: 'PRESENT',
  LATE: 'LATE IN',
  EARLY: 'EARLY',
  ABSENT: 'ABSENT',
  LEAVE: 'LEAVE',
  HOLIDAY: 'HOLIDAY',
  HALF: 'HALF DAY',
  WEEKEND: 'WEEKEND'
};

export const attendanceStatusLabel = (status: string): string =>
  ATTENDANCE_STATUS_LABELS[status] || status;

export const EMPLOYEE_STATUS_STYLES: Record<string, string> = {
  ACTIVE: 'bg-green-100 text-green-800',
  INACTIVE: 'bg-gray-100 text-gray-800',
  ON_LEAVE: 'bg-blue-100 text-blue-800',
  TERMINATED: 'bg-red-100 text-red-800',
  RESIGNED: 'bg-orange-100 text-orange-800',
  RETIRED: 'bg-purple-100 text-purple-800',
  SUSPENDED: 'bg-yellow-100 text-yellow-800'
};

export const APPLICATION_STATUS_STYLES: Record<string, string> = {
  NEW: 'bg-blue-100 text-blue-800',
  REVIEWED: 'bg-yellow-100 text-yellow-800',
  INTERVIEWED: 'bg-purple-100 text-purple-800',
  OFFERED: 'bg-orange-100 text-orange-800',
  HIRED: 'bg-green-100 text-green-800',
  REJECTED: 'bg-red-100 text-red-800'
};

// Icon card accent colors used across stat cards (dashboard palette).
export const ACCENT_BG: Record<string, string> = {
  blue: 'bg-blue-100 text-blue-600',
  green: 'bg-green-100 text-green-600',
  red: 'bg-red-100 text-red-600',
  orange: 'bg-orange-100 text-orange-600',
  purple: 'bg-purple-100 text-purple-600',
  yellow: 'bg-yellow-100 text-yellow-600'
};