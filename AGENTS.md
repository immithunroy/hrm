# HRM App Agent Instructions

## CRITICAL RULES

### Deployment
- **ONLY push to GitHub `main` branch** — CI/CD auto-deploys to production
- **NEVER SSH to production server** for deployment
- **NEVER run `docker compose` commands on server directly**
- GitHub Actions handles: `git pull` → `docker compose build` → `docker compose up -d`

### PowerShell (Local)
- No `&&` chaining — use `cmd1; if ($?) { cmd2 }` or separate calls
- No heredocs — use Python scripts or temp files
- Use `workdir` parameter instead of `Set-Location` inside commands
- All commands run in `C:\projects\hrm`

### Server (Production)
- Server: `root@103.177.54.6`
- App dir: `/opt/hrm/`
- Port: 8060
- Docker Compose project name: `hrm`
- Other services running: nginx-proxy-manager, portainer, librenms, akaunting, invoiceshelf, gps-tracker, upstream, outage, freshrss, isp-erp, rustdesk
- **Do not touch other services**

### Database
- PostgreSQL: `zkt_payroll`, user `postgres`, password `postgres`
- Container: `hrm-db-1`
- Run prisma commands via: `docker compose exec backend npx prisma <command>`

### Code Conventions
- Backend: Express + TypeScript + Prisma
- Frontend: React + TypeScript + Vite + TailwindCSS + shadcn/ui
- Backend path: `C:\projects\hrm\backend\`
- Frontend path: `C:\projects\hrm\frontend\`

### Test Accounts
- Admin: `admin@zkt.com` / `admin123`
- Arman: `arman@qbinternet.com` / `admin123`
- Mithun Chandra Roy: `mithun@qbinternet.com` / `admin123`
- Mithun Roy (HR): `mithunroy@qbinternet.com` / `Mithunroy@21`

### Important Patterns
- `authorizeOrSelf()` middleware: `req.params.id === req.userId` OR user has allowed role
- Self-edit restricted to EMPLOYEE role only (ADMIN/HR can self-edit)
- Payroll exempt accounts: admin@zkt.com, arman@qbinternet.com, mithun@qbinternet.com
- Sensitive fields (salary, bank, taxId) stripped for EMPLOYEE role
- Leaves/Payroll/Loans/FestivalBonus: EMPLOYEE sees only own data

### Architecture
- Backend port: 5000 (internal)
- Frontend port: 8060 (exposed)
- Database port: 5432 (internal)
- Redis: None (removed)
- CORS_ORIGIN: http://localhost:8060,http://127.0.0.1:8060,http://103.177.54.6:8060

### Documentation
- `docs/API.md` — Complete API reference (107 endpoints)
- `docs/DATABASE.md` — Database schema documentation (17 models, 25+ enums)
- `docs/ARCHITECTURE.md` — System design and key decisions
- `docs/BACKEND.md` — Backend developer guide
- `docs/FRONTEND.md` — Frontend developer guide
- `docs/DEPLOYMENT.md` — Deployment and operations guide

### Code Conventions (Backend)
- Follow Routes → Controllers → Services pattern
- Use Zod for all input validation
- Use Prisma for all database access (no raw SQL)
- Use `async/await` with `try/catch` in controllers
- Use `AppError` class for operational errors
- Use `authenticateToken` + `authorize`/`authorizeOrSelf` middleware for auth
- All timestamps in Asia/Dhaka timezone (UTC+6)
- Work day boundary: 04:00 to next day 04:00 (not midnight)
- No comments in code unless requested

### Code Conventions (Frontend)
- Functional components with React hooks
- TypeScript for all components and props
- Tailwind CSS for all styling (no CSS modules)
- shadcn/ui components from `components/ui/`
- `useAuth()` for authentication state
- `api` singleton for all HTTP requests
- Format dates with `lib/format.ts` utilities
- Status colors from `lib/colors.ts`
- No comments in code unless requested
