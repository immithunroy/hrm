# Deployment Guide

Production deployment and environment configuration.

---

## Quick Start (Development)

```bash
# Clone and install
git clone <repo-url> hrm
cd hrm
npm install

# Set up environment
cp backend/.env.example backend/.env
cp frontend/.env.example frontend/.env
# Edit .env files with your config

# Initialize database
npm run prisma:setup

# Start all services
npm run dev
```

**Development URLs:**
- Frontend: http://localhost:8060
- Backend API: http://localhost:5000/api
- Database: localhost:5432

---

## Environment Variables

### Backend `.env`

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `DATABASE_URL` | yes | — | PostgreSQL connection string |
| `JWT_SECRET` | yes | — | Access token secret |
| `JWT_REFRESH_SECRET` | yes | — | Refresh token secret |
| `PORT` | no | 5000 | Server port |
| `NODE_ENV` | no | development | `development` or `production` |
| `ZKT_DEVICE_IP` | no | 192.168.31.5 | ZKTeco device IP |
| `ZKT_DEVICE_PORT` | no | 4370 | ZKTeco device port |
| `ZKT_DEVICE_TIMEOUT` | no | 5000 | Connection timeout (ms) |
| `ZKT_DEVICE_USERNAME` | no | — | Device username (if auth required) |
| `ZKT_DEVICE_PASSWD` | no | — | Device password |
| `CORS_ORIGIN` | no | http://localhost:8060 | Allowed CORS origins |
| `TZ` | no | Asia/Dhaka | Timezone |

**Example `.env`:**
```env
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/zkt_payroll?schema=public
JWT_SECRET=your-super-secret-key-here
JWT_REFRESH_SECRET=your-refresh-secret-key-here
PORT=5000
NODE_ENV=development
ZKT_DEVICE_IP=192.168.31.5
ZKT_DEVICE_PORT=4370
CORS_ORIGIN=http://localhost:8060,http://127.0.0.1:8060
TZ=Asia/Dhaka
```

### Frontend `.env`

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `VITE_API_URL` | no | http://localhost:5000/api | Backend API base URL |

---

## Docker Deployment

### Prerequisites
- Docker Engine 20.10+
- Docker Compose v2+
- Git

### Production Deployment

```bash
# Clone the repository
git clone <repo-url> /opt/hrm
cd /opt/hrm

# Set environment variables
export JWT_SECRET=your-production-secret
export JWT_REFRESH_SECRET=your-production-refresh-secret
export ZKT_DEVICE_IP=192.168.31.5
export CORS_ORIGIN=http://103.177.54.6:8060

# Build and start
docker compose up -d --build
```

### Docker Compose Services

| Service | Image | Port | Description |
|---------|-------|------|-------------|
| `db` | postgres:16-alpine | 5432 (internal) | PostgreSQL database |
| `backend` | Custom (./backend) | 5000 (internal) | Express API server |
| `frontend` | Custom (./frontend) | 8060:80 | nginx serving React app |

### Volumes

| Volume | Purpose |
|--------|---------|
| `pgdata` | PostgreSQL data persistence |
| `uploads` | Employee documents, CVs, profile images |

### Database Auto-Migration

The backend automatically runs `npx prisma db push --skip-generate --accept-data-loss` on every start. This applies schema changes without manual migration steps.

### Health Checks

- **Backend:** `GET /health` returns `{ status: 'OK', timestamp, service: 'HRM & Payroll' }`
- **Database:** PostgreSQL `pg_isready` check with 5s interval, 10 retries

---

## CI/CD Pipeline

### GitHub Actions Workflow

Triggered on push to `main` branch:

1. **SSH into production server** (`root@103.177.54.6`)
2. **Pull latest code:** `cd /opt/hrm && git pull`
3. **Build containers:** `docker compose build backend frontend`
4. **Restart services:** `docker compose up -d`

### Manual Deployment

```bash
# SSH into server
ssh root@103.177.54.6

# Navigate to app directory
cd /opt/hrm

# Pull latest changes
git pull

# Rebuild and restart
docker compose up -d --build
```

### Rollback

```bash
# Check recent commits
git log --oneline -10

# Revert to specific commit
git checkout <commit-hash>

# Rebuild
docker compose up -d --build
```

---

## Production Server

### Server Details
- **IP:** 103.177.54.6
- **OS:** Linux (Ubuntu/Debian)
- **App Directory:** `/opt/hrm/`
- **Port:** 8060 (exposed via nginx)
- **Docker Compose Project Name:** `hrm`

### Other Services on Server
- nginx-proxy-manager (SSL termination)
- portainer (Docker management)
- librenms (network monitoring)
- akaunting (accounting)
- invoiceshelf (invoicing)
- gps-tracker (GPS tracking)
- upstream, outage, freshrss, isp-erp, rustdesk

**Important:** Do not touch other services when deploying HRM.

### Database Credentials
- **Database:** `zkt_payroll`
- **User:** `postgres`
- **Password:** `postgres`
- **Container:** `hrm-db-1`

---

## Prisma Commands

```bash
# Run via Docker
docker compose exec backend npx prisma <command>

# Generate Prisma client
npx prisma generate

# Push schema changes (auto-runs on startup)
npx prisma db push --skip-generate

# Create a migration
npx prisma migrate dev --name <migration-name>

# Apply pending migrations
npx prisma migrate deploy

# Reset database (DESTRUCTIVE)
npx prisma migrate reset

# Open Prisma Studio (GUI)
npx prisma studio

# Seed database
npx prisma db seed
```

---

## Recomputing Attendance

After changing payroll rules or shift configurations, recompute all attendance records:

```bash
# Via Docker
docker compose exec backend node dist/scripts/recompute-attendance.js

# Or via API (triggers full recomputation)
POST /api/attendance/sync
```

This recalculates `workHours`, `overtimeHours`, `earlyOvertimeHours`, late minutes, early departure, and status for every stored attendance record using the current shift rules.

---

## Backup & Recovery

### Database Backup

```bash
# Backup
docker compose exec db pg_dump -U postgres zkt_payroll > backup.sql

# Restore
cat backup.sql | docker compose exec -T db psql -U postgres zkt_payroll
```

### Uploads Backup

```bash
# Backup uploads volume
docker run --rm -v hrm_uploads:/data -v $(pwd):/backup alpine tar czf /backup/uploads.tar.gz /data

# Restore uploads volume
docker run --rm -v hrm_uploads:/data -v $(pwd):/backup alpine tar xzf /backup/uploads.tar.gz -C /
```

---

## Troubleshooting

### ZKT Device Not Connecting

1. Verify device IP: `ping 192.168.31.5`
2. Check port is open: `telnet 192.168.31.5 4370`
3. Ensure no other scripts are using the device connection
4. Check logs: `docker compose logs backend | grep -i zkt`
5. Restart backend: `docker compose restart backend`

### Database Connection Issues

1. Check PostgreSQL is running: `docker compose ps db`
2. Verify credentials in `.env`
3. Check logs: `docker compose logs db`
4. Test connection: `docker compose exec db psql -U postgres zkt_payroll`

### Frontend Not Loading

1. Check nginx is running: `docker compose ps frontend`
2. Verify API proxy: `curl http://localhost:8060/api/health`
3. Check logs: `docker compose logs frontend`

### Build Failures

```bash
# Clean rebuild
docker compose down
docker compose build --no-cache
docker compose up -d
```

---

## Test Accounts

| Account | Email | Password | Role |
|---------|-------|----------|------|
| Admin | admin@zkt.com | admin123 | ADMIN |
| Arman | arman@qbinternet.com | admin123 | ADMIN |
| Mithun Roy | mithun@qbinternet.com | admin123 | ADMIN |
| Mithun Roy (HR) | mithunroy@qbinternet.com | Mithunroy@21 | HR |

**Payroll-exempt accounts:** admin@zkt.com, arman@qbinternet.com, mithun@qbinternet.com
