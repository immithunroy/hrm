# Architecture Overview

System architecture and design decisions for the HRM application.

---

## High-Level Architecture

```
┌─────────────────────────────────────────────────┐
│                    Clients                       │
│  ┌──────────┐  ┌──────────┐  ┌───────────────┐ │
│  │ Frontend │  │  Mobile  │  │  ZKT Device   │ │
│  │ (React)  │  │ (Expo)   │  │  (Biometric)  │ │
│  └────┬─────┘  └────┬─────┘  └──────┬────────┘ │
│       │              │               │           │
└───────┼──────────────┼───────────────┼───────────┘
        │              │               │
        ▼              ▼               │
┌──────────────────────────────────────┼───────────┐
│           nginx (port 8060)          │           │
│   /api/* → backend:5000              │           │
│   /*     → static frontend           │           │
└────────┬─────────────────────────────┼───────────┘
         │                             │
         ▼                             ▼
┌─────────────────────┐    ┌──────────────────────┐
│    Backend API      │    │   Socket.IO (WS)     │
│   (Express + TS)    │◄───│  Real-time punches   │
│    port 5000        │    │                      │
└────────┬────────────┘    └──────────────────────┘
         │
         ▼
┌─────────────────────┐
│   PostgreSQL 16     │
│  (Prisma ORM)       │
│  port 5432          │
│  TZ: Asia/Dhaka     │
└─────────────────────┘
```

---

## Tech Stack

| Layer | Technology | Version |
|-------|-----------|---------|
| **Backend Runtime** | Node.js | v18+ |
| **Backend Framework** | Express.js | 4.19 |
| **Language** | TypeScript | 5.4 |
| **ORM** | Prisma | 5.12 |
| **Database** | PostgreSQL | 16 (Alpine) |
| **Frontend Framework** | React | 18.2 |
| **Build Tool** | Vite | 5.2 |
| **Styling** | Tailwind CSS | 3.4 |
| **UI Components** | shadcn/ui (Radix UI) | — |
| **Charts** | Recharts | 2.12 |
| **Routing** | React Router | 6.22 |
| **Mobile** | React Native + Expo | SDK 51 |
| **Biometric Integration** | zk-attendance-sdk | 2.3 |
| **Real-time** | Socket.IO | 4.7 |
| **Auth** | JWT (jsonwebtoken) | — |
| **Validation** | Zod | — |

---

## Directory Structure

```
hrm/
├── backend/
│   ├── src/
│   │   ├── server.ts              # Express + Socket.IO entrypoint
│   │   ├── config/
│   │   │   └── database.ts        # Prisma client singleton
│   │   ├── middleware/
│   │   │   ├── authenticateToken.ts  # JWT auth + RBAC
│   │   │   ├── rateLimiter.ts        # In-memory rate limiting
│   │   │   └── validateRequest.ts    # Zod validation
│   │   ├── routes/                # 16 route files (107 endpoints)
│   │   ├── controllers/           # 16 controller files
│   │   ├── services/              # 7 service files (business logic)
│   │   ├── schemas/               # 11 Zod schema files
│   │   ├── utils/
│   │   │   └── appError.ts        # Error handling
│   │   ├── scripts/
│   │   │   └── recompute-attendance.ts  # CLI tool
│   │   └── migrations/
│   │       └── migrateUsername.ts  # Startup migration
│   ├── prisma/
│   │   ├── schema.prisma          # Database schema (737 lines)
│   │   └── seed.ts                # Seed data
│   └── Dockerfile
├── frontend/
│   ├── src/
│   │   ├── App.tsx                # Root component
│   │   ├── AppRoutes.tsx          # Route definitions
│   │   ├── main.tsx               # Entry point
│   │   ├── context/
│   │   │   └── AuthContext.tsx     # Auth state management
│   │   ├── services/
│   │   │   └── api.ts             # HTTP client singleton
│   │   ├── pages/                 # 18 page components
│   │   ├── components/
│   │   │   ├── layout/
│   │   │   │   └── AppLayout.tsx  # Sidebar + header layout
│   │   │   ├── InactivityManager.tsx  # Session timeout
│   │   │   ├── InactivityWarning.tsx  # Timeout warning modal
│   │   │   └── ui/                # 22 UI primitives (shadcn/ui)
│   │   ├── types/                 # TypeScript types
│   │   └── lib/                   # Utilities (format, colors)
│   └── Dockerfile
├── mobile/                        # React Native / Expo app
├── docker-compose.yml             # 3 services: db, backend, frontend
├── package.json                   # Workspace root
└── docs/                          # Documentation
```

---

## Request Flow

### 1. Authentication Flow

```
Client → POST /api/auth/login
  → validateRequest (Zod schema)
  → authRateLimit (20 req/15min)
  → authController.login
    → Find user by username
    → Compare bcrypt password
    → Generate JWT access token (15min) + refresh token (7d)
  → Return { user, accessToken, refreshToken }

Client → GET /api/employees
  → authenticateToken middleware
    → Extract "Bearer <token>" from Authorization header
    → Verify JWT with JWT_SECRET
    → Set req.userId, req.userRole
    → Cache role in memory for 5 minutes
  → authorizeOrSelf middleware
    → Check user role OR req.params.id === req.userId
  → employeeController.getAll
  → Return response
```

### 2. Attendance Flow (ZKT Device → Database)

```
ZKT Device ──TCP:4370──→ zktService.connectZKTDevice
  → SDK connects, authenticates, enables
  → Registers device in database
  → Starts real-time attendance listener
  → Starts periodic sync (every 5 minutes)

On punch received:
  → processPunch(userId, timestamp)
    → resolveEmployee(userId) — find Employee by deviceUid
    → getShiftForEmployee(employeeId, date) — resolve active shift
    → computeDailySummary(punches, shift)
      → Sort punches chronologically
      → First = checkIn, last = checkOut
      → Compute work hours, OT, early OT, late, errands
      → Determine status (PRESENT/LATE/EARLY/ABSENT)
    → Upsert Attendance record
    → Send notification if LATE/EARLY

Auto sign-out:
  → autoSignOutIfNeeded() runs every 10 minutes
  → Closes any open single-punch day at 04:00 rollover
```

### 3. Payroll Processing Flow

```
Admin clicks "Process Payroll" for month YYYY-MM
  → POST /api/payroll/process { month: "2026-01" }
  → payrollController.process
    → Get payroll settings (OT rate, tax rate, working days/hours)
    → Get all active non-exempt employees
    → For each employee:
      → Fetch attendance records for the month
      → Split into regular OT vs holiday OT
      → Apply early OT mode (INCLUDE/EXCLUDE)
      → Apply errand deduction mode (SKIP/DEDUCT_FROM_OT)
      → Calculate: hourly = basic / workingDays / workingHours
      → Calculate: overtimePay = regularOT × hourly × rate + holidayOT × hourly × holidayRate
      → Calculate: tax = (basic + overtimePay) × taxRate
      → Calculate: netPay = gross - tax
      → Upsert Payroll record
    → Return processed records
```

### 4. Export Flow (Attendance Report / Payslip)

```
GET /api/attendance/export?startDate=X&endDate=Y&format=pdf
  → attendanceController.export
    → Fetch attendance records
    → mergeAttendanceWithCalendar() — add HOLIDAY/LEAVE/WEEKEND rows
    → Get leave summaries per employee
    → Get payroll settings
    → buildAttendancePdf(rows, title, leaveByEmployee, settings)
      → PDFKit: A4 portrait, narrow margins
      → Page header with generation date
      → Employee info (name, dept, ID)
      → Summary stats (late days, on-time days)
      → Payment rates (daily basic, daily OT, hourly rates)
      → Leave summary table
      → Attendance table (31 rows/page max)
    → Return PDF buffer
```

---

## Key Design Decisions

### Timezone: Asia/Dhaka (UTC+6)

All attendance and holiday logic operates in Dhaka time:
- **Work day boundary:** 04:00 to next day 04:00 (not midnight)
- **Dates stored as UTC** but normalized to Dhaka day for queries
- **Holiday midnight** = UTC 18:00 previous day (Dhaka is UTC+6)

### Salary Types

Two salary calculation models:

1. **GROSS** — Flat salary amount. Basic = gross. Simple calculation.
2. **SCALED** — Basic scale + allowances:
   - Accommodation: 50% of basic
   - Medical: 25% of basic
   - Transport: 15% of basic
   - Mobile/Internet: Fixed amount
   - OT calculated on basic scale amount

### Attendance Status Logic

Status is determined by comparing punches against the active shift:

```
Status Priority: LATE > EARLY > PRESENT

If no punches → ABSENT
If holiday → HOLIDAY
If weekly holiday → WEEKEND
If approved leave → LEAVE

If checkIn > shiftStart → LATE
If checkOut < shiftEnd → EARLY
Otherwise → PRESENT

If only one punch (no checkOut) → PRESENT (or LATE if late check-in)
Auto sign-out at 04:00 → treated as full day
```

### Role-Based Access Control (RBAC)

| Role | Capabilities |
|------|-------------|
| **ADMIN** | Full access. Create/delete employees, manage roles, all settings. |
| **HR** | Employee CRUD, attendance management, payroll, leave approvals. |
| **MANAGER** | View team, approve leave, manage tasks. |
| **FINANCE** | View payroll, export reports. |
| **EMPLOYEE** | Self-service only. View own data, request leave, view payslips. |

**Self-access pattern:** `authorizeOrSelf()` middleware allows users to access their own resources (e.g., `GET /employees/:id` where `:id` matches their own employee ID).

**Sensitive data stripping:** EMPLOYEE role users receive stripped responses (salary, bank account, tax ID are hidden).

### Error Handling

- **Operational errors** (validation, auth, not found) → Return structured JSON with status code
- **Programming errors** (bugs) → Return generic 500 (message hidden in production)
- **ZKT device errors** → Logged but don't crash the server (non-fatal on startup)

### Real-time Communication

Socket.IO is used for:
- Real-time attendance punch notifications
- Multi-tab session sync (logout broadcast)
- Inactivity timeout warnings

---

## Database Connection

```typescript
// config/database.ts
const prisma = new PrismaClient({
  log: process.env.NODE_ENV === 'development'
    ? ['query', 'error', 'warn']
    : ['error', 'warn'],
});
```

- Connection pooling via Prisma (default: connection limit = CPU cores × 2 + 1)
- Health check via `pg_isready` in Docker Compose
- Auto-migration on backend start: `npx prisma db push --skip-generate`

---

## Security

### JWT Authentication
- **Access token:** 15-minute expiry
- **Refresh token:** 7-day expiry
- **Secrets:** `JWT_SECRET` and `JWT_REFRESH_SECRET` from environment

### Password Hashing
- bcrypt with salt rounds (10)

### Rate Limiting
- Auth endpoints: 20 requests per 15 minutes per IP
- In-memory sliding window (no Redis dependency)

### CORS
- Configured origin: `http://localhost:8060`, `http://103.177.54.6:8060`
- Credentials enabled

### Helmet
- Cross-origin resource policy header set

### File Upload Security
- File type validation (MIME type + extension)
- Size limits enforced
- Files stored outside public directory, served via `/api/uploads`

---

## Deployment Architecture

```
┌─────────────────────────────────────────┐
│          Production Server              │
│         103.177.54.6                    │
│                                         │
│  ┌─────────────────────────────────┐   │
│  │       Docker Compose            │   │
│  │  ┌──────────┐  ┌──────────┐   │   │
│  │  │ db       │  │ backend  │   │   │
│  │  │ Postgres │  │ Express  │   │   │
│  │  │ :5432    │  │ :5000    │   │   │
│  │  └──────────┘  └──────────┘   │   │
│  │  ┌──────────────────────────┐  │   │
│  │  │ frontend (nginx)         │  │   │
│  │  │ :8060 → :80              │  │   │
│  │  └──────────────────────────┘  │   │
│  └─────────────────────────────────┘   │
│                                         │
│  ┌─────────────────────────────────┐   │
│  │   nginx-proxy-manager           │   │
│  │   SSL termination               │   │
│  └─────────────────────────────────┘   │
└─────────────────────────────────────────┘
```

**CI/CD Pipeline:**
1. Push to `main` branch
2. GitHub Actions SSH into server
3. `git pull` latest code
4. `docker compose build` backend + frontend
5. `docker compose up -d` restart services

**Startup Sequence:**
1. Prisma connects to PostgreSQL
2. Username migration runs (idempotent)
3. ZKT device connection attempted (non-fatal)
4. Bangladesh government holidays synced (non-fatal)
5. Daily holiday re-sync scheduled
6. Express server starts on port 5000
