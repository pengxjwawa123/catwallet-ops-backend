# CatWallet 运营后台后端

标准生产级 NestJS 运营后台基座。提供管理员认证、角色权限管理（RBAC）、审计日志、功能开关、远程配置、公告管理、后台异步任务追踪。已完成阶段 0-3，在 AWS EC2 生产环境验证通过。

## 技术栈

| 层 | 技术选型 |
|---|---|
| 运行时 | Node.js 22 / TypeScript 5 |
| 框架 | NestJS 10 |
| 数据库 | Prisma 5 ORM + PostgreSQL 16 |
| 缓存/队列 | Redis 7 + BullMQ |
| 认证 | JWT (access + refresh tokens) + argon2 密码哈希 + TOTP 2FA |
| 验证 | class-validator + Zod |
| 日志 | nestjs-pino (结构化 JSON) |
| API 文档 | Swagger / OpenAPI 3 (`/docs`) |
| 健康检查 | @nestjs/terminus (`/health`) |
| 限流 | @nestjs/throttler |
| 队列 | @nestjs/bullmq |

## 快速开始

### 1. 启动基础设施（PostgreSQL + Redis）

```bash
docker compose up -d
```

验证服务就绪：
```bash
docker compose ps
# postgres:5432 和 redis:6379 应显示 healthy
```

### 2. 安装依赖

```bash
npm install
```

### 3. 配置环境变量

```bash
cp .env.example .env
```

编辑 `.env`，至少设置以下必需项：
- `JWT_SECRET` — 设置为 32+ 字符的强随机值（生产环境必须修改）
- `DATABASE_URL` — 默认已配置本地 PostgreSQL
- `REDIS_URL` — 默认已配置本地 Redis

### 4. 初始化数据库

```bash
npm run prisma:migrate:dev
```

首次运行将创建所有表和种子数据（默认 superadmin 用户）。

### 5. 启动开发服务器

```bash
npm run start:dev
```

服务现已运行：
- **API** — http://localhost:3000
- **Swagger 文档** — http://localhost:3000/docs
- **健康检查** — http://localhost:3000/health

### 验证登录

```bash
curl -X POST http://localhost:3000/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"Admin@CatWallet2024!"}'
```

返回：
```json
{
  "accessToken": "eyJ0eXAiOiJKV1QiLCJhbGc...",
  "refreshToken": "eyJ0eXAiOiJKV1QiLCJhbGc...",
  "expiresIn": 900
}
```

## 架构概览

### 模块与路由

| 路由前缀 | 模块 | 说明 |
|---|---|---|
| `POST /auth/*` | auth | 登录、刷新令牌、登出、2FA 设置 |
| `GET /ops-users`, `POST /ops-users` | ops-users | 运营账号 CRUD |
| `GET /rbac/roles`, `POST /rbac/roles` | rbac | 角色管理 |
| `GET /rbac/permissions`, `POST /rbac/permissions` | rbac | 权限管理 |
| `GET /audit-logs` | audit | 审计日志查询（只读） |
| `GET /feature-flags`, `POST /feature-flags` | feature-flags | 功能开关 CRUD |
| `GET /remote-configs`, `POST /remote-configs` | remote-configs | 远程配置 CRUD |
| `GET /announcements`, `POST /announcements` | announcements | 公告 CRUD |
| `GET /jobs` | jobs | 异步任务状态查询 |
| `GET /health` | health | 生存性和就绪性探针（@Public） |

### 全局 Guard 链

所有请求依次通过三层守卫：

1. **ThrottlerGuard** — 请求限流（默认 60 req/min，`/auth/login` 特殊限流 5 req/60s）
2. **JwtAuthGuard** — JWT 令牌验证（检查 `@Public()` 装饰器跳过）
3. **PermissionsGuard** — 细粒度权限校验（检查 `@RequirePermission()` 装饰器）

`@Public()` 标记的端点：`POST /auth/login`、`POST /auth/refresh`、`POST /auth/2fa/verify`、`GET /health`。

### 权限模型

- **格式**：`resource:action`，如 `feature_flag:read`、`ops_user:create`
- **PermissionsGuard** 规则：
  - `superadmin` 角色自动通过所有权限检查（短路）
  - 其他用户检查角色 → 角色权限 → 用户权限集（Redis 缓存 60s）
- **预置 13 个权限**：见 `prisma/seed.ts`
  - 写权限：`ops_user:{create,update,delete}`、`rbac:manage`、`role:assign`、`feature_flag:manage`、`remote_config:manage`、`announcement:manage`
  - 读权限：`ops_user:read`、`audit:read`、`feature_flag:read`、`remote_config:read`、`announcement:read`

### 审计拦截器

全局 `AuditInterceptor` 自动记录所有写操作（POST/PUT/PATCH/DELETE）：

- **记录内容**：操作者 ID、操作者名称、操作类型、目标资源、请求前后值、客户端 IP、User-Agent
- **敏感字段脱敏**：`password`、`refreshToken`、`secret` 等关键字段不记录具体值
- **异常捕获**：失败操作也记录，便于审计

### 认证流程

```
1. 用户名 + 密码 → POST /auth/login
   ↓
2. 密码 argon2 验证 + 检查 2FA 状态
   ├─ 2FA 已启用 → requires2FA=true, 返回临时 token
   └─ 2FA 未启用 → 直接返回 accessToken + refreshToken
   ↓
3. 若需 2FA → POST /auth/2fa/verify (TOTP 验证)
   ↓
4. 获得 accessToken (15m 有效期) + refreshToken (7d 可撤销)
   ↓
5. 后续请求 Authorization: Bearer <accessToken>
   ↓
6. Token 过期 → POST /auth/refresh (使用 refreshToken 轮换)
   ↓
7. 登出 → POST /auth/logout (撤销 refreshToken)
```

## 环境变量完整说明

| 变量 | 类型 | 默认值 | 说明 | 生产环境必设 |
|---|---|---|---|---|
| `NODE_ENV` | string | `development` | 运行环境。生产 Docker 容器内固定 `production` | 否 |
| `PORT` | number | `3000` | 容器内监听端口 | 否 |
| `APP_PORT` | number | `3001` | Docker Compose 宿主机映射端口（容器内仍是 3000） | 否 |
| `CORS_ORIGIN` | string | `*` | CORS 允许源 | 是 |
| `DATABASE_URL` | string | 无 | PostgreSQL 连接字符串，格式 `postgresql://user:pass@host:port/db?schema=public` | 是 |
| `REDIS_URL` | string | 无 | Redis 连接字符串，格式 `redis://host:port` | 是 |
| `JWT_SECRET` | string | 无 | JWT 签名密钥，**必须 ≥32 字符**，生产拒绝占位值 `change-me-to-a-long-random-secret` | 是 |
| `JWT_ACCESS_EXPIRY` | string | `15m` | accessToken 有效期（格式：`15m`、`1h` 等） | 否 |
| `JWT_REFRESH_EXPIRY` | string | `7d` | refreshToken 有效期 | 否 |
| `POSTGRES_USER` | string | `ops` | PostgreSQL 用户名（docker-compose 用） | 否 |
| `POSTGRES_PASSWORD` | string | `ops` | PostgreSQL 密码（docker-compose 用） | 否 |
| `POSTGRES_DB` | string | `catwallet_ops` | PostgreSQL 数据库名（docker-compose 用） | 否 |
| `SEED_ADMIN_USERNAME` | string | `admin` | 首次 seed 创建的 superadmin 账号 | 否 |
| `SEED_ADMIN_PASSWORD` | string | `Admin@CatWallet2024!` | 首次 seed 创建的 superadmin 密码（仅开发用，生产必设强密码） | 是（生产） |
| `SENTRY_DSN` | string | 空 | Sentry 错误追踪 DSN（留空则禁用） | 否 |

**生产环境示例**：
```bash
NODE_ENV=production
PORT=3000
APP_PORT=80
CORS_ORIGIN=https://ops.catwallet.com
DATABASE_URL=postgresql://ops_prod:SecurePassword123@db.example.com:5432/catwallet_ops?schema=public
REDIS_URL=redis://redis-cluster.example.com:6379
JWT_SECRET=your-super-long-random-secret-at-least-32-chars-e3f7a9b2d4c1e6f8a3b5c7d9e1f3a5b7
JWT_ACCESS_EXPIRY=15m
JWT_REFRESH_EXPIRY=7d
SEED_ADMIN_PASSWORD=YourStrongPassword123!@#
SENTRY_DSN=https://xxxx@yyyy.ingest.sentry.io/zzzzz
```

## API 概览

完整 API 文档见 Swagger: http://localhost:3000/docs

### 认证端点

| 方法 | 路径 | 权限 | 说明 |
|---|---|---|---|
| POST | `/auth/login` | @Public | 登录（用户名 + 密码） |
| POST | `/auth/refresh` | @Public | 刷新 token（refresh token 轮换） |
| POST | `/auth/logout` | 需认证 | 登出（撤销 refresh token） |
| POST | `/auth/2fa/setup` | 需认证 | 生成 2FA 密钥（返回 QR 码） |
| POST | `/auth/2fa/enable` | 需认证 | 启用 2FA（验证 TOTP） |
| POST | `/auth/2fa/verify` | @Public | 2FA 登录第二步（验证 TOTP） |

### 运营账号（ops-users）

| 方法 | 路径 | 权限 | 说明 |
|---|---|---|---|
| GET | `/ops-users` | `ops_user:read` | 列表 |
| GET | `/ops-users/:id` | `ops_user:read` | 详情 |
| POST | `/ops-users` | `ops_user:create` | 创建 |
| PATCH | `/ops-users/:id` | `ops_user:update` | 更新 |
| DELETE | `/ops-users/:id` | `ops_user:delete` | 删除 |

### RBAC（角色权限）

| 方法 | 路径 | 权限 | 说明 |
|---|---|---|---|
| GET | `/rbac/roles` | `rbac:manage` | 列表 |
| POST | `/rbac/roles` | `rbac:manage` | 创建角色 |
| GET | `/rbac/permissions` | `rbac:manage` | 列表 |
| POST | `/rbac/permissions` | `rbac:manage` | 创建权限 |

### 其他模块

- **审计日志** — `GET /audit-logs`（需 `audit:read` 权限，只读）
- **功能开关** — `GET /feature-flags`、`POST /feature-flags`（需 `feature_flag:read`/`manage`）
- **远程配置** — `GET /remote-configs`、`POST /remote-configs`（需 `remote_config:read`/`manage`）
- **公告** — `GET /announcements`、`POST /announcements`（需 `announcement:read`/`manage`）
- **异步任务** — `GET /jobs`（需认证，返回 BullMQ 队列状态）

## npm 脚本说明

| 脚本 | 说明 |
|---|---|
| `npm run build` | 编译 TypeScript 到 `dist/`（含 seed.js） |
| `npm start` | 运行编译后的生产构建 |
| `npm run start:dev` | 热重载开发模式（watchMode） |
| `npm run lint` | ESLint 检查并自动修复 |
| `npm run typecheck` | TypeScript 类型检查（无生成）|
| `npm test` | Jest 单元测试（83 个测试通过） |
| `npm run test:e2e` | Jest e2e 测试 |
| `npm run prisma:generate` | 重新生成 Prisma 客户端 |
| `npm run prisma:migrate` | 运行 `prisma migrate deploy`（生产） |
| `npm run prisma:migrate:dev` | 运行 `prisma migrate dev`（开发） |
| `npm run prisma:validate` | 验证 Prisma schema |
| `npm run prisma:seed` | 运行 seed（ts-node，开发） |
| `npm run prisma:seed:prod` | 运行 seed（node dist/seed.js，生产） |

## 部署到生产服务器

### 前置准备

- 服务器：AWS EC2（或其他云主机）、Docker + Docker Compose
- 外部依赖：PostgreSQL 16（可选自建或 RDS）、Redis 7（可选自建或 ElastiCache）
- 域名与 SSL 证书（可选，nginx 反向代理）

### 步骤 1：克隆仓库并配置环境

```bash
git clone <repo-url> catwallet-ops-backend
cd catwallet-ops-backend

# 复制环境配置，编辑生产参数
cp .env.example .env
# 编辑 .env：设置 JWT_SECRET、DATABASE_URL、REDIS_URL、APP_PORT、SEED_ADMIN_PASSWORD 等
vim .env
```

### 步骤 2：启动 Docker Compose

若使用自建 PostgreSQL + Redis：

```bash
# 仅启动应用容器（连接到外部 DB 和 Redis）
docker compose up -d app
```

若全套使用 Docker（包含 PostgreSQL 和 Redis）：

```bash
docker compose up -d
```

验证容器状态：
```bash
docker compose ps
# 应显示 app/postgres/redis 均为 running + healthy
```

### 步骤 3：初始化数据库和权限种子

应用容器启动时 `docker-entrypoint.sh` 会自动运行 `prisma migrate deploy` 或 `prisma db push`。若需手动重新 seed 或重置数据：

```bash
# 第一次 seed（创建 superadmin 用户）
docker compose exec -e SEED_ADMIN_PASSWORD='你的强密码' app npm run prisma:seed:prod

# 后续重新 seed（覆盖旧数据）
docker compose exec -e SEED_ADMIN_PASSWORD='强密码' app npm run prisma:seed:prod
```

### 步骤 4：验证部署

健康检查：
```bash
curl -s http://localhost:<APP_PORT>/health | jq .
```

登录验证：
```bash
curl -X POST http://localhost:<APP_PORT>/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"<你设置的密码>"}'
```

访问 Swagger 文档：
```
http://<服务器IP>:<APP_PORT>/docs
```

### 注意事项

#### 对于 Amazon Linux 2 或其他 glibc < 2.27 的系统

若本机 Node 22 native binary 无法运行（`GLIBC_2.27 not found`），必须使用 Docker 运行应用。Docker 镜像基于 `node:22-alpine` 已内置 OpenSSL 和兼容库，不依赖宿主机 glibc。

```bash
# 检查宿主机 glibc 版本
ldd --version | head -1

# 若版本过低，确保仅用 Docker 启动应用
docker compose up -d  # 不在主机上运行 npm start
```

#### APP_PORT 与宿主机端口映射

- 容器内应用固定监听 `PORT=3000`
- `APP_PORT` 环境变量控制 Docker Compose 宿主机暴露端口
- 若 3001 被占用，修改 `.env` 的 `APP_PORT` 值：

```bash
APP_PORT=8080  # 宿主机 8080 映射到容器 3000
```

#### JWT_SECRET 强度验证

应用启动时验证 `JWT_SECRET`：
- 必须 ≥32 字符
- 拒绝已知占位值（如 `change-me-to-a-long-random-secret`）
- 生成强密钥：

```bash
# macOS / Linux
openssl rand -base64 32

# Node.js
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
```

#### 数据库迁移策略

- **首次部署**：若无 `prisma/migrations/` 目录，`entrypoint.sh` 自动执行 `prisma db push` 建表
- **后续更新**：维护版本化迁移文件（`prisma migrate dev`），部署时执行 `prisma migrate deploy`
- **跳过迁移**（仅开发/冒烟测试）：`SKIP_MIGRATIONS=true docker compose up`

#### Token 过期与刷新

- accessToken 默认 15 分钟过期，需通过 refreshToken 轮换续期
- refreshToken 默认 7 天过期（可修改 `JWT_REFRESH_EXPIRY`）
- refreshToken 支持撤销（登出时清除）和审计

## 常用运维命令

### 查看日志

```bash
# 实时应用日志
docker compose logs -f app

# 指定行数
docker compose logs --tail 50 app

# PostgreSQL 日志
docker compose logs postgres

# Redis 日志
docker compose logs redis
```

### 重建与重启

```bash
# 重新构建镜像并启动
docker compose up -d --build

# 完全重启（清除容器）
docker compose down
docker compose up -d

# 只重启应用容器
docker compose restart app
```

### 数据库操作

```bash
# 交互式 PostgreSQL CLI
docker compose exec postgres psql -U ops -d catwallet_ops

# 重跑迁移
docker compose exec app npm run prisma:migrate

# 查看 Prisma schema 验证
docker compose exec app npm run prisma:validate

# 重新生成 Prisma 客户端
docker compose exec app npm run prisma:generate
```

### 权限与用户管理

```bash
# 重新 seed 所有数据（会覆盖现有角色/权限/用户）
docker compose exec -e SEED_ADMIN_PASSWORD='新密码' app npm run prisma:seed:prod

# 查询所有 ops 用户
docker compose exec postgres psql -U ops -d catwallet_ops -c "SELECT id, username, status FROM ops_users;"

# 查询所有角色
docker compose exec postgres psql -U ops -d catwallet_ops -c "SELECT * FROM ops_roles;"
```

### 健康检查

```bash
# HTTP 健康检查
curl -s http://localhost:3001/health | jq .

# 响应示例
{
  "status": "ok",
  "checks": {
    "database": {
      "status": "up"
    },
    "redis": {
      "status": "up"
    }
  }
}
```

### 性能与监控

```bash
# 查看容器资源使用
docker stats catwallet-ops-backend-app-1

# 检查 Redis 键数
docker compose exec redis redis-cli dbsize

# 检查 Redis 内存使用
docker compose exec redis redis-cli info memory | grep used_memory_human
```

## 测试与质量

### 单元测试

```bash
npm test
```

**测试覆盖**：
- 83 个单元测试通过（11 个测试套件）
- 核心模块：auth、rbac、permissions、audit、feature-flags、jobs 等
- 关键场景：JWT 验证、权限检查、2FA、审计拦截、缓存失效

### E2E 测试

```bash
npm run test:e2e
```

### 代码质量

```bash
npm run lint        # ESLint 检查
npm run typecheck   # TypeScript 类型检查
```

### 安全审查

项目已完成两轮安全审查及修复：
- 2FA 绕过防护
- 账号枚举攻击防护
- 自我提权检查
- 审计日志脱敏（密码、token）

## 故障排查

### 问题：`port 3001 already in use`

**原因**：宿主机 3001 端口被占用。

**解决**：
```bash
# 修改 .env
APP_PORT=3002

# 重启
docker compose down
docker compose up -d
```

### 问题：`GLIBC_2.27 not found`

**原因**：宿主机 glibc 版本过低（如 Amazon Linux 2），Node 22 native binary 不兼容。

**解决**：使用 Docker 运行应用（已在 Dockerfile 中处理，node:22-alpine 自带 OpenSSL + libc6-compat）。

### 问题：`JWT_SECRET is a known placeholder value`

**原因**：仍使用 `.env.example` 的占位值启动。

**解决**：
```bash
# 生成强密钥
openssl rand -base64 32

# 修改 .env
JWT_SECRET=<生成的值>

# 重启应用
docker compose restart app
```

### 问题：`prisma migrate deploy` 失败

**原因**：迁移文件损坏或数据库连接问题。

**解决**：
```bash
# 验证 DATABASE_URL
echo $DATABASE_URL

# 若首次部署，让 entrypoint 用 db push 自动建表
docker compose down -v  # 清除数据卷
docker compose up -d

# 若需手动干预，进入 PostgreSQL
docker compose exec postgres psql -U ops -d catwallet_ops -c "\dt"
```

### 问题：登录后请求 403 Forbidden

**原因**：用户权限不足或权限缓存过期。

**解决**：
```bash
# 确认用户有正确角色（需 superadmin 或包含所需权限）
docker compose exec postgres psql -U ops -d catwallet_ops -c \
  "SELECT u.username, r.name FROM ops_users u JOIN ops_user_roles ur ON u.id = ur.ops_user_id JOIN ops_roles r ON ur.ops_role_id = r.id;"

# 清除 Redis 权限缓存（强制重新加载）
docker compose exec redis redis-cli DEL "perms:*"

# 重试请求
```

### 问题：性能变慢或 Redis 内存高

**原因**：权限缓存或任务队列堆积。

**解决**：
```bash
# 检查 Redis 键
docker compose exec redis redis-cli keys "*" | wc -l

# 清空非关键缓存
docker compose exec redis redis-cli FLUSHDB

# 检查 BullMQ 队列
docker compose exec redis redis-cli keys "bull:*"

# 监控 Redis
docker compose exec redis redis-cli MONITOR
```

## 项目结构

```
catwallet-ops-backend/
├── apps/api/src/
│   ├── auth/                    # 认证与授权（JWT、2FA、权限）
│   │   ├── guards/              # JwtAuthGuard、PermissionsGuard
│   │   ├── strategies/          # JWT Passport 策略
│   │   ├── decorators/          # @Public、@RequirePermission、@CurrentUser
│   │   ├── auth.controller.ts
│   │   ├── auth.service.ts
│   │   └── dto/                 # LoginDto、RefreshTokenDto 等
│   ├── rbac/                    # 角色与权限管理
│   │   ├── roles.controller.ts
│   │   ├── permissions.controller.ts
│   │   └── services/
│   ├── ops-users/               # 运营账号管理
│   ├── audit/                   # 审计日志
│   │   ├── audit.interceptor.ts # 全局审计拦截器
│   │   └── audit.controller.ts
│   ├── feature-flags/           # 功能开关
│   ├── remote-configs/          # 远程配置
│   ├── announcements/           # 公告
│   ├── jobs/                    # 异步任务队列
│   ├── health/                  # 健康检查
│   ├── config/                  # 环境变量验证
│   ├── common/                  # 共享工具
│   │   ├── interceptors/        # 审计、日志
│   │   ├── filters/             # 异常过滤
│   │   ├── redis/               # Redis 服务封装
│   │   └── dto/                 # 共享 DTO
│   ├── prisma/                  # ORM 配置
│   └── app.module.ts            # 根模块
├── prisma/
│   ├── schema.prisma            # 数据模型
│   ├── migrations/              # 版本化迁移
│   └── seed.ts                  # 初始化脚本（13 个权限、2 个角色、1 个 superadmin）
├── docker-compose.yml           # 本地开发（app + postgres + redis）
├── Dockerfile                   # 生产多阶段构建
├── docker-entrypoint.sh         # 启动脚本（自动迁移）
├── .env.example                 # 环境变量模板
└── package.json                 # 依赖与脚本
```

## 已知约束与未来方向

### 当前限制

1. **业务数据接入**：当前为标准后端基座，不含各产品数据集成。后续通过模块化设计扩展。
2. **glibc 兼容性**：本机运行需 glibc ≥2.27（可用 Docker 绕过）。
3. **数据库迁移**：首次部署依赖 `prisma migrate deploy` 或 `db push`；若表已存在，需手动清理。

### 扩展方向

- 产品业务数据模块集成
- 第三方认证集成（OAuth、SAML）
- 事件驱动架构（异步处理扩展）
- 多租户支持
- 国际化与本地化

## 联系与支持

- 文档：见 Swagger `/docs`
- 问题反馈：[提交 Issue]
- 贡献指南：[见 CONTRIBUTING.md]

---

**最后更新**：2026-06-18  
**版本**：0.1.0  
**阶段**：0-3 完成，生产验证通过
