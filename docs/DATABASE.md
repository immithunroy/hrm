# Database Schema Documentation

PostgreSQL database `zkt_payroll` with Prisma ORM.

---

## Overview

The HRM database contains 17 models and 25+ enums covering employees, attendance, payroll, leave, shifts, holidays, devices, recruitment, loans, festival bonuses, tasks, announcements, and notifications.

---

## Entity Relationship Diagram (Text)

```
Employee ──┬── Department
           ├── Position
           ├── Attendance[]        (1:N)
           ├── Payroll[]           (1:N)
           ├── LeaveRequest[]      (1:N)
           ├── LeaveBalance[]      (1:N, unique per year)
           ├── ShiftAssignment[]   (1:N)
           ├── Loan[]              (1:N)
           │     └── LoanInstallment[] (1:N)
           ├── FestivalBonus[]     (1:N)
           ├── Task[]              (1:N, as assignee)
           ├── Task[]              (1:N, as creator)
           ├── Announcement[]      (1:N, as author)
           ├── TrainingRecord[]    (1:N)
           └── PerformanceReview[] (1:N, as employee)

Department ──┬── Employee[]        (1:N)
             ├── Position[]        (1:N)
             └── Recruitment[]     (1:N)

Position ──┬── Employee[]          (1:N)
           └── Recruitment[]       (1:N)

Recruitment ──── Applicant[]       (1:N)

SystemSetting                       (key-value store)

Holiday                             (standalone, per day)

Device                              (standalone, ZKT hardware)

Notification                       (standalone, per recipient)
```

---

## Models

### Employee

Core model. Every person in the system is an Employee record.

| Field | Type | Required | Default | Description |
|-------|------|----------|---------|-------------|
| `id` | UUID | yes | auto | Primary key |
| `employeeId` | String | yes | — | Unique business ID (e.g., "EMP001") |
| `username` | String | no | — | Login username (unique) |
| `firstName` | String | yes | — | First name |
| `lastName` | String | yes | — | Last name |
| `middleName` | String | no | — | Middle name |
| `email` | String | yes | — | Unique email |
| `phone` | String | no | — | Phone number |
| `password` | String | no | — | Hashed bcrypt password |
| `dateOfBirth` | DateTime | no | — | Date of birth |
| `gender` | Gender enum | no | — | MALE, FEMALE, OTHER |
| `maritalStatus` | MaritalStatus enum | no | — | SINGLE, MARRIED, DIVORCED, WIDOWED |
| `hireDate` | DateTime | yes | — | Employment start date |
| `departmentId` | FK→Department | yes | — | Department reference |
| `positionId` | FK→Position | yes | — | Position reference |
| `employmentType` | EmploymentType enum | yes | — | FULL_TIME, PART_TIME, CONTRACT, INTERN, TEMPORARY |
| `status` | EmployeeStatus enum | no | ACTIVE | ACTIVE, INACTIVE, ON_LEAVE, TERMINATED, RESIGNED, RETIRED, SUSPENDED |
| `salary` | Decimal | no | 0 | Gross salary (used when salaryType=GROSS) |
| `salaryType` | String | no | "GROSS" | "GROSS" or "SCALED" |
| `basicScale` | Decimal | no | 0 | Basic scale (used when salaryType=SCALED) |
| `accommodationRate` | Decimal | no | 50 | % of basic for accommodation |
| `medicalRate` | Decimal | no | 25 | % of basic for medical |
| `transportRate` | Decimal | no | 15 | % of basic for transport |
| `mobileInternet` | Decimal | no | 0 | Fixed mobile/internet allowance |
| `bankAccountNumber` | String | no | — | Bank account |
| `bankName` | String | no | — | Bank name |
| `emergencyContactName` | String | no | — | Emergency contact name |
| `emergencyContactPhone` | String | no | — | Emergency contact phone |
| `address` | String | no | — | Street address |
| `city` | String | no | — | City |
| `state` | String | no | — | State/province |
| `zipCode` | String | no | — | Postal code |
| `country` | String | no | — | Country |
| `govtIdType` | GovtIdType enum | no | — | NID, DRIVING_LICENSE, PASSPORT |
| `govtIdNumber` | String | no | — | Government ID number |
| `profileImageUrl` | String | no | — | Photo path (/api/uploads/...) |
| `idDocumentUrl` | String | no | — | ID document path |
| `cvUrl` | String | no | — | CV/resume path |
| `employmentEndDate` | DateTime | no | — | End date if terminated/resigned/retired |
| `attendanceExempt` | Boolean | no | false | Exempt from attendance tracking |
| `payrollExempt` | Boolean | no | false | Exempt from payroll processing |
| `weeklyHoliday` | String | no | "FRIDAY" | Weekly holiday day name |
| `role` | String | no | "EMPLOYEE" | ADMIN, HR, MANAGER, FINANCE, EMPLOYEE |
| `pin` | String | no | — | ZKT device PIN (max 8 chars) |
| `deviceUid` | Int | no | — | ZKT device internal UID (1-3000) |
| `religion` | Religion enum | no | — | ISLAM, HINDU, BUDDHIST, CHRISTIAN, OTHER |

**Indexes:** `employeeId`, `username`, `email`, `(departmentId, positionId)`

---

### Department

| Field | Type | Required | Default | Description |
|-------|------|----------|---------|-------------|
| `id` | UUID | yes | auto | Primary key |
| `name` | String | yes | — | Unique department name |
| `description` | String | no | — | Department description |
| `code` | String | yes | — | Unique short code (e.g., "ENG") |
| `managerId` | FK→Employee | no | — | Department manager |
| `location` | String | no | — | Physical location |

---

### Position

| Field | Type | Required | Default | Description |
|-------|------|----------|---------|-------------|
| `id` | UUID | yes | auto | Primary key |
| `title` | String | yes | — | Position title |
| `description` | String | no | — | Position description |
| `departmentId` | FK→Department | yes | — | Parent department |
| `level` | PositionLevel enum | yes | — | ENTRY, ASSOCIATE, MID_LEVEL, SENIOR, LEAD, MANAGER, DIRECTOR, EXECUTIVE |
| `minSalary` | Decimal | yes | — | Minimum salary range |
| `maxSalary` | Decimal | yes | — | Maximum salary range |

---

### Attendance

Daily attendance record per employee. Created by ZKT biometric punches or manual admin entry.

| Field | Type | Required | Default | Description |
|-------|------|----------|---------|-------------|
| `id` | UUID | yes | auto | Primary key |
| `employeeId` | FK→Employee | yes | — | Employee reference |
| `checkIn` | DateTime | no | — | First punch of the day |
| `checkOut` | DateTime | no | — | Last punch of the day |
| `date` | DateTime | no | now | Calendar date |
| `status` | AttendanceStatus enum | yes | — | PRESENT, ABSENT, LATE, EARLY, LEAVE, HOLIDAY, HALF, WEEKEND |
| `workHours` | Float | no | — | Hours worked |
| `overtimeHours` | Float | no | — | Regular overtime hours |
| `earlyOvertimeHours` | Float | no | — | Early arrival overtime hours |
| `lateMinutes` | Int | no | — | Minutes late past shift start |
| `earlyDepartureMinutes` | Int | no | — | Minutes before shift end |
| `punches` | JSON | no | — | Raw punch timestamps array |
| `autoCheckOut` | Boolean | no | false | Auto-signed-out at 04:00 |
| `breakMinutes` | Int | no | — | Personal errand break time |
| `errandCount` | Int | no | — | Number of out/in trips |
| `deviceId` | String | no | — | ZKT device ID |
| `deviceLogId` | String | no | — | Original device log ID |

**Indexes:** `(employeeId, date)`, `date`, `deviceId`, `deviceLogId`

---

### LeaveBalance

Per-employee annual leave balance tracking.

| Field | Type | Required | Default | Description |
|-------|------|----------|---------|-------------|
| `id` | UUID | yes | auto | Primary key |
| `employeeId` | FK→Employee | yes | — | Employee reference |
| `year` | Int | yes | — | Calendar year |
| `casualTotal` | Int | no | 0 | Total casual leave days |
| `casualUsed` | Int | no | 0 | Casual leave days used |
| `medicalTotal` | Int | no | 0 | Total medical leave days |
| `medicalUsed` | Int | no | 0 | Medical leave days used |

**Unique constraint:** `(employeeId, year)`

---

### Payroll

Monthly payroll record per employee.

| Field | Type | Required | Default | Description |
|-------|------|----------|---------|-------------|
| `id` | UUID | yes | auto | Primary key |
| `employeeId` | FK→Employee | yes | — | Employee reference |
| `payPeriodStart` | DateTime | yes | — | Period start |
| `payPeriodEnd` | DateTime | yes | — | Period end |
| `basicSalary` | Decimal | yes | — | Base salary for the period |
| `overtimePay` | Decimal | yes | — | Overtime pay amount |
| `bonus` | Decimal | yes | — | Bonus amount |
| `deductions` | Decimal | yes | — | Total deductions |
| `tax` | Decimal | yes | — | Tax amount |
| `netPay` | Decimal | yes | — | Final net pay |
| `paymentDate` | DateTime | yes | — | Payment date |
| `status` | PaymentStatus enum | yes | — | PENDING, PROCESSED, PAID, APPROVED, FAILED, CANCELLED |
| `paymentMethod` | PaymentMethod enum | no | — | BANK_TRANSFER, CHECK, CASH, MOBILE_MONEY |
| `transactionId` | String | no | — | Payment transaction reference |
| `notes` | String | no | — | Additional notes |

---

### LeaveRequest

| Field | Type | Required | Default | Description |
|-------|------|----------|---------|-------------|
| `id` | UUID | yes | auto | Primary key |
| `employeeId` | FK→Employee | yes | — | Employee reference |
| `leaveType` | LeaveType enum | yes | — | VACATION, CASUAL, SICK, MEDICAL, PERSONAL, MATERNITY, PATERNITY, BEREAVEMENT, JURY_DUTY, MILITARY, UNPAID |
| `startDate` | DateTime | yes | — | Leave start date |
| `endDate` | DateTime | yes | — | Leave end date |
| `daysRequested` | Int | yes | — | Number of days |
| `reason` | String | yes | — | Reason for leave |
| `status` | LeaveRequestStatus enum | no | PENDING | PENDING, APPROVED, REJECTED, CANCELLED |
| `approvedBy` | String | no | — | Approver employee ID |
| `approvedAt` | DateTime | no | — | Approval timestamp |

---

### Shift

| Field | Type | Required | Default | Description |
|-------|------|----------|---------|-------------|
| `id` | UUID | yes | auto | Primary key |
| `name` | String | yes | — | Shift name |
| `description` | String | no | — | Shift description |
| `startTime` | String | yes | — | Start time (HH:mm) |
| `endTime` | String | yes | — | End time (HH:mm) |
| `breakTime` | Int | no | — | Break duration in minutes |
| `isActive` | Boolean | no | true | Whether this is the active shift |

---

### ShiftAssignment

| Field | Type | Required | Default | Description |
|-------|------|----------|---------|-------------|
| `id` | UUID | yes | auto | Primary key |
| `employeeId` | FK→Employee | yes | — | Employee reference |
| `shiftId` | FK→Shift | yes | — | Shift reference |
| `date` | DateTime | yes | — | Assignment date |
| `assignedBy` | String | no | — | Manager ID |
| `notes` | String | no | — | Assignment notes |

---

### Recruitment

Job posting for open positions.

| Field | Type | Required | Default | Description |
|-------|------|----------|---------|-------------|
| `id` | UUID | yes | auto | Primary key |
| `positionId` | FK→Position | yes | — | Position reference |
| `jobTitle` | String | yes | — | Job title |
| `departmentId` | FK→Department | yes | — | Department |
| `openings` | Int | yes | — | Number of openings |
| `status` | RecruitmentStatus enum | no | OPEN | OPEN, CLOSED, ON_HOLD, CANCELLED |
| `description` | String | no | — | Job description |
| `requirements` | String | no | — | Job requirements |
| `responsibilities` | String | no | — | Job responsibilities |
| `location` | String | no | — | Work location |
| `employmentType` | EmploymentType enum | yes | — | Employment type |
| `salaryRangeMin` | Decimal | no | — | Minimum salary range |
| `salaryRangeMax` | Decimal | no | — | Maximum salary range |
| `postedDate` | DateTime | no | now | When posted |
| `closingDate` | DateTime | no | — | Application deadline |

---

### Applicant

Job applicant linked to a Recruitment posting.

| Field | Type | Required | Default | Description |
|-------|------|----------|---------|-------------|
| `id` | UUID | yes | auto | Primary key |
| `recruitmentId` | FK→Recruitment | yes | — | Job posting reference |
| `firstName` | String | yes | — | First name |
| `lastName` | String | yes | — | Last name |
| `email` | String | yes | — | Email |
| `phone` | String | no | — | Phone |
| `education` | JSON | no | — | Array of {degree, institution, field, startYear, endYear} |
| `address` | String | no | — | Street address |
| `city` | String | no | — | City |
| `state` | String | no | — | State |
| `zipCode` | String | no | — | Postal code |
| `country` | String | no | — | Country |
| `resumeUrl` | String | no | — | External resume URL |
| `cvUrl` | String | no | — | Uploaded CV path |
| `coverLetter` | String | no | — | Cover letter text |
| `status` | ApplicationStatus enum | no | NEW | NEW, REVIEWED, INTERVIEWED, OFFERED, HIRED, REJECTED |
| `notes` | String | no | — | Admin notes |
| `interviewedBy` | String | no | — | Interviewer employee ID |

---

### Loan

Employee loan tracking with installment payments.

| Field | Type | Required | Default | Description |
|-------|------|----------|---------|-------------|
| `id` | UUID | yes | auto | Primary key |
| `employeeId` | FK→Employee | yes | — | Employee reference |
| `amount` | Decimal | yes | — | Principal loan amount |
| `interestRate` | Decimal | no | 0 | Annual interest rate (%) |
| `totalAmount` | Decimal | yes | — | Principal + interest |
| `remainingAmount` | Decimal | yes | — | Outstanding balance |
| `status` | LoanStatus enum | no | PENDING | PENDING, APPROVED, ACTIVE, COMPLETED, DEFAULTED, CANCELLED |
| `purpose` | String | no | — | Loan purpose |
| `approvedBy` | String | no | — | Approver ID |
| `approvedAt` | DateTime | no | — | Approval timestamp |
| `disbursedAt` | DateTime | no | — | Disbursement timestamp |
| `startDate` | DateTime | yes | — | Repayment start date |
| `endDate` | DateTime | no | — | Expected end date |
| `installmentAmount` | Decimal | no | — | Fixed installment amount |
| `installmentCount` | Int | no | — | Total number of installments |
| `frequency` | LoanFrequency enum | no | MONTHLY | WEEKLY, BIWEEKLY, MONTHLY, QUARTERLY |

---

### LoanInstallment

| Field | Type | Required | Default | Description |
|-------|------|----------|---------|-------------|
| `id` | UUID | yes | auto | Primary key |
| `loanId` | FK→Loan | yes | — | Loan reference (cascade delete) |
| `dueDate` | DateTime | yes | — | Payment due date |
| `amount` | Decimal | yes | — | Amount due |
| `paidAmount` | Decimal | no | 0 | Amount paid |
| `status` | InstallmentStatus enum | no | PENDING | PENDING, PAID, PARTIAL, OVERDUE, WAIVED |
| `paidAt` | DateTime | no | — | Payment timestamp |
| `payrollId` | String | no | — | Payroll deduction reference |

---

### Holiday

Company/government holidays (one row per day).

| Field | Type | Required | Default | Description |
|-------|------|----------|---------|-------------|
| `id` | UUID | yes | auto | Primary key |
| `date` | DateTime | yes | — | Unique holiday date (Dhaka midnight UTC) |
| `name` | String | yes | — | Holiday name |
| `year` | Int | yes | — | Year (for indexing) |
| `month` | Int | yes | — | Month (for indexing) |

---

### SystemSetting

Key-value store for payroll rules and system configuration.

| Field | Type | Required | Default | Description |
|-------|------|----------|---------|-------------|
| `key` | String | yes | — | Setting key (primary key) |
| `value` | String | yes | — | Setting value (stored as string) |
| `updatedAt` | DateTime | auto | now | Last update |

**Known keys:** `overtimeRate`, `holidayOvertimeRate`, `taxRate`, `workingDaysPerMonth`, `workingHoursPerDay`, `defaultWeeklyHoliday`, `currency`, `errandDeductionMode`, `earlyOvertimeMode`

---

### Task

| Field | Type | Required | Default | Description |
|-------|------|----------|---------|-------------|
| `id` | UUID | yes | auto | Primary key |
| `title` | String | yes | — | Task title |
| `description` | String | no | — | Task description |
| `status` | TaskStatus enum | no | PENDING | PENDING, IN_PROGRESS, COMPLETED, CANCELLED |
| `priority` | TaskPriority enum | no | MEDIUM | LOW, MEDIUM, HIGH, URGENT |
| `assignedTo` | FK→Employee | no | — | Assignee |
| `createdBy` | FK→Employee | no | — | Creator |
| `dueDate` | DateTime | no | — | Due date |
| `completedAt` | DateTime | no | — | Completion timestamp |
| `category` | String | no | — | HRM, CUSTOMER, NETWORK, FIELD |
| `relatedId` | String | no | — | Reference to related entity |
| `relatedType` | String | no | — | Type of related entity |

---

### Announcement

| Field | Type | Required | Default | Description |
|-------|------|----------|---------|-------------|
| `id` | UUID | yes | auto | Primary key |
| `title` | String | yes | — | Announcement title |
| `content` | String | yes | — | Announcement content |
| `priority` | AnnouncementPriority enum | no | NORMAL | LOW, NORMAL, HIGH, URGENT |
| `authorId` | FK→Employee | no | — | Author |
| `isActive` | Boolean | no | true | Whether visible |
| `startsAt` | DateTime | no | — | Display start |
| `expiresAt` | DateTime | no | — | Display end |

---

### Notification

| Field | Type | Required | Default | Description |
|-------|------|----------|---------|-------------|
| `id` | UUID | yes | auto | Primary key |
| `recipientId` | String | yes | — | Employee ID of recipient |
| `title` | String | yes | — | Notification title |
| `message` | String | yes | — | Notification message |
| `type` | NotificationType enum | yes | — | INFO, WARNING, ERROR, SUCCESS, LEAVE_REQUEST, SHIFT_CHANGE, PAYROLL_READY, PERFORMANCE_REVIEW, TRAINING_REMINDER |
| `isRead` | Boolean | no | false | Read status |
| `relatedId` | String | no | — | Reference to related entity |
| `relatedType` | String | no | — | Type of related entity |

---

### TrainingRecord

| Field | Type | Required | Default | Description |
|-------|------|----------|---------|-------------|
| `id` | UUID | yes | auto | Primary key |
| `employeeId` | FK→Employee | yes | — | Employee reference |
| `trainingTitle` | String | yes | — | Training title |
| `trainingType` | String | yes | — | Training type |
| `provider` | String | no | — | Training provider |
| `startDate` | DateTime | yes | — | Start date |
| `endDate` | DateTime | no | — | End date |
| `hours` | Int | no | — | Training hours |
| `cost` | Decimal | no | — | Training cost |
| `certificateUrl` | String | no | — | Certificate file path |
| `status` | TrainingStatus enum | no | COMPLETED | SCHEDULED, IN_PROGRESS, COMPLETED, FAILED, CANCELLED |

---

### PerformanceReview

| Field | Type | Required | Default | Description |
|-------|------|----------|---------|-------------|
| `id` | UUID | yes | auto | Primary key |
| `employeeId` | FK→Employee | yes | — | Employee being reviewed |
| `reviewerId` | FK→Employee | yes | — | Reviewer (manager) |
| `reviewPeriod` | String | yes | — | e.g., "Q1 2026", "Annual 2025" |
| `reviewDate` | DateTime | yes | — | Review date |
| `rating` | Int | yes | — | 1-5 scale |
| `strengths` | String | no | — | Strengths |
| `areasForImprovement` | String | no | — | Areas for improvement |
| `goals` | String | no | — | Goals |
| `comments` | String | no | — | Additional comments |

---

### Device

ZKTeco biometric device registration.

| Field | Type | Required | Default | Description |
|-------|------|----------|---------|-------------|
| `id` | UUID | yes | auto | Primary key |
| `deviceId` | String | yes | — | Unique device identifier |
| `name` | String | yes | — | Device name |
| `ipAddress` | String | yes | — | IP address |
| `port` | Int | no | 4370 | TCP/UDP port |
| `location` | String | no | — | Physical location |
| `description` | String | no | — | Device description |
| `isActive` | Boolean | no | true | Active status |
| `lastSeen` | DateTime | no | — | Last communication |
| `totalUsers` | Int | no | 0 | Users registered on device |
| `totalLogs` | Int | no | 0 | Total log entries |

---

### FestivalBonus

Festival bonus tracking for employees (Eid, etc.).

| Field | Type | Required | Default | Description |
|-------|------|----------|---------|-------------|
| `id` | UUID | yes | auto | Primary key |
| `employeeId` | FK→Employee | yes | — | Employee reference |
| `festivalType` | FestivalBonusType enum | yes | — | EID_UL_FITR, EID_UL_ADHA, OTHER |
| `customFestivalName` | String | no | — | Custom name for OTHER type |
| `year` | Int | yes | — | Bonus year |
| `bonusType` | BonusCalculationType enum | no | BASIC_SALARY | BASIC_SALARY (2x) or GROSS_SALARY (1x) |
| `totalAmount` | Decimal | yes | — | Total bonus amount |
| `paymentMode` | BonusPaymentMode enum | no | ONE_TIME | ONE_TIME or TWO_INSTALLMENTS |
| `installment1Amount` | Decimal | no | — | First installment amount |
| `installment1Date` | DateTime | no | — | First installment date |
| `installment1Status` | BonusInstallmentStatus | no | PENDING | PENDING, PAID, CANCELLED |
| `installment2Amount` | Decimal | no | — | Second installment amount |
| `installment2Date` | DateTime | no | — | Second installment date |
| `installment2Status` | BonusInstallmentStatus | no | PENDING | PENDING, PAID, CANCELLED |
| `status` | PaymentStatus enum | no | PENDING | PENDING, PROCESSED, PAID, etc. |
| `approvedBy` | String | no | — | Approver ID |
| `approvedAt` | DateTime | no | — | Approval timestamp |

---

## Enums Reference

| Enum | Values |
|------|--------|
| `Gender` | MALE, FEMALE, OTHER |
| `MaritalStatus` | SINGLE, MARRIED, DIVORCED, WIDOWED |
| `EmploymentType` | FULL_TIME, PART_TIME, CONTRACT, INTERN, TEMPORARY |
| `EmployeeStatus` | ACTIVE, INACTIVE, ON_LEAVE, TERMINATED, RESIGNED, RETIRED, SUSPENDED |
| `GovtIdType` | NID, DRIVING_LICENSE, PASSPORT |
| `PositionLevel` | ENTRY, ASSOCIATE, MID_LEVEL, SENIOR, LEAD, MANAGER, DIRECTOR, EXECUTIVE |
| `AttendanceStatus` | PRESENT, ABSENT, LATE, EARLY, LEAVE, HOLIDAY, HALF, WEEKEND |
| `PaymentStatus` | PENDING, PROCESSED, PAID, APPROVED, FAILED, CANCELLED |
| `PaymentMethod` | BANK_TRANSFER, CHECK, CASH, MOBILE_MONEY |
| `LeaveType` | VACATION, CASUAL, SICK, MEDICAL, PERSONAL, MATERNITY, PATERNITY, BEREAVEMENT, JURY_DUTY, MILITARY, UNPAID |
| `LeaveRequestStatus` | PENDING, APPROVED, REJECTED, CANCELLED |
| `RecruitmentStatus` | OPEN, CLOSED, ON_HOLD, CANCELLED |
| `ApplicationStatus` | NEW, REVIEWED, INTERVIEWED, OFFERED, HIRED, REJECTED |
| `TrainingStatus` | SCHEDULED, IN_PROGRESS, COMPLETED, FAILED, CANCELLED |
| `NotificationType` | INFO, WARNING, ERROR, SUCCESS, LEAVE_REQUEST, SHIFT_CHANGE, PAYROLL_READY, PERFORMANCE_REVIEW, TRAINING_REMINDER |
| `TaskStatus` | PENDING, IN_PROGRESS, COMPLETED, CANCELLED |
| `TaskPriority` | LOW, MEDIUM, HIGH, URGENT |
| `AnnouncementPriority` | LOW, NORMAL, HIGH, URGENT |
| `Religion` | ISLAM, HINDU, BUDDHIST, CHRISTIAN, OTHER |
| `FestivalBonusType` | EID_UL_FITR, EID_UL_ADHA, OTHER |
| `BonusCalculationType` | BASIC_SALARY, GROSS_SALARY |
| `BonusPaymentMode` | ONE_TIME, TWO_INSTALLMENTS |
| `BonusInstallmentStatus` | PENDING, PAID, CANCELLED |
| `LoanStatus` | PENDING, APPROVED, ACTIVE, COMPLETED, DEFAULTED, CANCELLED |
| `LoanFrequency` | WEEKLY, BIWEEKLY, MONTHLY, QUARTERLY |
| `InstallmentStatus` | PENDING, PAID, PARTIAL, OVERDUE, WAIVED |
