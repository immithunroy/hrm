# Backend Developer Guide

Guide for backend developers working on the HRM Express.js API.

---

## Tech Stack

- **Runtime:** Node.js v18+
- **Framework:** Express.js 4.19
- **Language:** TypeScript 5.4
- **ORM:** Prisma 5.12
- **Database:** PostgreSQL 16
- **Auth:** JWT (jsonwebtoken)
- **Validation:** Zod
- **Real-time:** Socket.IO 4.7
- **Biometric:** zk-attendance-sdk 2.3

---

## Project Structure

```
backend/
├── src/
│   ├── server.ts              # Entry point — Express app, Socket.IO, startup sequence
│   ├── config/
│   │   └── database.ts        # PrismaClient singleton
│   ├── middleware/
│   │   ├── authenticateToken.ts  # JWT verification + RBAC + self-access
│   │   ├── rateLimiter.ts        # In-memory sliding window rate limiter
│   │   └── validateRequest.ts    # Zod schema validation middleware
│   ├── routes/                # Express Router definitions
│   ├── controllers/           # Request handlers (thin — delegate to services)
│   ├── services/              # Business logic layer
│   ├── schemas/               # Zod validation schemas
│   ├── utils/
│   │   └── appError.ts        # Custom error class + error/404 handlers
│   ├── scripts/
│   │   └── recompute-attendance.ts  # CLI recomputation tool
│   └── migrations/
│       └── migrateUsername.ts  # Startup migration
├── prisma/
│   ├── schema.prisma          # Database schema
│   └── seed.ts                # Seed data
├── Dockerfile
└── package.json
```

---

## Architecture Pattern

The backend follows a **Routes → Controllers → Services** pattern:

```
HTTP Request
  → Route (Express Router + auth middleware + validation)
    → Controller (parse request, call service, format response)
      → Service (business logic, database queries via Prisma)
```

### Adding a New Endpoint

1. **Define Zod schema** in `src/schemas/<module>.schema.ts`
2. **Create route** in `src/routes/<module>.routes.ts`
3. **Create controller** in `src/controllers/<module>.controller.ts`
4. **Create service** in `src/services/<module>.service.ts` (if business logic is complex)
5. **Mount route** in `server.ts`

### Example: Adding a new endpoint

```typescript
// 1. Schema
// src/schemas/example.schema.ts
import { z } from 'zod';

export const createExampleSchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().optional(),
});

// 2. Route
// src/routes/example.routes.ts
import { Router } from 'express';
import { authenticateToken } from '../middleware/authenticateToken';
import { validateRequest } from '../middleware/validateRequest';
import { createExampleSchema } from '../schemas/example.schema';
import * as exampleController from '../controllers/example.controller';

const router = Router();
router.use(authenticateToken);

router.post('/', validateRequest(createExampleSchema), exampleController.create);
router.get('/', exampleController.getAll);

export default router;

// 3. Controller
// src/controllers/example.controller.ts
import { Request, Response, NextFunction } from 'express';
import * as exampleService from '../services/example.service';

export const create = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await exampleService.create(req.body);
    res.status(201).json(result);
  } catch (error) {
    next(error);
  }
};

export const getAll = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const results = await exampleService.getAll();
    res.json(results);
  } catch (error) {
    next(error);
  }
};

// 4. Mount in server.ts
import exampleRoutes from './routes/example.routes';
app.use('/api/examples', exampleRoutes);
```

---

## Middleware

### authenticateToken

Extracts and verifies JWT from `Authorization: Bearer <token>` header.

- Sets `req.userId` and `req.userRole`
- Caches role lookups for 5 minutes (in-memory)
- Returns 401 on invalid/expired token

### authorize(...roles)

Standard RBAC check. Returns 403 if user role not in allowed list.

```typescript
router.delete('/:id', authenticateToken, authorize('ADMIN'), controller.delete);
```

### authorizeOrSelf(...roles)

Allows access if user has allowed role OR is accessing their own resource.

```typescript
router.get('/:id', authenticateToken, authorizeOrSelf('ADMIN', 'HR'), controller.getById);
// If req.params.id === req.userId → allowed (self-access)
// Else → checks user role against allowed roles
```

### validateRequest(schema)

Validates `req.body` against a Zod schema. Returns 400 with field-level errors on failure.

### rateLimit(windowMs, max)

In-memory sliding window rate limiter. Pre-configured: `authRateLimit` (20 req/15min).

---

## Authentication

### JWT Tokens

- **Access token:** 15-minute expiry, contains `{ userId, userRole }`
- **Refresh token:** 7-day expiry, used to obtain new access tokens
- **Secrets:** `JWT_SECRET` and `JWT_REFRESH_SECRET` from environment

### Password Hashing

bcrypt with 10 salt rounds. Passwords are never stored in plain text.

### Session Management

- Frontend stores `accessToken` in `localStorage`
- On 401 response, frontend clears token and redirects to `/login?error=session_expired`
- `InactivityManager` component auto-logs out after 30 minutes of inactivity
- Multi-tab logout sync via `BroadcastChannel`

---

## Services Overview

### zktService.ts (1125 lines)

The largest and most critical service. Handles:

- **Device connection lifecycle** (connect, authenticate, register, real-time sync)
- **Punch processing** (raw timestamps → attendance records)
- **Daily summary computation** (work hours, OT, early OT, late, errands, status)
- **Auto sign-out** (closes open days at 04:00)
- **Manual attendance computation** (admin entries)
- **Device user management** (push employees, enroll fingerprints)
- **Attendance recomputation** (recalculate all records from raw punches)

**Key functions:**
- `processPunch(userId, punchMs)` — Core punch processing
- `computeDailySummary(punches, shift)` — Core algorithm
- `recomputeAllAttendance()` — Full recomputation
- `connectZKTDevice(io)` — Device connection lifecycle

### export.service.ts (1206 lines)

Excel and PDF generation for attendance reports and payslips.

**Key functions:**
- `buildAttendanceWorkbook(rows, title, leaveByEmployee, settings)` — Excel report
- `buildAttendancePdf(rows, title, leaveByEmployee, settings)` — PDF report
- `buildPayslipWorkbook(data)` — 2-page payslip Excel
- `buildPayslipPdf(data)` — 2-page payslip PDF

### settings.service.ts (136 lines)

Payroll configuration persistence via `SystemSetting` key-value store.

### loan.service.ts (317 lines)

Full loan lifecycle: create → approve → disburse → installments → complete/default.

### holiday.service.ts (194 lines)

Holiday management with Bangladesh government iCal feed sync.

### festivalBonus.service.ts (232 lines)

Festival bonus management (Eid, etc.) with auto-generation based on employee religion.

### attendanceMerge.service.ts (108 lines)

Merges real attendance records with calendar rows (HOLIDAY/LEAVE/WEEKEND/ABSENT) for complete attendance views.

---

## Database Access

### Prisma Client

Singleton instance in `config/database.ts`:

```typescript
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient({
  log: process.env.NODE_ENV === 'development'
    ? ['query', 'error', 'warn']
    : ['error', 'warn'],
});

export default prisma;
```

### Common Patterns

```typescript
// Find many with pagination
const employees = await prisma.employee.findMany({
  where: { status: 'ACTIVE' },
  include: { department: true, position: true },
  skip: (page - 1) * limit,
  take: limit,
  orderBy: { employeeId: 'asc' },
});

// Upsert
const attendance = await prisma.attendance.upsert({
  where: { id: existingId },
  create: { employeeId, date, ...data },
  update: { ...data },
});

// Transaction
const result = await prisma.$transaction([
  prisma.payroll.create({ data: payrollData }),
  prisma.attendance.updateMany({ where: { employeeId }, data: { status: 'PAID' } }),
]);
```

---

## Error Handling

### AppError Class

```typescript
// Custom operational error
throw new AppError('Employee not found', 404);

// Validation error with field details
throw new AppError('Validation failed', 400, [
  { field: 'email', message: 'Email already exists' }
]);
```

### Error Handler Middleware

- Operational errors → Return structured JSON with status code
- Programming errors → Return generic 500 (message hidden in production)
- 404 catch-all → Creates 404 AppError for unmatched routes

---

## Adding New Features

### Checklist

1. [ ] Design database schema changes in `prisma/schema.prisma`
2. [ ] Run `npx prisma db push` to apply schema
3. [ ] Create Zod validation schemas in `src/schemas/`
4. [ ] Create route file in `src/routes/`
5. [ ] Create controller file in `src/controllers/`
6. [ ] Create service file in `src/services/` (if needed)
7. [ ] Mount route in `server.ts`
8. [ ] Add tests (if applicable)
9. [ ] Update API documentation
10. [ ] Update this guide if introducing new patterns

### Code Style

- Use `async/await` for all async operations
- Use `try/catch` in controllers, delegate errors to `next(error)`
- Use Prisma for all database access (no raw SQL)
- Use Zod for all input validation
- Use TypeScript strict mode
- No comments in code unless requested (follow existing pattern)

---

## Scripts

### recompute-attendance.ts

CLI tool to recompute all attendance records:

```bash
# Via Docker
docker compose exec backend node dist/scripts/recompute-attendance.js

# Or directly
npx ts-node src/scripts/recompute-attendance.ts
```

Recalculates `workHours`, `overtimeHours`, `earlyOvertimeHours`, late/early departure, and status for every record using current shift rules. Use after changing payroll rules or shift configurations.

---

## Performance Considerations

- **Prisma connection pooling:** Default = CPU cores × 2 + 1
- **Rate limiting:** Only on auth endpoints (no global rate limit)
- **Role caching:** 5-minute in-memory cache avoids DB lookups on every request
- **Device connection:** Single TCP connection to ZKT device (never run external scripts while connected)
- **Attendance queries:** Indexed on `(employeeId, date)` and `date` for fast lookups
