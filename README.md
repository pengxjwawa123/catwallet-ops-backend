# CatWallet Ops Backend

Production-grade NestJS operations backend for CatWallet — provides admin authentication, RBAC, audit logging, feature flags, remote config, announcements, and background job tracking.

## Tech Stack

| Layer | Choice |
|---|---|
| Runtime | Node 22 / TypeScript 5 |
| Framework | NestJS 10 |
| ORM | Prisma 5 + PostgreSQL 16 |
| Cache / Queue | Redis 7 |
| Auth | JWT (argon2 password hashing) |
| Validation | class-validator + Zod |
| Logging | nestjs-pino (structured JSON) |
| Docs | Swagger / OpenAPI (`/docs`) |
| Health | @nestjs/terminus (`/health`) |

## Quick Start

### 1. Start infrastructure

```bash
docker compose up -d
# postgres:5432 and redis:6379 are now running with healthchecks
```

### 2. Install dependencies

```bash
npm install
```

### 3. Configure environment

```bash
cp .env.example .env
# Edit .env — at minimum set JWT_SECRET to a strong random value
```

### 4. Run database migrations

```bash
npm run prisma:migrate:dev
```

### 5. Start the dev server

```bash
npm run start:dev
# API: http://localhost:3000
# Swagger: http://localhost:3000/docs
# Health: http://localhost:3000/health
```

## Available Scripts

| Script | Description |
|---|---|
| `npm run start:dev` | Start with hot-reload (development) |
| `npm run build` | Compile TypeScript to `dist/` |
| `npm start` | Start compiled production build |
| `npm run lint` | ESLint with auto-fix |
| `npm run typecheck` | TypeScript type-check (no emit) |
| `npm test` | Jest unit tests |
| `npm run test:e2e` | Jest e2e tests |
| `npm run prisma:generate` | Regenerate Prisma client |
| `npm run prisma:migrate` | Run `migrate deploy` (production) |
| `npm run prisma:migrate:dev` | Run `migrate dev` (development) |
| `npm run prisma:validate` | Validate Prisma schema |

## Project Structure

```
catwallet-ops-backend/
├── apps/api/src/
│   ├── config/          # Env validation (class-validator)
│   ├── common/          # Shared filters, interceptors, DTOs
│   ├── health/          # /health endpoint (terminus)
│   └── prisma/          # PrismaService + PrismaModule
├── prisma/
│   ├── schema.prisma    # Data model
│   └── migrations/      # Migration history
├── docker-compose.yml   # Local postgres + redis
├── Dockerfile           # Multi-stage production image
├── .env.example         # Environment variable template
└── .github/workflows/
    └── ci.yml           # GitHub Actions CI pipeline
```

## API Endpoints

| Path | Description |
|---|---|
| `GET /health` | Liveness / readiness probe (postgres + redis) |
| `GET /docs` | Swagger UI (OpenAPI 3) |

## Environment Variables

See `.env.example` for the full list with descriptions. Required variables:

- `DATABASE_URL` — PostgreSQL connection string
- `REDIS_URL` — Redis connection string  
- `JWT_SECRET` — Secret key for signing JWTs (use a strong random value in production)

## Docker

### Build production image

```bash
docker build -t catwallet-ops-backend .
```

### Run with docker compose (infra only)

```bash
docker compose up -d          # start postgres + redis
docker compose down           # stop and remove containers
docker compose down -v        # also remove volumes (wipes data)
```

The production container runs `prisma migrate deploy` automatically via
`docker-entrypoint.sh` before starting the Node process. Set
`SKIP_MIGRATIONS=true` to bypass (e.g. in smoke-test environments).

## CI

GitHub Actions (`.github/workflows/ci.yml`) runs on every push and PR:

1. Spin up postgres 16 + redis 7 service containers
2. `npm ci`
3. `prisma generate`
4. `lint` → `typecheck` → `test` → `build`
# catwallet-ops-backend
