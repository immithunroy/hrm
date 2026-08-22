# HRM App

A comprehensive HR and payroll management system with ZKTeco biometric device integration.

## Features

- **Employee Management**: Complete employee lifecycle, full profile editing/creation from the app, weekly holiday per employee (default from payroll settings, any weekday), device PIN per employee
- **Govt. Photo ID**: NID / Driving License / Passport type + number stored on every employee profile
- **Employee Documents & Assets**: Upload a photograph, the govt. photo ID document, and CV/resume per employee (PDF/JPG/PNG/WebP), stored under `uploads/employee/` and served from `/api/uploads`
- **Employment Lifecycle**: Terminate, resign or retire an employee (records the end date and status), or permanently delete an employee with all related records
- **Attendance Exemption**: Mark employees (e.g. co-founders / admin staff) as attendance-exempt — they stay on the device and in the app, but their punches are ignored, they are excluded from attendance counts, and payroll treats them as fully present
- **Errand vs Overtime rule**: Errand (break) time is tracked separately and can optionally be deducted from *regular* overtime only (never from holiday overtime) before overtime pay is calculated — configurable in Settings
- **Attendance Tracking**: Real-time biometric attendance with ZKT F22 integration using a daily punch model (first punch = sign-in, last punch = sign-out, auto sign-out at 04:00)
- **Extra-Factor Attendance**: Overtime before sign-in / after sign-out, personal-work errand gaps tracked in a separate column, work hours and late minutes per day
- **Manual Attendance**: Admins can add, edit, and adjust attendance for any employee; work hours / overtime / status are recomputed automatically from the active shift, or a status can be set directly (PRESENT, LATE, EARLY, ABSENT, LEAVE, HOLIDAY, HALF, WEEKEND)
- **Device User Management**: Create an employee, set a PIN, push the user to the device (`setUser`), enroll a fingerprint directly from the app, list/delete device users, and bulk-push all active employees
- **Holidays**: Mark official holidays per month (single add or bulk upload), or one-click sync the **Bangladesh government office holidays calendar** (auto-synced on server start and every 24h) — only administrative/government holidays are imported, academic and other non-government days are filtered out; holiday overtime is paid at the holiday overtime rate
- **Currency**: System-wide currency setting (default **BDT ৳**) shown on pay slips (PDF uses `BDT`), payroll, dashboard and salary fields
- **Payroll Rules**: Configurable overtime rate and holiday overtime rate in either decimal (1.5x) or percentage (150%) form, tax rate, working days/hours per month, and default weekly holiday; automatic payroll calculation from attendance (regular vs holiday overtime split, tax, net pay)
- **Exports & Reports**: Attendance sheets exportable to Excel (xlsx) and PDF — A4 portrait, narrow margins, full-width tables, no text wrap — including payment rates line (Hourly Basic Rate, Hourly OT Rate, Holiday OT Hourly Rate), total row at bottom, and **all days** (weekends, holidays, leaves, absent) with date ascending; Pay slips are **2-page A4** — Page 1 has 2 compact payslips (Employee Copy top, Office Copy bottom) with bold left-aligned employee name, attendance summary, payment rates, dynamic earnings/deductions, leave summary, and signature lines; Page 2 is an exact copy of the attendance report with total row
- **Employee sorting**: Employee lists are sorted ascending by employee ID using a numeric-aware order (e.g. `2, 10, 100` before `EMP001`)
- **Dashboard**: Live charts (attendance trend, status distribution, department breakdown), an interactive monthly calendar synced with attendance and holidays, all built entirely from real database data
- **Responsive UI**: All tables scroll horizontally on small screens and modals are scrollable, so the whole app works on mobile/tablet widths
- **Recruitment Management**: Job postings, applicant tracking with education history and full communication address, CV upload (PDF/JPG), and hiring workflow
- **Shift Scheduling**: Full shift CRUD with today's assignment list; late cutoff derives from the active shift
- **Leave Management**: Leave requests, approvals, and tracking; casual/medical leave balances (total, used, remaining) per employee per year
- **Role-Based Access Control**: Secure access with different user roles
- **Festival Bonus**: Eid-ul-Fitr and Eid-ul-Adha bonus for Muslims, plus other religious festivals for non-Muslims; auto-generated based on employee religion; supports 2x basic salary or 1x gross salary calculation; one-time or 2-installment payment; approval workflow and installment tracking
- **Loan Management**: Employee loan tracking with automatic salary deduction during payroll processing; installment generation, approval workflow, and overdue tracking

## System Architecture

### Backend
- Node.js with Express and TypeScript
- PostgreSQL database with Prisma ORM
- Real-time communication with Socket.io
- ZKTeco device integration using zk-attendance-sdk
- RESTful API design

### Frontend
- React with TypeScript
- Tailwind CSS for styling
- React Router for navigation
- Context API for state management
- Recharts for dashboard charts

### Mobile App
- React Native with Expo
- Cross-platform (iOS/Android/Web)
- Shared API with web application

## Getting Started

### Prerequisites
- Node.js (v18+)
- PostgreSQL
- Expo CLI (for mobile development)

### Installation

1. Clone the repository
2. Install dependencies:
   ```bash
   npm install
   ```
   This will install dependencies for backend, frontend, and mobile apps.

3. Set up environment variables:
   - Copy `.env.example` to `.env` in each directory (backend, frontend, mobile)
   - Configure database connection, JWT secrets, and ZKT device settings

4. Initialize the database:
   ```bash
   npm run prisma:setup
   ```
   This will generate Prisma client, run migrations, and seed the database.

5. Start the development servers:
   ```bash
   npm run dev
   ```
   This will start the backend, frontend, and mobile development servers concurrently.

### ZKTeco Device Configuration

The system connects to ZKTeco biometric devices via TCP/UDP on port 4370. Compatible devices include:

- **Fingerprint Terminals**: F22, F18, F7
- **Face + Fingerprint**: K40, K14, K50, K60
- **Face Recognition**: uFace 202, 302, 800
- **SpeedFace Series**: All SpeedFace models
- **Other**: Any ZKTeco device supporting TCP/UDP on port 4370

Non-ZKTeco brands (HID, Suprema, Anviz, etc.) are not supported.

The system is configured to connect to a device at IP address 192.168.31.5 by default. To change this:

1. Update the `ZKT_DEVICE_IP` in the backend `.env` file
2. Ensure the device is accessible from the server machine
3. The device should be configured for TCP/IP communication on port 4370

> The device supports a single TCP connection. Never run external device scripts while the backend is connected; use the API endpoints instead (`POST /api/devices/sync`, `POST /api/devices/clear-old-logs`, `POST /api/devices/users/sync-all`, `POST /api/devices/users/:employeeId/sync`, `POST /api/devices/users/:employeeId/enroll`).

## Attendance Engine

Each work day runs from Dhaka time 04:00 to the next day 04:00.

- **First punch of the day** = sign-in (`checkIn`), **last punch** = sign-out (`checkOut`).
- **Errand gaps**: consecutive odd-indexed gaps (out → back in) count toward `breakMinutes` and `errandCount` (personal-work errands) and are excluded from work hours.
- **Shift break (lunch)**: the shift's `breakTime` is only deducted from work hours when the employee **signed out after 4:00 PM** — a partial day (leaving before 4 PM) keeps the full span as work time. Auto sign-outs count as a full day. Lunch is paid, so the active shift runs `breakTime = 0` (the deduction rule stays in the engine but has nothing to deduct).
- **Overtime (regular)** = `max(0, checkOut − shiftEnd)`; it is **only counted when the employee signed out after his shift ends** — arriving early alone earns no overtime. Recorded as `overtimeHours`.
- **Early-attendance OT**: time punched **before the shift start**, capped at **10 minutes**, credited only when the shift was completed (signed out after shift end). Recorded separately as `earlyOvertimeHours` and shown as an **Early OT** column in attendance tables/exports.
- **Auto sign-out**: a day with only a sign-in is automatically signed out at 04:00 the next day (`autoCheckOut`).
- **Status precedence**: `LATE` > `EARLY` > `PRESENT`, using the active shift's start/end times.
- A single punch (sign-in only) is an open day: it shows `PRESENT` (or `LATE` if after shift start), never `EARLY`, until a real sign-out punch lands or the day auto-closes at 04:00.
- **Attendance statuses** (all-caps, shared by web + Excel/PDF + payslip): `PRESENT`, `LATE`, `EARLY`, `ABSENT`, `LEAVE`, `HOLIDAY`, `HALF`, `WEEKEND`. `EARLY` covers early departure, `HALF` covers half-day, `LEAVE` covers approved leave days, `HOLIDAY` covers marked (company) holidays, and `WEEKEND` covers an employee's weekly holiday — they are all distinct states.
- **Holiday/leave/weekend rows in the attendance list & sheets**: when a date range is filtered, the attendance list, the Excel/PDF attendance report and the pay slip automatically merge in synthetic rows for **active, non-exempt** employees who have no real record that day — a marked holiday shows `HOLIDAY`, an approved leave day shows `LEAVE`, and the employee's weekly holiday shows `WEEKEND` (precedence: real record > `HOLIDAY` > `LEAVE` > `WEEKEND`). Synthetic rows are read-only (marked `auto` in the web list) and carry no punches, so they never affect work hours, overtime or payroll present-day counts. `mergeAttendanceWithCalendar()` in `src/services/attendanceMerge.service.ts` is the shared entry point.
- **Manual status entry**: the Attendance page's manual entry / edit form has a Status dropdown (all 8 all-caps values, uppercased on save). A status-only record (no in/out times) writes a `LEAVE`, `ABSENT`, `HOLIDAY`, `HALF` or `WEEKEND` day directly; a record with punches computes the daily summary and then applies the chosen status. Leaving Status on "Auto" recomputes the status from the punches.
- Employees marked `attendanceExempt` never get attendance records — their device punches are ignored.
- Raw device punches are kept in each daily record's `punches` JSON array.
- The Attendance page toolbar (employee dropdown, date from, date to, Excel/PDF exports, Sync from Device, Manual Entry) sits in one row with equal-sized controls that keep a minimum width so the native date-picker calendar always renders; the page title/subtitle stay left-aligned while the toolbar aligns right.

## Holidays & Weekly Holidays

- Employees have a `weeklyHoliday` field (any weekday; falls back to the payroll `defaultWeeklyHoliday`) that can be overridden per employee. Each employee's weekly holiday shows as `WEEKEND` in their attendance list/sheets (see above).
- Official holidays are stored per day with a name. They can be added one at a time, uploaded in bulk (`YYYY-MM-DD, Holiday Name` per line) for any month, or imported automatically from the **Bangladesh government office holidays calendar** (`POST /api/holidays/sync-google` — also runs automatically on server start and every 24 hours). Only **administrative / government office holidays** are imported — academic/school/college and other non-administrative observances (e.g. Valentine's Day, Mothers'/Fathers' Day, Halloween, Easter, etc.) are filtered out, and any previously imported non-government holidays are removed on sync. The import is idempotent: dates that already exist are skipped.
- Holiday overtime (work on a weekly holiday or a marked holiday) is paid at the **holiday overtime rate** (default 2x) instead of the regular overtime rate (default 1.5x).

## Payroll & Pay Slips

- **Salary Structure**: Two salary types supported per employee:
  - **Gross Salary** (`salaryType: GROSS`): The employee's salary is a flat gross amount. Basic salary = gross amount.
  - **Scaled Salary** (`salaryType: SCALED`): Salary is calculated from a basic scale amount with allowances:
    - Basic Scale: base amount
    - Accommodation: 50% of basic (configurable)
    - Medical: 25% of basic (configurable)
    - Transport: 15% of basic (configurable)
    - Mobile & Internet: fixed amount
    - OT and Holiday OT are calculated on the basic scale amount
    - Total Gross = Basic + Accommodation + Medical + Transport + Mobile/Internet
- Payroll rules are stored in the database and editable from **Settings**:
  - `overtimeRate` (default 1.5), `holidayOvertimeRate` (default 2.0), `taxRate` (default 0.10), `workingDaysPerMonth` (default 26), `workingHoursPerDay` (default 9 — the paid 9-hour work day), `defaultWeeklyHoliday` (default Friday; any weekday), `currency` (default `BDT`), `errandDeductionMode` (default `SKIP`), `earlyOvertimeMode` (default `INCLUDE`).
  - Each overtime rate can be entered as a **decimal multiplier** (e.g. `1.5`) or a **percentage** (e.g. `150%`). A mode toggle on the Settings page switches between the two; the effective multiplier is always what the payroll engine uses.
  - **Errand deduction**: when set to `DEDUCT_FROM_OT`, the month's total errand (break) minutes are subtracted from an employee's *regular* overtime hours before overtime pay is calculated — holiday overtime is never touched. `SKIP` leaves errand time out of the calculation entirely.
  - **Early OT mode**: `INCLUDE` (default) adds an employee's early-attendance OT hours to overtime pay; `EXCLUDE` still reports them but leaves them out of the money calculation — the same include/exclude idea as errand time.
- **Auto-calculation** (`POST /api/payroll/process`): for each active employee, monthly attendance is split into regular vs holiday overtime hours (early-attendance OT split the same way and included only when `earlyOvertimeMode` is `INCLUDE`); `hourly = basic / workingDays / workingHours`; `overtimePay = regularOT × hourly × overtimeRate + holidayOT × hourly × holidayOvertimeRate` (after any errand deduction); `tax = (basic + overtimePay) × taxRate`; `netPay = gross − tax`. Existing payroll records for the month are replaced.
- Pay slips are exportable per employee per month as Excel or PDF and include the attendance sheet (weekday name and hour+minute work/overtime columns), overtime breakdown (regular × rate + holiday × rate), and leave summary.
- **Recomputing history**: after a rule/config change (e.g. paid lunch → `breakTime = 0`, or the OT-after-shift-end rule), run `node dist/scripts/recompute-attendance.js` in the backend container to re-derive every stored attendance record (`workHours`, `overtimeHours`, `earlyOvertimeHours`, late/early-departure, status) from its raw punches using the current shift. `recomputeAllAttendance()` in `src/services/zktService.ts` is the reusable entry point.
- Attendance statuses are shown as readable labels everywhere (web, Excel, PDF): `LATE` → **LATE IN**, `HALF` → **HALF DAY**, and the rest shown as their all-caps value (`EARLY`, `LEAVE`, `HOLIDAY`, `WEEKEND`, `ABSENT`, `PRESENT`).

## Exports & Reports

- **Attendance report** (Excel/PDF): per-employee daily rows with Weekday, In, Out, Errand (h m), Work (h m), Overtime (h m), Early OT (h m), Late (min), Status (including merged `HOLIDAY` / `LEAVE` / `WEEKEND` days for the filtered range), plus a Leave Summary block. **Report layout**: all margins narrow (28pt); Employee Name (bold), Department, and ID shown below generation date; single-row summary with late days, total late minutes, total errand minutes, and on-time days; payment rates below summary in same format showing daily basic, daily OT, hourly basic, hourly OT, holiday basic, and holiday OT; "Leave Summary" and "Attendance" headings bold, left-aligned; Leave Summary table with full-length headings (no text wrap, full page width); Attendance table without Employee ID/Name/Department columns, full page width matching Leave Summary table width, full-length headings (no text wrap); Late (min) and Status columns wider to prevent wrapping; Errand trips column removed; reduced line spacing to fit 31 attendance rows per page. PDFs are **A4 portrait**; Excel sheets are page-set up for A4 portrait printing.
- **Pay slip** (Excel/PDF): salary summary (basic, overtime pay, tax, deductions, net pay), leave balances, and monthly attendance rows (including the month's `HOLIDAY` / `LEAVE` / `WEEKEND` days). PDF is **A4 portrait**; the Excel sheet is page-set up for A4 portrait printing.
- Date filtering uses Dhaka-day normalization so a single day (`startDate=endDate=YYYY-MM-DD`) filters correctly.
- All durations across the app (attendance tables, dashboard, exports) are shown as hour+minute (e.g. `8h 30m`) rather than decimal hours, and every attendance table includes the weekday name.

## Dashboard

The dashboard reads live data from the database only (no dummy data):

- Overview cards: total/active employees, present/absent today, net pay for the current month.
- First row (equal cards): today's attendance summary (expected / present / late / early / absent, attendance rate, weekly-holiday awareness), the 30-day attendance trend (present / late / absent area chart), and the status distribution pie chart for the current month.
- Second row (equal cards): the **attendance calendar** (a monthly grid, Dhaka days, colored by attendance/holiday state — weekly holidays and marked holidays, present, late, absent — with a legend and a highlight for today) alongside the employees vs present by department bar chart.
- Overtime hours, approved leave days, holidays this month, open positions, and a recent attendance list that shows **today's** records only.

## Deployment (Docker)

The project is deployed with Docker Compose on a Linux server (`db`, `backend`, `frontend` services).

```bash
docker compose up -d --build
```

The backend automatically runs `npx prisma db push --skip-generate` before starting, so schema changes are applied on every backend start. The frontend is served on port 9000 via nginx and the backend API is proxied at `/api`.

## API Documentation

The backend provides a RESTful API at `/api` with the following endpoints:

- `/auth` - Authentication (login, register, refresh token)
- `/employees` - Employee management, including `GET /employees/meta` (form options), `GET/PUT /employees/:id/leave-balance`, `POST /employees/:id/documents` (photograph / govt. ID / CV upload), `POST /employees/:id/terminate|resign|retire`, `DELETE /employees/:id` (permanent)
- `/attendance` - Attendance tracking, including `GET /attendance/export?startDate&endDate&format=xlsx|pdf`, `POST /` (manual entry), `PUT/DELETE /:id` (adjust/delete)
- `/payroll` - Payroll processing, including `GET /payroll/payslip/:employeeId?month=YYYY-MM&format=xlsx|pdf`, `POST /payroll/process`
- `/recruitment` - Recruitment management, including applicant CRUD (`PUT/DELETE /:recruitmentId/applicants/:applicantId`) and CV upload (`POST /:recruitmentId/applicants/:applicantId/cv`), served from `/api/uploads`
- `/shifts` - Shift scheduling, including shift assignments (`GET/POST /assignments`, `PUT/DELETE /assignments/:assignmentId`)
- `/leave` - Leave management
- `/holidays` - Holiday management (`GET /`, `POST /`, `POST /bulk`, `POST /sync-google`, `PUT/DELETE /:id`)
- `/loans` - Loan management (`POST /`, `GET /`, `GET /upcoming`, `GET /:id`, `GET /:employeeId/summary`, `POST /:id/approve`, `POST /:id/disburse`, `POST /:loanId/installments/:installmentId/pay`, `POST /:id/cancel`); loans are auto-deducted from salary during payroll processing
- `/festival-bonuses` - Festival bonus management (`POST /`, `GET /`, `GET /summary`, `POST /auto-generate`, `GET /:id`, `POST /:id/approve`, `POST /:id/installment`, `POST /:id/cancel`, `DELETE /:id`); Eid-ul-Fitr and Eid-ul-Adha bonuses for Muslims, other religious festivals for non-Muslims; auto-generated based on employee religion; included in payslip bonus field
- `/settings` - Payroll rules (`GET /`, `PUT /`) including `currency` and `errandDeductionMode`
- `/dashboard` - Dashboard analytics (`GET /`)
- `/devices` - ZKT device management (`POST /devices/sync`, `POST /devices/clear-old-logs`, `GET/POST/DELETE /devices/users`, `POST /devices/users/sync-all`, `POST /devices/users/:employeeId/sync`, `POST /devices/users/:employeeId/enroll`)

## Contributing

1. Fork the repository
2. Create a feature branch
3. Commit your changes
4. Push to the branch
5. Open a pull request

## License

This project is licensed under the MIT License.