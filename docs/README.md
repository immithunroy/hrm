# HRM Documentation Index

Comprehensive documentation for the HRM (Human Resource Management) application.

---

## Getting Started

New to the project? Start here:

1. **[README.md](../README.md)** — Project overview, features, quick start
2. **[Architecture](./ARCHITECTURE.md)** — System design, tech stack, key decisions
3. **[Deployment Guide](./DEPLOYMENT.md)** — Environment setup, Docker, CI/CD

---

## For Backend Developers

1. **[Backend Guide](./BACKEND.md)** — Project structure, patterns, adding endpoints
2. **[API Documentation](./API.md)** — Complete reference for all 107 REST endpoints
3. **[Database Schema](./DATABASE.md)** — All models, enums, relationships

---

## For Frontend Developers

1. **[Frontend Guide](./FRONTEND.md)** — Routing, components, styling, adding pages
2. **[API Documentation](./API.md)** — Backend API endpoints to integrate with

---

## Quick Reference

### Key Files

| File | Purpose |
|------|---------|
| `backend/src/server.ts` | Backend entry point — Express + Socket.IO |
| `backend/prisma/schema.prisma` | Database schema (737 lines) |
| `frontend/src/AppRoutes.tsx` | Frontend route definitions |
| `frontend/src/context/AuthContext.tsx` | Authentication state management |
| `frontend/src/services/api.ts` | HTTP client singleton |
| `docker-compose.yml` | Production deployment config |

### Environment Variables

| Variable | Where | Description |
|----------|-------|-------------|
| `DATABASE_URL` | backend | PostgreSQL connection string |
| `JWT_SECRET` | backend | Access token secret |
| `JWT_REFRESH_SECRET` | backend | Refresh token secret |
| `ZKT_DEVICE_IP` | backend | ZKTeco biometric device IP |
| `VITE_API_URL` | frontend | Backend API base URL |

### Common Commands

```bash
# Development
npm install                    # Install all dependencies
npm run dev                    # Start all dev servers

# Database
npx prisma db push             # Apply schema changes
npx prisma migrate dev         # Create migration
npx prisma studio              # Open DB GUI

# Production
docker compose up -d --build   # Build and deploy
docker compose logs backend    # View backend logs
docker compose restart backend # Restart backend

# Recompute attendance
docker compose exec backend node dist/scripts/recompute-attendance.js
```

### Test Accounts

| Email | Password | Role |
|-------|----------|------|
| admin@zkt.com | admin123 | ADMIN |
| arman@qbinternet.com | admin123 | ADMIN |
| mithun@qbinternet.com | admin123 | ADMIN |
| mithunroy@qbinternet.com | Mithunroy@21 | HR |

---

## File Count Summary

| Category | Files | Description |
|----------|-------|-------------|
| Backend routes | 16 | Express Router definitions |
| Backend controllers | 16 | Request handlers |
| Backend services | 7 | Business logic |
| Backend schemas | 11 | Zod validation |
| Backend middleware | 3 | Auth, rate limiting, validation |
| Frontend pages | 18 | React page components |
| Frontend components | 26 | Layout + UI primitives |
| Documentation | 7 | This docs directory |
| **Total source files** | **~70** | Backend + Frontend |
| **Total doc files** | **7** | README + 6 guides |
