# HRM API Documentation

Complete reference for all 107 REST API endpoints.

**Base URL:** `http://localhost:5000/api` (development) or `http://103.177.54.6:8060/api` (production)

**Authentication:** JWT Bearer token in `Authorization` header.

---

## Table of Contents

- [Authentication](#authentication)
- [Employees](#employees)
- [Attendance](#attendance)
- [Payroll](#payroll)
- [Leave](#leave)
- [Shifts](#shifts)
- [Holidays](#holidays)
- [Devices](#devices)
- [Recruitment](#recruitment)
- [Loans](#loans)
- [Festival Bonuses](#festival-bonuses)
- [Tasks](#tasks)
- [Announcements](#announcements)
- [Notifications](#notifications)
- [Dashboard](#dashboard)
- [Settings](#settings)

---

## Authentication

### POST `/api/auth/register`

Register a new user account.

**Body:**
```json
{
  "firstName": "John",
  "lastName": "Doe",
  "email": "john@example.com",
  "username": "johndoe",
  "password": "password123",
  "employeeId": "optional-employee-id"
}
```

**Response:** `201 Created`
```json
{
  "user": { "id": "...", "firstName": "John", "lastName": "Doe", "email": "john@example.com", "username": "johndoe", "role": "EMPLOYEE" },
  "accessToken": "jwt-token",
  "refreshToken": "jwt-refresh-token"
}
```

### POST `/api/auth/login`

Authenticate and receive JWT tokens.

**Body:**
```json
{
  "username": "johndoe",
  "password": "password123"
}
```

**Response:** `200 OK`
```json
{
  "user": { "id": "...", "firstName": "John", "lastName": "Doe", "email": "john@example.com", "username": "johndoe", "role": "EMPLOYEE" },
  "accessToken": "jwt-token",
  "refreshToken": "jwt-refresh-token"
}
```

### POST `/api/auth/refresh-token`

Refresh an expired access token.

**Body:**
```json
{
  "refreshToken": "jwt-refresh-token"
}
```

**Response:** `200 OK`
```json
{
  "accessToken": "new-jwt-token",
  "refreshToken": "new-refresh-token"
}
```

### POST `/api/auth/logout`

Log out the current user (requires auth).

**Response:** `200 OK`
```json
{ "message": "Logged out successfully" }
```

### GET `/api/auth/me`

Get the current authenticated user's profile.

**Response:** `200 OK`
```json
{
  "id": "...",
  "firstName": "John",
  "lastName": "Doe",
  "email": "john@example.com",
  "username": "johndoe",
  "employeeId": "EMP001",
  "role": "EMPLOYEE"
}
```

### POST `/api/auth/change-password`

Change the current user's password.

**Body:**
```json
{
  "currentPassword": "old-password",
  "newPassword": "new-password-min-8-chars"
}
```

**Response:** `200 OK`
```json
{ "message": "Password changed successfully" }
```

---

## Employees

### GET `/api/employees`

List all employees with optional filtering and pagination.

**Query Parameters:**
| Param | Type | Description |
|-------|------|-------------|
| `page` | number | Page number (default: 1) |
| `limit` | number | Items per page (default: 10) |
| `search` | string | Search by name, email, or employeeId |
| `departmentId` | string | Filter by department ID |
| `positionId` | string | Filter by position ID |
| `status` | string | Filter by status (ACTIVE, INACTIVE, etc.) |

**Response:** `200 OK`
```json
{
  "employees": [{ "id": "...", "employeeId": "EMP001", "firstName": "John", ... }],
  "pagination": { "total": 50, "page": 1, "limit": 10, "totalPages": 5 }
}
```

### GET `/api/employees/meta`

Get employee metadata for form dropdowns (departments, positions, counts).

**Response:** `200 OK`
```json
{
  "departments": [{ "id": "...", "name": "Engineering", "code": "ENG" }],
  "positions": [{ "id": "...", "title": "Software Engineer" }],
  "totalEmployees": 50,
  "activeEmployees": 45
}
```

### GET `/api/employees/:id`

Get a single employee by ID. Returns full profile for ADMIN/HR, sensitive fields stripped for EMPLOYEE role.

**Response:** `200 OK`
```json
{
  "id": "...",
  "employeeId": "EMP001",
  "firstName": "John",
  "lastName": "Doe",
  "email": "john@example.com",
  "department": { "id": "...", "name": "Engineering" },
  "position": { "id": "...", "title": "Software Engineer" },
  "salary": 50000,
  "salaryType": "GROSS",
  "role": "EMPLOYEE",
  "status": "ACTIVE",
  ...
}
```

### POST `/api/employees`

Create a new employee. Requires ADMIN or HR role.

**Body:** Full employee object with all fields (see schema). Required: `firstName`, `lastName`, `email`, `employeeId`, `departmentId`, `positionId`, `employmentType`, `hireDate`.

**Response:** `201 Created` — Returns created employee.

### PUT `/api/employees/:id`

Update an employee. ADMIN/HR can update anyone; EMPLOYEE can only update own profile (limited fields).

**Body:** Partial employee fields to update.

**Response:** `200 OK` — Returns updated employee.

### DELETE `/api/employees/:id`

Permanently delete an employee and all related records. Requires ADMIN role.

**Response:** `200 OK`
```json
{ "message": "Employee deleted successfully" }
```

### POST `/api/employees/:id/documents`

Upload employee documents (photograph, government ID, CV). Multipart form data.

**Body (multipart):**
- `profileImage` — Photograph (JPG/PNG/WebP, max 5MB)
- `govtIdDocument` — Scanned government ID (PDF/JPG/PNG/WebP, max 10MB)
- `cv` — CV/Resume (PDF/JPG/PNG/WebP, max 10MB)

**Response:** `200 OK`
```json
{
  "profileImageUrl": "/api/uploads/employee/profile-xxx.jpg",
  "idDocumentUrl": "/api/uploads/employee/govtid-xxx.pdf",
  "cvUrl": "/api/uploads/employee/cv-xxx.pdf"
}
```

### POST `/api/employees/:id/:action`

Set employment status. Action can be `terminate`, `resign`, or `retire`.

**Response:** `200 OK`
```json
{ "message": "Employee terminated successfully", "employee": { ... } }
```

### GET `/api/employees/:id/attendance`

Get attendance records for a specific employee.

**Query Parameters:** `startDate`, `endDate`, `page`, `limit`

**Response:** `200 OK`
```json
{
  "attendance": [{ "id": "...", "date": "...", "checkIn": "...", "status": "PRESENT", ... }],
  "pagination": { ... }
}
```

### GET `/api/employees/:id/payroll`

Get payroll records for a specific employee.

**Response:** `200 OK`
```json
{
  "payroll": [{ "id": "...", "payPeriodStart": "...", "netPay": 45000, ... }]
}
```

### GET `/api/employees/:id/leave-balance`

Get leave balance for an employee.

**Response:** `200 OK`
```json
{
  "id": "...",
  "employeeId": "...",
  "year": 2026,
  "casualTotal": 10,
  "casualUsed": 3,
  "medicalTotal": 5,
  "medicalUsed": 1
}
```

### PUT `/api/employees/:id/leave-balance`

Update leave balance for an employee. Requires ADMIN or HR role.

**Body:**
```json
{
  "casualTotal": 12,
  "casualUsed": 3,
  "medicalTotal": 6,
  "medicalUsed": 1
}
```

---

## Attendance

### POST `/api/attendance/checkin`

Manual check-in (mobile or admin entry).

**Body:**
```json
{
  "employeeId": "optional-for-self",
  "date": "2026-01-15"
}
```

### POST `/api/attendance/checkout`

Manual check-out.

**Body:**
```json
{
  "employeeId": "optional-for-self",
  "date": "2026-01-15"
}
```

### GET `/api/attendance/my`

Get the current user's own attendance records.

**Query Parameters:** `startDate`, `endDate`, `page`, `limit`

### GET `/api/attendance`

List all attendance records with optional filtering.

**Query Parameters:**
| Param | Type | Description |
|-------|------|-------------|
| `employeeId` | string | Filter by employee |
| `startDate` | string | Start date (YYYY-MM-DD) |
| `endDate` | string | End date (YYYY-MM-DD) |
| `status` | string | Filter by status |
| `page` | number | Page number |
| `limit` | number | Items per page |

**Response:** `200 OK`
```json
{
  "attendance": [
    {
      "id": "...",
      "employeeId": "...",
      "employee": { "firstName": "John", "lastName": "Doe", "employeeId": "EMP001" },
      "date": "2026-01-15T00:00:00.000Z",
      "checkIn": "2026-01-15T03:00:00.000Z",
      "checkOut": "2026-01-15T12:00:00.000Z",
      "status": "PRESENT",
      "workHours": 8.5,
      "overtimeHours": 1.0,
      "earlyOvertimeHours": 0.17,
      "lateMinutes": 0,
      "earlyDepartureMinutes": 0,
      "breakMinutes": 30,
      "errandCount": 1,
      "punches": ["2026-01-15T03:00:00Z", "2026-01-15T07:30:00Z", "2026-01-15T08:00:00Z", "2026-01-15T12:00:00Z"]
    }
  ],
  "pagination": { "total": 200, "page": 1, "limit": 10, "totalPages": 20 }
}
```

### GET `/api/attendance/export`

Export attendance report as Excel or PDF.

**Query Parameters:**
| Param | Type | Description |
|-------|------|-------------|
| `startDate` | string | Start date (required) |
| `endDate` | string | End date (required) |
| `employeeId` | string | Optional employee filter |
| `format` | string | `xlsx` or `pdf` (default: `xlsx`) |

**Response:** Binary file download (Excel or PDF).

### GET `/api/attendance/today`

Get today's attendance records for all employees.

### GET `/api/attendance/stats`

Get attendance statistics (present/late/early/absent counts).

### GET `/api/attendance/:id`

Get a single attendance record by ID.

### POST `/api/attendance`

Create a manual attendance record. Requires ADMIN or HR role.

**Body:**
```json
{
  "employeeId": "...",
  "date": "2026-01-15",
  "checkIn": "2026-01-15T09:00:00.000Z",
  "checkOut": "2026-01-15T17:00:00.000Z",
  "breakMinutes": 60,
  "status": "PRESENT"
}
```

### PUT `/api/attendance/:id`

Update an attendance record. Requires ADMIN or HR role.

### DELETE `/api/attendance/:id`

Delete an attendance record. Requires ADMIN or HR role.

---

## Payroll

### GET `/api/payroll`

List all payroll records with optional filtering.

**Query Parameters:** `employeeId`, `month` (YYYY-MM), `status`, `page`, `limit`

### POST `/api/payroll/process`

Process payroll for a given month. Auto-calculates from attendance data.

**Body:**
```json
{
  "month": "2026-01",
  "employeeIds": ["optional-filter"]
}
```

**Response:** `200 OK`
```json
{
  "message": "Payroll processed successfully",
  "processed": 25,
  "records": [{ "employeeId": "...", "basicSalary": 50000, "overtimePay": 5000, "tax": 5500, "netPay": 49500 }]
}
```

### GET `/api/payroll/payslip/:employeeId`

Export a payslip for an employee for a given month.

**Query Parameters:**
| Param | Type | Description |
|-------|------|-------------|
| `month` | string | YYYY-MM format (required) |
| `format` | string | `xlsx` or `pdf` (default: `pdf`) |

**Response:** Binary file download (2-page A4 payslip with attendance report).

### GET `/api/payroll/stats`

Get payroll statistics (total payroll, average salary, etc.).

### GET `/api/payroll/:id`

Get a single payroll record by ID.

### POST `/api/payroll`

Create a new payroll record manually.

### PUT `/api/payroll/:id`

Update a payroll record.

### DELETE `/api/payroll/:id`

Delete a payroll record.

---

## Leave

### GET `/api/leave`

List all leave requests. EMPLOYEE sees only own requests.

**Query Parameters:** `employeeId`, `status`, `leaveType`, `page`, `limit`

### POST `/api/leave`

Create a leave request.

**Body:**
```json
{
  "employeeId": "...",
  "leaveType": "CASUAL",
  "startDate": "2026-02-01",
  "endDate": "2026-02-03",
  "reason": "Family event"
}
```

### GET `/api/leave/stats`

Get leave statistics (pending/approved/rejected counts).

### GET `/api/leave/:id`

Get a single leave request.

### PUT `/api/leave/:id`

Update a leave request.

### DELETE `/api/leave/:id`

Delete a leave request.

### PATCH `/api/leave/:id/approve`

Approve a leave request. Requires MANAGER, HR, or ADMIN role.

### PATCH `/api/leave/:id/reject`

Reject a leave request. Requires MANAGER, HR, or ADMIN role.

---

## Shifts

### GET `/api/shifts`

List all shifts.

### POST `/api/shifts`

Create a new shift.

**Body:**
```json
{
  "name": "Morning Shift",
  "startTime": "09:00",
  "endTime": "17:00",
  "breakTime": 60,
  "description": "Standard morning shift",
  "isActive": true
}
```

### GET `/api/shifts/assignments`

List all shift assignments.

**Query Parameters:** `date`, `employeeId`, `shiftId`

### POST `/api/shifts/assignments`

Create a shift assignment.

**Body:**
```json
{
  "employeeId": "...",
  "shiftId": "...",
  "date": "2026-01-15",
  "notes": "Optional note"
}
```

### PUT `/api/shifts/assignments/:assignmentId`

Update a shift assignment.

### DELETE `/api/shifts/assignments/:assignmentId`

Delete a shift assignment.

### GET `/api/shifts/:id`

Get a single shift.

### PUT `/api/shifts/:id`

Update a shift.

### DELETE `/api/shifts/:id`

Delete a shift.

---

## Holidays

### GET `/api/holidays`

List all holidays.

**Query Parameters:** `year`, `month`

### POST `/api/holidays`

Create a single holiday.

**Body:**
```json
{
  "date": "2026-02-21",
  "name": "Language Martyrs' Day"
}
```

### POST `/api/holidays/bulk`

Bulk-create holidays.

**Body:**
```json
{
  "holidays": [
    { "date": "2026-02-21", "name": "Language Martyrs' Day" },
    { "date": "2026-03-26", "name": "Independence Day" }
  ]
}
```

### POST `/api/holidays/sync-google`

Sync holidays from Bangladesh government iCal feed. Auto-runs on server start and every 24h. Only imports administrative/government holidays; filters out academic and non-government observances.

### PUT `/api/holidays/:id`

Update a holiday.

### DELETE `/api/holidays/:id`

Delete a holiday.

---

## Devices

### GET `/api/devices`

List all registered biometric devices.

### POST `/api/devices`

Register a new biometric device.

**Body:**
```json
{
  "deviceId": "ZKT-001",
  "name": "Front Door Terminal",
  "ipAddress": "192.168.31.5",
  "port": 4370,
  "location": "Main Entrance"
}
```

### POST `/api/devices/sync`

Sync attendance records from the connected ZKT device.

### POST `/api/devices/clear-old-logs`

Clear attendance logs older than 180 days from the device.

### GET `/api/devices/users`

List users stored on the device.

### POST `/api/devices/users/sync-all`

Push all active employees to the device.

### POST `/api/devices/users/:employeeId/sync`

Push a single employee to the device.

### POST `/api/devices/users/:employeeId/enroll`

Enroll a fingerprint on the device.

**Body:**
```json
{
  "fingerIndex": 0,
  "timeoutMs": 30000
}
```

### DELETE `/api/devices/users/:uid`

Remove a user from the device by numeric UID.

### GET `/api/devices/:id`

Get a single device.

### PUT `/api/devices/:id`

Update device info.

### DELETE `/api/devices/:id`

Delete a device record.

### POST `/api/devices/:id/test`

Test connectivity to a device.

### GET `/api/devices/:id/logs`

Get logs for a device.

---

## Recruitment

### GET `/api/recruitment`

List all job postings.

### POST `/api/recruitment`

Create a new job posting.

**Body:**
```json
{
  "jobTitle": "Software Engineer",
  "departmentId": "...",
  "positionId": "...",
  "openings": 2,
  "description": "Full-stack developer role",
  "requirements": "3+ years experience",
  "responsibilities": "Build and maintain web applications",
  "location": "Dhaka",
  "employmentType": "FULL_TIME",
  "salaryRangeMin": 40000,
  "salaryRangeMax": 80000
}
```

### GET `/api/recruitment/:id`

Get a single job posting.

### PUT `/api/recruitment/:id`

Update a job posting.

### DELETE `/api/recruitment/:id`

Delete a job posting.

### GET `/api/recruitment/:recruitmentId/applicants`

List applicants for a job posting.

### POST `/api/recruitment/:recruitmentId/applicants`

Create/apply as an applicant.

**Body:**
```json
{
  "firstName": "Jane",
  "lastName": "Smith",
  "email": "jane@example.com",
  "phone": "+8801712345678",
  "education": [
    { "degree": "BSc", "institution": "BUET", "field": "CSE", "startYear": 2018, "endYear": 2022 }
  ],
  "address": "123 Main St",
  "city": "Dhaka",
  "coverLetter": "I am interested in this position..."
}
```

### PUT `/api/recruitment/:recruitmentId/applicants/:applicantId`

Update an applicant (status, notes, interviewedBy).

### DELETE `/api/recruitment/:recruitmentId/applicants/:applicantId`

Delete an applicant.

### POST `/api/recruitment/:recruitmentId/applicants/:applicantId/cv`

Upload applicant CV. Multipart form with `cv` field (PDF/JPG).

---

## Loans

### GET `/api/loans`

List all loans. EMPLOYEE sees only own loans.

**Query Parameters:** `employeeId`, `status`, `page`, `limit`

### GET `/api/loans/upcoming`

Get upcoming installments due in the next 30 days.

### GET `/api/loans/:id`

Get a single loan with installments.

### GET `/api/loans/:employeeId/summary`

Get loan summary for an employee (total borrowed, repaid, outstanding, overdue).

### GET `/api/loans/:loanId/installments`

Get installments for a specific loan.

### POST `/api/loans`

Create a new loan.

**Body:**
```json
{
  "employeeId": "...",
  "amount": 50000,
  "interestRate": 5,
  "purpose": "Medical emergency",
  "startDate": "2026-02-01",
  "installmentAmount": 5000,
  "installmentCount": 10,
  "frequency": "MONTHLY",
  "notes": "Optional notes"
}
```

### POST `/api/loans/:id/approve`

Approve a loan. Transitions PENDING → APPROVED.

### POST `/api/loans/:id/disburse`

Disburse an approved loan. Transitions APPROVED → ACTIVE.

### POST `/api/loans/:loanId/installments/:installmentId/pay`

Record a payment on an installment.

**Body:**
```json
{
  "amount": 5000,
  "payrollId": "optional-payroll-reference"
}
```

### POST `/api/loans/:id/cancel`

Cancel a loan and waive remaining installments.

---

## Festival Bonuses

### GET `/api/festival-bonuses`

List all festival bonuses.

**Query Parameters:** `year`, `employeeId`, `festivalType`, `status`, `page`, `limit`

### GET `/api/festival-bonuses/summary`

Get festival bonus summary for a year (counts/amounts by type and status).

**Query Parameters:** `year`

### GET `/api/festival-bonuses/:id`

Get a single festival bonus with employee details and installments.

### POST `/api/festival-bonuses`

Create a festival bonus.

**Body:**
```json
{
  "employeeId": "...",
  "festivalType": "EID_UL_FITR",
  "year": 2026,
  "bonusType": "BASIC_SALARY",
  "paymentMode": "ONE_TIME",
  "notes": "Optional notes"
}
```

### POST `/api/festival-bonuses/auto-generate`

Auto-generate bonuses for all eligible employees based on religion.

**Body:**
```json
{
  "year": 2026,
  "festivalType": "EID_UL_FITR",
  "bonusType": "BASIC_SALARY",
  "paymentMode": "TWO_INSTALLMENTS"
}
```

### POST `/api/festival-bonuses/:id/approve`

Approve a festival bonus. Transitions PENDING → APPROVED.

### POST `/api/festival-bonuses/:id/installment`

Mark an installment as paid.

**Body:**
```json
{
  "installmentNumber": 1
}
```

### POST `/api/festival-bonuses/:id/cancel`

Cancel a festival bonus.

### DELETE `/api/festival-bonuses/:id`

Delete a festival bonus (only if not PAID).

---

## Tasks

### GET `/api/tasks`

List all tasks.

**Query Parameters:** `status`, `category`, `assignedTo`, `page`, `limit`

### GET `/api/tasks/my`

Get the current user's own tasks.

### GET `/api/tasks/:id`

Get a single task.

### POST `/api/tasks`

Create a new task. Requires ADMIN, MANAGER, or HR role.

**Body:**
```json
{
  "title": "Review attendance policy",
  "description": "Update the attendance policy document",
  "priority": "HIGH",
  "assignedTo": "employee-id",
  "dueDate": "2026-02-01",
  "category": "HRM",
  "notes": "Urgent review needed"
}
```

### PUT `/api/tasks/:id`

Update a task.

### DELETE `/api/tasks/:id`

Delete a task. Requires ADMIN or MANAGER role.

---

## Announcements

### GET `/api/announcements`

List all active announcements.

### GET `/api/announcements/:id`

Get a single announcement.

### POST `/api/announcements`

Create an announcement. Requires ADMIN or HR role.

**Body:**
```json
{
  "title": "Office Holiday Notice",
  "content": "The office will remain closed on...",
  "priority": "HIGH",
  "startsAt": "2026-02-01T00:00:00.000Z",
  "expiresAt": "2026-02-02T23:59:59.999Z"
}
```

### PUT `/api/announcements/:id`

Update an announcement. Requires ADMIN or HR role.

### DELETE `/api/announcements/:id`

Delete an announcement. Requires ADMIN role only.

---

## Notifications

### GET `/api/notifications`

List all notifications for the current user.

### GET `/api/notifications/unread/count`

Get count of unread notifications.

### PATCH `/api/notifications/read-all`

Mark all notifications as read.

### GET `/api/notifications/:id`

Get a single notification.

### PATCH `/api/notifications/:id/read`

Mark a notification as read.

### DELETE `/api/notifications/:id`

Delete a notification.

---

## Dashboard

### GET `/api/dashboard`

Get dashboard summary data. Returns live data from the database.

**Response:** `200 OK`
```json
{
  "overview": {
    "totalEmployees": 50,
    "activeEmployees": 45,
    "presentToday": 38,
    "absentToday": 7,
    "netPayThisMonth": 2500000
  },
  "todayAttendance": {
    "expected": 45,
    "present": 38,
    "late": 3,
    "early": 1,
    "absent": 7
  },
  "attendanceTrend": [
    { "date": "2026-01-01", "present": 40, "late": 2, "absent": 3 }
  ],
  "statusDistribution": [
    { "status": "PRESENT", "count": 38 },
    { "status": "LATE", "count": 3 }
  ],
  "departmentBreakdown": [
    { "department": "Engineering", "total": 15, "present": 13 }
  ],
  "calendar": [
    { "date": "2026-01-15", "status": "present" }
  ],
  "recentAttendance": [...],
  "upcomingHolidays": [...]
}
```

---

## Settings

### GET `/api/settings`

Get all payroll/system settings.

**Response:** `200 OK`
```json
{
  "overtimeRate": 1.5,
  "overtimeRateRaw": 1.5,
  "overtimeRateMode": "DECIMAL",
  "holidayOvertimeRate": 2.0,
  "holidayOvertimeRateRaw": 2.0,
  "holidayOvertimeRateMode": "DECIMAL",
  "taxRate": 10,
  "workingDaysPerMonth": 26,
  "workingHoursPerDay": 9,
  "defaultWeeklyHoliday": "FRIDAY",
  "currency": "BDT",
  "errandDeductionMode": "SKIP",
  "earlyOvertimeMode": "INCLUDE"
}
```

### PUT `/api/settings`

Update payroll settings. Requires ADMIN role.

**Body:**
```json
{
  "overtimeRate": 1.5,
  "holidayOvertimeRate": 2.0,
  "taxRate": 10,
  "workingDaysPerMonth": 26,
  "workingHoursPerDay": 9,
  "defaultWeeklyHoliday": "FRIDAY",
  "currency": "BDT",
  "errandDeductionMode": "SKIP",
  "earlyOvertimeMode": "INCLUDE"
}
```

### GET `/api/settings/roles`

List all role assignments.

### PUT `/api/settings/roles`

Update an employee's role. Requires ADMIN role.

**Body:**
```json
{
  "employeeId": "...",
  "role": "HR"
}
```

---

## Error Responses

All endpoints return errors in this format:

```json
{
  "status": "fail",
  "message": "Descriptive error message",
  "errors": [
    { "field": "email", "message": "Email already exists" }
  ]
}
```

**HTTP Status Codes:**
| Code | Meaning |
|------|---------|
| `400` | Bad request / validation error |
| `401` | Unauthorized (missing or invalid token) |
| `403` | Forbidden (insufficient role permissions) |
| `404` | Resource not found |
| `429` | Rate limit exceeded (auth: 20 req/15min) |
| `500` | Internal server error |

---

## Rate Limiting

Auth endpoints (`/login`, `/register`, `/refresh-token`) are rate-limited to **20 requests per 15 minutes** per IP address. All other endpoints have no rate limit.

---

## File Uploads

Uploaded files are served from `/api/uploads/`. File types and limits:

| Upload Type | Allowed Formats | Max Size |
|-------------|----------------|----------|
| Profile image | JPG, PNG, WebP | 5 MB |
| Government ID | PDF, JPG, PNG, WebP | 10 MB |
| CV/Resume | PDF, JPG, PNG, WebP | 10 MB |
| Recruitment CV | PDF, JPG | 10 MB |

---

## WebSocket Events

Socket.IO is available on the same port as the HTTP server.

**Events:**
- `join-room` — Join a room for real-time updates
- `leave-room` — Leave a room
- `disconnect` — Client disconnect

Real-time attendance punches from ZKT devices are broadcast via Socket.IO to connected clients.
