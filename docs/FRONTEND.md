# Frontend Developer Guide

Guide for frontend developers working on the HRM React application.

---

## Tech Stack

- **Framework:** React 18.2
- **Language:** TypeScript 5.4
- **Build Tool:** Vite 5.2
- **Styling:** Tailwind CSS 3.4
- **UI Components:** shadcn/ui (Radix UI primitives)
- **Routing:** React Router 6.22
- **State Management:** Context API (AuthContext)
- **Charts:** Recharts 2.12
- **Forms:** Native + Zod validation

---

## Project Structure

```
frontend/
├── src/
│   ├── main.tsx               # Entry point — ReactDOM.createRoot
│   ├── App.tsx                # Root component — AuthProvider + BrowserRouter
│   ├── AppRoutes.tsx          # Route definitions + ProtectedRoutes
│   ├── index.css              # Global styles + Tailwind directives
│   ├── vite-env.d.ts          # Vite type declarations
│   │
│   ├── context/
│   │   └── AuthContext.tsx     # Auth state (user, login, register, logout)
│   │
│   ├── services/
│   │   └── api.ts             # HTTP client singleton (ApiService)
│   │
│   ├── pages/                 # 18 page components
│   │   ├── auth/              # LoginPage, RegisterPage
│   │   ├── dashboard/         # DashboardPage
│   │   ├── employees/         # EmployeesPage, EmployeeDetailPage
│   │   ├── attendance/        # AttendancePage
│   │   ├── payroll/           # PayrollPage
│   │   ├── recruitment/       # RecruitmentPage
│   │   ├── shifts/            # ShiftsPage
│   │   ├── leave/             # LeavePage
│   │   ├── loans/             # LoansPage
│   │   ├── festival-bonus/    # FestivalBonusPage
│   │   ├── devices/           # DevicesPage
│   │   ├── holidays/          # HolidaysPage
│   │   ├── tasks/             # TasksPage
│   │   ├── announcements/     # AnnouncementsPage
│   │   ├── profile/           # ProfilePage
│   │   └── settings/          # SettingsPage
│   │
│   ├── components/
│   │   ├── layout/
│   │   │   └── AppLayout.tsx  # Sidebar + header + Outlet
│   │   ├── InactivityManager.tsx  # Session timeout monitor
│   │   ├── InactivityWarning.tsx  # Timeout warning modal
│   │   └── ui/                # 22 UI primitives (shadcn/ui)
│   │
│   ├── types/
│   │   ├── auth.ts            # User, LoginFormValues, RegisterFormValues
│   │   └── notification.ts    # Notification type
│   │
│   └── lib/
│       ├── format.ts          # Date/time formatting (Dhaka timezone)
│       └── colors.ts          # Status color maps + style helpers
│
├── Dockerfile
├── nginx.conf                 # Production nginx config
├── package.json
├── vite.config.ts
├── tsconfig.json
└── tailwind.config.js
```

---

## Routing

All routes are defined in `AppRoutes.tsx`:

| Path | Component | Auth Required | Description |
|------|-----------|---------------|-------------|
| `/login` | LoginPage | No | Login form |
| `/register` | RegisterPage | No | Registration form |
| `/` | Redirect to `/dashboard` | Yes | — |
| `/dashboard` | DashboardPage | Yes | Overview with charts |
| `/employees` | EmployeesPage | Yes | Employee list |
| `/employees/new` | EmployeeDetailPage | Yes | Create employee |
| `/employees/:id` | EmployeeDetailPage | Yes | View employee |
| `/employees/:id/edit` | EmployeeDetailPage | Yes | Edit employee |
| `/attendance` | AttendancePage | Yes | Attendance management |
| `/payroll` | PayrollPage | Yes | Payroll processing |
| `/recruitment` | RecruitmentPage | Yes | Job postings |
| `/shifts` | ShiftsPage | Yes | Shift management |
| `/leave` | LeavePage | Yes | Leave requests |
| `/loans` | LoansPage | Yes | Loan management |
| `/festival-bonus` | FestivalBonusPage | Yes | Festival bonuses |
| `/devices` | DevicesPage | Yes | ZKT device management |
| `/holidays` | HolidaysPage | Yes | Holiday management |
| `/tasks` | TasksPage | Yes | Task management |
| `/announcements` | AnnouncementsPage | Yes | Announcements |
| `/profile` | ProfilePage | Yes | User profile |
| `/settings` | SettingsPage | Yes | Payroll rules + roles |
| `*` | Redirect to `/dashboard` | — | Catch-all |

### Protected Routes

`ProtectedRoutes` component in `AppRoutes.tsx`:
- Checks `useAuth().user`
- Redirects to `/login` if unauthenticated
- Shows "Loading..." while `isLoading` is true
- Renders `<Outlet />` for child routes

---

## Authentication

### AuthContext

Provides `{ user, isLoading, login, register, logout }` to all components.

```typescript
const { user, login, logout } = useAuth();

// Login
await login({ username: 'admin', password: 'admin123' });

// Check role
if (user?.role === 'ADMIN') {
  // Show admin-only UI
}

// Logout
await logout();
```

### API Client

Singleton `api` instance in `services/api.ts`:

```typescript
import { api } from '../services/api';

// GET request
const employees = await api.get<Employee[]>('/employees');

// POST request
const result = await api.post<LoginResponse>('/auth/login', { username, password });

// File download
await api.download('/attendance/export?startDate=2026-01-01&endDate=2026-01-31&format=pdf', 'attendance.pdf');

// File URL helper
const url = api.fileUrl('/uploads/employee/profile-xxx.jpg');
```

**Auto-logout:** On 401 response, the API client clears the token and redirects to `/login?error=session_expired`.

---

## Key Components

### AppLayout

Sidebar + header layout with 15 navigation items. Responsive: desktop sidebar is fixed left; mobile sidebar opens via hamburger menu.

**Navigation items:** Dashboard, Employees, Attendance, Payroll, Recruitment, Shifts, Leave, Loans, Festival Bonus, Holidays, Tasks, Announcements, Devices, Profile, Settings.

### InactivityManager

Monitors user activity with 5-second throttle. Timers:
- **25 minutes:** Show warning modal
- **30 minutes:** Force logout

Uses `BroadcastChannel` for multi-tab sync.

### InactivityWarning

Modal overlay with 5-minute countdown. Options: "Stay Signed In" or "Sign Out". Auto-logs out when countdown reaches zero.

---

## Pages Overview

### DashboardPage

- Welcome banner with user name and refresh button
- 4 overview stat cards (Total Employees, Present Today, Absent Today, Net Pay)
- Today's Attendance card
- 30-day attendance trend (AreaChart)
- Status Distribution (PieChart)
- Attendance Calendar (monthly grid)
- Employees vs Present by Department (BarChart)
- Secondary metrics (overtime, leave, holidays, open positions)
- Recent attendance table (today only)

### EmployeesPage

Paginated employee list with search, status badges, and View/Edit actions.

### EmployeeDetailPage

Multi-mode page (new / edit / view):
- **Create mode:** ~35-field form
- **Edit mode:** Same form pre-filled
- **View mode:** Profile card, employment info, ZKT sync, documents upload, employment actions, leave balance, attendance history

### AttendancePage

- Employee filter, date range pickers
- Sync from Device, Manual Entry, Excel/PDF export
- Stat cards (Present/Late/Early/Records)
- Paginated attendance table with Edit/Delete

### PayrollPage

- Month picker, Process Payroll button
- Employee salary table with payslip export
- Processed payroll records table

### SettingsPage

- Payroll Rules card (OT rates, tax, working days, currency, errand mode, early OT mode)
- Role Management card (inline role dropdowns per employee)

---

## Styling

### Tailwind CSS

All styling uses Tailwind utility classes. No CSS modules or styled-components.

```tsx
<div className="bg-white rounded-lg shadow-sm border p-6">
  <h2 className="text-lg font-semibold text-gray-900">Title</h2>
  <p className="text-sm text-gray-500 mt-1">Description</p>
</div>
```

### shadcn/ui Components

Located in `components/ui/`. Available primitives:
- Button (variants: default, destructive, outline, secondary, ghost, link)
- Card, CardHeader, CardTitle, CardContent, CardFooter
- Input, Label
- Badge (variants: default, secondary, destructive, outline, muted)
- Table, TableHeader, TableBody, TableRow, TableCell, TableHead, TableCaption
- Pagination, PaginationContent, PaginationList, PaginationItem, PaginationPrevious, PaginationNext

### Status Colors

Defined in `lib/colors.ts`:

```typescript
import { STATUS_STYLES, attendanceStatusLabel } from '../lib/colors';

// Get style for attendance status
const style = STATUS_STYLES['PRESENT']; // { bg: 'bg-green-100', text: 'text-green-800' }

// Get human-readable label
const label = attendanceStatusLabel('LATE'); // "LATE IN"
```

### Date Formatting

All dates are formatted in Dhaka timezone (UTC+6):

```typescript
import { fmtHM, fmtDhakaDate, dhakaWeekdayShort, fmtMoney } from '../lib/format';

fmtHM(8.5);           // "8h 30m"
fmtDhakaDate(date);    // "2026-01-15"
dhakaWeekdayShort(date); // "Thu"
fmtMoney(50000);       // "৳50,000"
```

---

## Adding New Pages

1. Create page component in `src/pages/<module>/`
2. Add route in `AppRoutes.tsx`
3. Add navigation item in `AppLayout.tsx`
4. Create API methods in `services/api.ts` (if needed)
5. Add types in `types/` (if needed)

### Example

```typescript
// src/pages/reports/ReportsPage.tsx
import { useState, useEffect } from 'react';
import { api } from '../../services/api';

export function ReportsPage() {
  const [data, setData] = useState(null);

  useEffect(() => {
    api.get('/reports/summary').then(setData);
  }, []);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Reports</h1>
      {/* ... */}
    </div>
  );
}
```

```typescript
// Add route in AppRoutes.tsx
import { ReportsPage } from './pages/reports/ReportsPage';

// Inside ProtectedRoutes:
<Route path="reports" element={<ReportsPage />} />
```

---

## Code Style

- Use functional components with hooks
- Use TypeScript for all components and props
- Use Tailwind CSS for all styling (no CSS modules)
- Use `useState` + `useEffect` for data fetching
- Use `useAuth()` for authentication state
- Use `api` singleton for all HTTP requests
- Format dates with `lib/format.ts` utilities
- Use status color helpers from `lib/colors.ts`
- No comments in code unless requested

---

## Build & Development

```bash
# Install dependencies
npm install

# Development server
npm run dev

# Build for production
npm run build

# Preview production build
npm run preview
```

### Environment Variables

| Variable | Description |
|----------|-------------|
| `VITE_API_URL` | Backend API base URL (default: `http://localhost:5000/api`) |

### Production Build

The production build is served by nginx with the following configuration:
- Static files served from `/usr/share/nginx/html`
- `/api/*` requests proxied to `backend:5000`
- Gzip compression enabled
- Cache headers for static assets
