# 架构与故障排查指南

CatWallet 运营后台后端的设计架构、内部机制、常见问题与解决方案。

## 架构设计

### 分层架构

```
┌─────────────────────────────────────────────────────────┐
│  Controller Layer (HTTP 端点)                            │
│  ├─ AuthController                                      │
│  ├─ OpsUsersController                                  │
│  ├─ RbacController (roles/permissions)                 │
│  └─ ...其他模块                                         │
└──────────────────┬──────────────────────────────────────┘
                   │ @Injectable()
┌──────────────────▼──────────────────────────────────────┐
│  Guard & Interceptor Layer (横切关注点)                 │
│  ├─ ThrottlerGuard (限流)                              │
│  ├─ JwtAuthGuard (认证)                                │
│  ├─ PermissionsGuard (授权)                            │
│  └─ AuditInterceptor (审计记录)                        │
└──────────────────┬──────────────────────────────────────┘
                   │
┌──────────────────▼──────────────────────────────────────┐
│  Service Layer (业务逻辑)                               │
│  ├─ AuthService                                        │
│  ├─ OpsUsersService                                    │
│  ├─ RbacService                                        │
│  └─ ...其他服务                                        │
└──────────────────┬──────────────────────────────────────┘
                   │
┌──────────────────▼──────────────────────────────────────┐
│  Data Access Layer                                      │
│  ├─ PrismaService (ORM)                               │
│  ├─ RedisService (缓存)                                │
│  └─ BullMQ (异步队列)                                  │
└──────────────────┬──────────────────────────────────────┘
                   │
┌──────────────────▼──────────────────────────────────────┐
│  外部依赖                                               │
│  ├─ PostgreSQL 16                                      │
│  ├─ Redis 7                                            │
│  └─ 第三方服务 (Sentry)                                │
└─────────────────────────────────────────────────────────┘
```

### 请求流程

```
1. 客户端发送 HTTP 请求
   ↓
2. NestJS 路由匹配到 Controller 方法
   ↓
3. Guard 链执行（顺序关键）：
   a) ThrottlerGuard → 检查请求限流
   b) JwtAuthGuard → 验证 JWT token（检查 @Public 跳过）
   c) PermissionsGuard → 检查细粒度权限（检查 @RequirePermission 装饰器）
   ↓
4. 若 Guard 通过，拦截器前置处理：
   a) AuditInterceptor → 准备审计数据
   ↓
5. Controller 调用 Service 业务逻辑
   ↓
6. Service 访问 PrismaService（数据库）或 RedisService（缓存）
   ↓
7. 返回响应数据
   ↓
8. 拦截器后置处理：
   a) AuditInterceptor → 异步写入审计日志到数据库
   ↓
9. NestJS 序列化响应，返回给客户端
```

### 权限检查机制

```
端点标记 @RequirePermission('feature_flag:manage')
   ↓
PermissionsGuard.canActivate() 执行
   ↓
检查 @Public() → 若标记则直接返回 true
   ↓
提取 JWT 中的用户信息（userId, roles）
   ↓
检查 superadmin 角色 → 若是则短路返回 true（绕过权限检查）
   ↓
查询用户权限集：
   a) 先查 Redis 缓存 (key: perms:<userId>, TTL: 60s)
   b) 命中缓存则返回缓存值
   c) 未命中则查数据库：用户 → 角色 → 权限
   d) 写入 Redis 缓存 (非阻塞，失败不中断请求)
   ↓
检查 required_permission 是否在用户权限集中
   ↓
若不在则抛 ForbiddenException，否则继续
```

## 认证机制深度解析

### JWT Token 结构

```json
header: {
  "alg": "HS256",
  "typ": "JWT"
}

payload: {
  "sub": "user-id-xxx",           // subject (用户 ID)
  "username": "admin",
  "roles": ["superadmin"],
  "iat": 1687000000,              // issued at
  "exp": 1687000900               // expiration (15 分钟后)
}

signature: HMAC-SHA256(header + payload, JWT_SECRET)
```

### Token 轮换流程

```
1. 初始登录 → 获得 accessToken (15m) + refreshToken (7d)
   ↓
2. 后续请求使用 accessToken
   ↓
3. accessToken 过期 → 调用 POST /auth/refresh
   ↓
4. 验证 refreshToken：
   a) 检查 signature（用 JWT_SECRET）
   b) 检查 exp（未过期）
   c) 查询 Redis 黑名单（登出时添加）
   d) 若黑名单中则拒绝（token 已撤销）
   ↓
5. 验证通过 → 颁发新 accessToken + 新 refreshToken
   ↓
6. 旧 refreshToken 加入 Redis 黑名单（可选，防重放）
   ↓
7. 客户端获得新 token 对，继续使用
```

### 2FA 流程

```
启用 2FA：
1. 用户调用 POST /auth/2fa/setup
   ↓
2. AuthService 生成 TOTP 密钥（使用 otplib）
   ↓
3. 返回 secret + QR 码，用户用 Google Authenticator 扫描
   ↓
4. 用户确认后调用 POST /auth/2fa/enable，提交 6 位 TOTP 码
   ↓
5. AuthService 验证 TOTP（使用 otplib.authenticator.check()）
   ↓
6. 验证通过 → 在数据库标记用户 twoFactorSecret

登录 2FA 流程：
1. 用户 POST /auth/login (username + password)
   ↓
2. 密码验证通过 → 检查用户是否启用 2FA
   ↓
3. 若启用 → 返回 requires2FA=true + tempToken（短期有效）
   ↓
4. 客户端需调用 POST /auth/2fa/verify (userId + TOTP 码)
   ↓
5. AuthService 用 twoFactorSecret 验证 TOTP
   ↓
6. 验证通过 → 返回正式 accessToken + refreshToken
```

## 审计日志机制

### 拦截流程

```
请求进入 AuditInterceptor.intercept()
   ↓
检查请求方法 → 仅审计 POST/PUT/PATCH/DELETE，忽略 GET
   ↓
检查端点 → 忽略 /health、/docs 等非业务端点
   ↓
检查是否为 @AuditAction 标记 → 无标记则用 HTTP 方法作为 action
   ↓
检查请求体是否包含敏感字段 → 若包含则脱敏：
   - password → "***"
   - refreshToken → "***"
   - secret → "***"
   - token → "***"
   ↓
保存审计数据临时变量：
{
  actorId: request.user.userId,
  actorName: request.user.username,
  action: "POST /ops-users",
  target: "ops-users",
  beforeValue: null (创建时为 null),
  ipAddress: request.ip,
  userAgent: request.headers['user-agent']
}
   ↓
执行业务逻辑（next.handle()）
   ↓
捕获响应数据 → 保存为 afterValue
   ↓
若执行成功 → status = 'SUCCESS'
若捕获异常 → status = 'FAILED'，记录错误信息
   ↓
异步写入 audit_logs 表（非阻塞，失败不中断请求）
   ↓
返回响应给客户端
```

### 脱敏规则

```typescript
const SENSITIVE_FIELDS = ['password', 'refreshToken', 'secret', 'token', 'apiKey'];

function redact(obj: any): any {
  if (typeof obj !== 'object') return obj;
  
  const result = Array.isArray(obj) ? [...obj] : {...obj};
  
  for (const key in result) {
    if (SENSITIVE_FIELDS.some(field => key.toLowerCase().includes(field))) {
      result[key] = '***';
    } else if (typeof result[key] === 'object') {
      result[key] = redact(result[key]);  // 递归脱敏
    }
  }
  
  return result;
}
```

## 缓存策略

### Redis 缓存键设计

```
权限缓存:
  键：perms:<userId>
  值：["ops_user:read", "ops_user:create", "feature_flag:manage"]
  TTL：60 秒
  触发更新：角色分配变更、权限变更

Token 黑名单（登出）:
  键：token-blacklist:<refreshTokenJti>
  值：true
  TTL：refreshToken 剩余有效期（最长 7 天）

功能开关缓存（可选）:
  键：feature-flags
  值：{key1: enabled, key2: enabled, ...}
  TTL：5 分钟

远程配置缓存（可选）:
  键：remote-config:<key>
  值：<value>
  TTL：10 分钟
```

### 缓存失效策略

```
权限缓存失效触发：
1. 用户角色变更 → PermissionsGuard.invalidateUserCache(userId)
2. 角色权限变更 → PermissionsGuard.invalidateRoleCache(roleId)
3. 删除用户 → 删除相应权限缓存

Token 黑名单清理：
- 定时清理过期黑名单（TTL 自动处理）
- 登出时主动添加（preventReplay）

缓存穿透保护：
- 若缓存键未找到且数据库查询为空 → 设置负缓存（TTL: 60s）
- 防止恶意用户重复查询不存在数据
```

## 故障排查

### 问题 1：登录返回 401

**现象**：POST /auth/login 返回 `{"statusCode": 401, "message": "Invalid credentials"}`

**诊断步骤**：

```bash
# 1. 验证用户是否存在
docker compose exec postgres psql -U ops -d catwallet_ops -c \
  "SELECT id, username, status FROM ops_users WHERE username='admin';"

# 2. 若用户存在，检查状态
# 应该是 ACTIVE，而非 INACTIVE/SUSPENDED

# 3. 验证 seed 是否完成
docker compose logs app | grep "Seed\|SEED"

# 4. 若 seed 未完成，手动运行
docker compose exec -e SEED_ADMIN_PASSWORD='你的密码' app npm run prisma:seed:prod

# 5. 查看 AuthService 日志（启用 DEBUG）
docker compose logs app | grep -i "auth\|password"
```

**常见原因**：
- Seed 未完成（superadmin 用户不存在）
- 用户状态为 INACTIVE
- 密码不匹配（首次 seed 使用默认密码 `Admin@CatWallet2024!`）

### 问题 2：登录后请求返回 403 Forbidden

**现象**：POST /ops-users 返回 `{"statusCode": 403, "message": "Permission required: ops_user:create"}`

**诊断步骤**：

```bash
# 1. 验证用户角色
docker compose exec postgres psql -U ops -d catwallet_ops -c \
  "SELECT u.username, r.name FROM ops_users u \
   JOIN ops_user_roles ur ON u.id = ur.ops_user_id \
   JOIN ops_roles r ON ur.ops_role_id = r.id \
   WHERE u.username='admin';"

# 2. 验证角色是否有所需权限
docker compose exec postgres psql -U ops -d catwallet_ops -c \
  "SELECT r.name, p.resource, p.action FROM ops_roles r \
   LEFT JOIN ops_role_permissions rp ON r.id = rp.ops_role_id \
   LEFT JOIN ops_permissions p ON rp.ops_permission_id = p.id \
   WHERE r.name='superadmin';"

# 3. 清除权限缓存（强制重新加载）
docker compose exec redis redis-cli DEL "perms:*"

# 4. 重试请求
```

**常见原因**：
- 用户角色为 operator，而非 superadmin
- 权限 seed 未完成
- 权限缓存未更新（删除用户权限后未清缓存）

### 问题 3：数据库迁移失败

**现象**：`prisma migrate deploy` 失败，错误如 "Migration failed" 或 "database connection refused"

**诊断步骤**：

```bash
# 1. 验证 DATABASE_URL
echo $DATABASE_URL

# 2. 测试数据库连接
docker compose exec postgres psql -c "SELECT version();"

# 3. 查看迁移文件
ls -la prisma/migrations/

# 4. 查看 PostgreSQL 错误日志
docker compose logs postgres | tail -50

# 5. 若迁移表损坏，手动清理（仅开发环境）
docker compose exec postgres psql -U ops -d catwallet_ops -c \
  "DROP TABLE IF EXISTS _prisma_migrations; DROP TABLE IF EXISTS _prisma_schema;"

# 6. 重新运行 db push
docker compose exec app npx prisma db push --skip-generate
```

**常见原因**：
- PostgreSQL 连接失败（容器未启动或网络隔离）
- 迁移文件冲突（不同分支同时创建迁移）
- 数据库表结构损坏（手动 SQL 修改）

### 问题 4：Redis 连接超时

**现象**：应用启动时卡顿，或在 BullMQ 队列操作时超时

**诊断步骤**：

```bash
# 1. 验证 Redis 连接
docker compose exec redis redis-cli ping
# 应返回 PONG

# 2. 检查 Redis 内存使用
docker compose exec redis redis-cli info memory | grep used_memory_human

# 3. 监控 Redis 键数
docker compose exec redis redis-cli dbsize

# 4. 查看 Redis 日志
docker compose logs redis

# 5. 测试应用 Redis 连接
docker compose exec app node -e \
  "const redis = require('ioredis'); const r = new redis('redis://redis:6379'); \
   r.ping().then(() => console.log('Connected')).catch(e => console.error(e));"

# 6. 若 Redis 满了，清空非关键数据
docker compose exec redis redis-cli FLUSHDB
```

**常见原因**：
- Redis 容器未启动或不健康
- Redis 内存耗尽（清空或增加 maxmemory）
- 容器网络隔离（检查 docker-compose.yml networks 配置）

### 问题 5：JWT_SECRET 验证失败

**现象**：应用启动时失败，错误 "Config validation failed: JWT_SECRET is a known placeholder value"

**解决**：

```bash
# 1. 生成强密钥
STRONG_SECRET=$(openssl rand -base64 32)
echo "JWT_SECRET=$STRONG_SECRET"

# 2. 更新 .env
sed -i "" "s/JWT_SECRET=.*/JWT_SECRET=$STRONG_SECRET/" .env

# 3. 重启应用
docker compose restart app
```

### 问题 6：审计日志脱敏不生效

**现象**：敏感信息（密码、token）仍被记录到 audit_logs 表

**排查**：

```bash
# 1. 查看最近审计日志
docker compose exec postgres psql -U ops -d catwallet_ops -c \
  "SELECT before_value, after_value FROM audit_logs ORDER BY created_at DESC LIMIT 5;"

# 2. 检查脱敏字段列表（代码中）
grep -n "SENSITIVE_FIELDS\|password\|token" apps/api/src/common/interceptors/audit.interceptor.ts

# 3. 若字段未脱敏，添加到 SENSITIVE_FIELDS
# 修改后重新构建部署
```

### 问题 7：性能下降

**现象**：响应时间变长，或偶发超时

**诊断与优化**：

```bash
# 1. 监控容器资源
docker stats catwallet-ops-backend-app-1

# 2. 检查数据库连接数
docker compose exec postgres psql -U ops -d catwallet_ops -c \
  "SELECT count(*) as connections FROM pg_stat_activity;"

# 3. 检查慢查询
docker compose exec postgres psql -U ops -d catwallet_ops -c \
  "SELECT query, mean_exec_time FROM pg_stat_statements \
   ORDER BY mean_exec_time DESC LIMIT 10;" 2>/dev/null || echo "pg_stat_statements 未启用"

# 4. 检查 Redis 键数与内存
docker compose exec redis redis-cli info

# 5. 增加资源（修改 docker-compose.yml）
# 增加 app 内存限制、增加数据库连接池等

# 6. 添加数据库索引
docker compose exec postgres psql -U ops -d catwallet_ops -c \
  "CREATE INDEX idx_audit_logs_actor_id ON audit_logs(actor_id); \
   CREATE INDEX idx_audit_logs_created_at ON audit_logs(created_at DESC);"

# 7. 检查应用日志中的性能指标
docker compose logs app | grep -i "duration\|took"
```

## 安全加固检查清单

- [ ] JWT_SECRET 设置为 32+ 字符强随机值
- [ ] CORS_ORIGIN 限制为生产域名（非 `*`）
- [ ] 数据库连接字符串使用 sslmode=require
- [ ] SEED_ADMIN_PASSWORD 设置为强密码（生产环境）
- [ ] Nginx 启用 SSL/TLS（HTTPS only）
- [ ] 限流配置验证（/auth/login 5 req/60s）
- [ ] 审计日志敏感字段脱敏验证
- [ ] 2FA 启用（生产环境必需）
- [ ] 定期备份数据库和 Redis
- [ ] 监控和告警配置
- [ ] 防火墙规则配置（仅允许 80/443 入站）
- [ ] 定期更新依赖和安全补丁

## 监控关键指标

```bash
# 请求延迟（p95）
docker compose logs app | grep "duration" | tail -100 | \
  awk '{print $NF}' | sort -n | awk '{a[NR]=$1} END {print a[int(NR*0.95)]}'

# 错误率
ERROR_COUNT=$(docker compose logs app | grep -c "ERROR\|Exception")
TOTAL_COUNT=$(docker compose logs app | wc -l)
echo "Error rate: $((ERROR_COUNT * 100 / TOTAL_COUNT))%"

# 活跃数据库连接
docker compose exec postgres psql -U ops -d catwallet_ops -c \
  "SELECT count(*) FROM pg_stat_activity WHERE state = 'active';"

# Redis 命中率
docker compose exec redis redis-cli info stats | grep -E "hits|misses"
```

---

**最后更新**：2026-06-18  
**版本**：1.0
