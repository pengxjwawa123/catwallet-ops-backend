# API 文档

CatWallet 运营后台后端的完整 API 参考。所有示例基于本地开发环境（http://localhost:3000）。

**完整交互式 Swagger 文档**：http://localhost:3000/docs

## 认证与授权

### 认证流程

所有需要认证的端点需要在 `Authorization` 请求头中提供 Bearer token：

```bash
Authorization: Bearer <accessToken>
```

### 权限系统

权限格式：`resource:action`

**预置权限**：

| 权限 | 说明 | 默认角色 |
|---|---|---|
| `ops_user:create` | 创建运营账号 | superadmin |
| `ops_user:read` | 读取运营账号 | superadmin, operator |
| `ops_user:update` | 更新运营账号 | superadmin |
| `ops_user:delete` | 删除运营账号 | superadmin |
| `rbac:manage` | 管理角色权限 | superadmin |
| `audit:read` | 读取审计日志 | superadmin, operator |
| `role:assign` | 分配角色给用户 | superadmin |
| `feature_flag:read` | 读取功能开关 | superadmin, operator |
| `feature_flag:manage` | 管理功能开关 | superadmin |
| `remote_config:read` | 读取远程配置 | superadmin, operator |
| `remote_config:manage` | 管理远程配置 | superadmin |
| `announcement:read` | 读取公告 | superadmin, operator |
| `announcement:manage` | 管理公告 | superadmin |

### 公开端点（@Public）

无需认证的端点：
- `POST /auth/login`
- `POST /auth/refresh`
- `POST /auth/2fa/verify`
- `GET /health`

## 认证端点（/auth）

### 登录

**POST** `/auth/login`

登录获取 access token 和 refresh token。

```bash
curl -X POST http://localhost:3000/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "username": "admin",
    "password": "Admin@CatWallet2024!"
  }'
```

**请求体**：

```json
{
  "username": "string",      // 必需
  "password": "string"       // 必需
}
```

**响应** (200 OK)：

```json
{
  "accessToken": "eyJ0eXAiOiJKV1QiLCJhbGc...",
  "refreshToken": "eyJ0eXAiOiJKV1QiLCJhbGc...",
  "expiresIn": 900,
  "requires2FA": false
}
```

**响应** (需要 2FA, 200 OK)：

```json
{
  "requires2FA": true,
  "userId": "user-id-xxx",
  "tempToken": "eyJ0eXAiOiJKV1QiLCJhbGc..."  // 用于 2FA 验证
}
```

**错误** (401)：

```json
{
  "statusCode": 401,
  "message": "Invalid credentials",
  "error": "Unauthorized"
}
```

**限流**：5 次/60 秒

### 刷新 Token

**POST** `/auth/refresh`

使用 refresh token 获取新的 access token。

```bash
curl -X POST http://localhost:3000/auth/refresh \
  -H "Content-Type: application/json" \
  -d '{
    "refreshToken": "eyJ0eXAiOiJKV1QiLCJhbGc..."
  }'
```

**请求体**：

```json
{
  "refreshToken": "string"   // 必需
}
```

**响应** (200 OK)：

```json
{
  "accessToken": "eyJ0eXAiOiJKV1QiLCJhbGc...",
  "refreshToken": "eyJ0eXAiOiJKV1QiLCJhbGc...",
  "expiresIn": 900
}
```

### 登出

**POST** `/auth/logout`

撤销 refresh token。

```bash
curl -X POST http://localhost:3000/auth/logout \
  -H "Authorization: Bearer <accessToken>" \
  -H "Content-Type: application/json" \
  -d '{
    "refreshToken": "eyJ0eXAiOiJKV1QiLCJhbGc..."
  }'
```

**请求体**：

```json
{
  "refreshToken": "string"   // 必需
}
```

**响应** (200 OK)：

```json
{
  "success": true
}
```

### 2FA 设置

#### 生成 2FA 密钥

**POST** `/auth/2fa/setup`

为当前用户生成 TOTP 2FA 密钥和 QR 码。

```bash
curl -X POST http://localhost:3000/auth/2fa/setup \
  -H "Authorization: Bearer <accessToken>"
```

**响应** (200 OK)：

```json
{
  "secret": "JBSWY3DPEBLW64TMMQ======",
  "qrCode": "data:image/png;base64,iVBORw0KGgo...",
  "backupCodes": [
    "123456",
    "234567",
    "345678"
  ]
}
```

#### 启用 2FA

**POST** `/auth/2fa/enable`

验证 TOTP 码并启用 2FA。

```bash
curl -X POST http://localhost:3000/auth/2fa/enable \
  -H "Authorization: Bearer <accessToken>" \
  -H "Content-Type: application/json" \
  -d '{
    "token": "123456"
  }'
```

**请求体**：

```json
{
  "token": "string"   // 6 位 TOTP 码
}
```

**响应** (200 OK)：

```json
{
  "success": true,
  "message": "2FA enabled"
}
```

#### 验证 2FA

**POST** `/auth/2fa/verify`

登录时完成 2FA 验证步骤。

```bash
curl -X POST http://localhost:3000/auth/2fa/verify \
  -H "Content-Type: application/json" \
  -d '{
    "userId": "user-id-xxx",
    "token": "123456"
  }'
```

**请求体**：

```json
{
  "userId": "string",    // 登录返回的 userId
  "token": "string"      // 6 位 TOTP 码
}
```

**响应** (200 OK)：

```json
{
  "accessToken": "eyJ0eXAiOiJKV1QiLCJhbGc...",
  "refreshToken": "eyJ0eXAiOiJKV1QiLCJhbGc...",
  "expiresIn": 900
}
```

## 运营账号端点（/ops-users）

需权限：`ops_user:read`、`ops_user:create`、`ops_user:update`、`ops_user:delete`

### 列表

**GET** `/ops-users`

获取所有运营账号。支持分页和过滤。

```bash
curl -X GET "http://localhost:3000/ops-users?page=1&pageSize=20&status=ACTIVE" \
  -H "Authorization: Bearer <accessToken>"
```

**查询参数**：

| 参数 | 类型 | 说明 |
|---|---|---|
| `page` | number | 页码（从 1 开始） |
| `pageSize` | number | 每页条数（默认 20） |
| `status` | string | 状态过滤：`ACTIVE`, `INACTIVE`, `SUSPENDED` |
| `search` | string | 按用户名搜索 |

**响应** (200 OK)：

```json
{
  "data": [
    {
      "id": "user-id-1",
      "username": "admin",
      "email": "admin@example.com",
      "status": "ACTIVE",
      "roles": [
        {
          "id": "role-id-1",
          "name": "superadmin"
        }
      ],
      "createdAt": "2026-01-01T00:00:00Z",
      "updatedAt": "2026-06-18T12:34:56Z"
    }
  ],
  "total": 5,
  "page": 1,
  "pageSize": 20,
  "totalPages": 1
}
```

### 详情

**GET** `/ops-users/:id`

获取单个运营账号详情。

```bash
curl -X GET http://localhost:3000/ops-users/user-id-1 \
  -H "Authorization: Bearer <accessToken>"
```

**响应** (200 OK)：

```json
{
  "id": "user-id-1",
  "username": "admin",
  "email": "admin@example.com",
  "status": "ACTIVE",
  "roles": [
    {
      "id": "role-id-1",
      "name": "superadmin",
      "permissions": [
        {
          "id": "perm-id-1",
          "resource": "ops_user",
          "action": "read"
        }
      ]
    }
  ],
  "lastLoginAt": "2026-06-18T10:30:00Z",
  "twoFactorEnabled": false,
  "createdAt": "2026-01-01T00:00:00Z",
  "updatedAt": "2026-06-18T12:34:56Z"
}
```

### 创建

**POST** `/ops-users`

创建新运营账号。需 `ops_user:create` 权限。

```bash
curl -X POST http://localhost:3000/ops-users \
  -H "Authorization: Bearer <accessToken>" \
  -H "Content-Type: application/json" \
  -d '{
    "username": "newuser",
    "password": "SecurePassword123!",
    "email": "newuser@example.com",
    "roleIds": ["role-id-1"]
  }'
```

**请求体**：

```json
{
  "username": "string",           // 必需，唯一
  "password": "string",           // 必需，8+ 字符
  "email": "string",              // 可选
  "roleIds": ["string"]           // 分配的角色 ID 列表
}
```

**响应** (201 Created)：

```json
{
  "id": "user-id-new",
  "username": "newuser",
  "email": "newuser@example.com",
  "status": "ACTIVE",
  "roles": [
    {
      "id": "role-id-1",
      "name": "operator"
    }
  ],
  "createdAt": "2026-06-18T15:00:00Z",
  "updatedAt": "2026-06-18T15:00:00Z"
}
```

### 更新

**PATCH** `/ops-users/:id`

更新运营账号。需 `ops_user:update` 权限。

```bash
curl -X PATCH http://localhost:3000/ops-users/user-id-1 \
  -H "Authorization: Bearer <accessToken>" \
  -H "Content-Type: application/json" \
  -d '{
    "email": "newemail@example.com",
    "status": "INACTIVE",
    "roleIds": ["role-id-1", "role-id-2"]
  }'
```

**请求体**（所有字段可选）：

```json
{
  "email": "string",
  "status": "ACTIVE | INACTIVE | SUSPENDED",
  "roleIds": ["string"]
}
```

**响应** (200 OK)：

```json
{
  "id": "user-id-1",
  "username": "admin",
  "email": "newemail@example.com",
  "status": "INACTIVE",
  "roles": [
    {
      "id": "role-id-1",
      "name": "superadmin"
    },
    {
      "id": "role-id-2",
      "name": "operator"
    }
  ],
  "updatedAt": "2026-06-18T16:00:00Z"
}
```

### 删除

**DELETE** `/ops-users/:id`

删除运营账号。需 `ops_user:delete` 权限。

```bash
curl -X DELETE http://localhost:3000/ops-users/user-id-1 \
  -H "Authorization: Bearer <accessToken>"
```

**响应** (204 No Content)：

```
(无响应体)
```

## RBAC 端点

### 角色（/rbac/roles）

需权限：`rbac:manage`

#### 列表

**GET** `/rbac/roles`

```bash
curl -X GET http://localhost:3000/rbac/roles \
  -H "Authorization: Bearer <accessToken>"
```

**响应** (200 OK)：

```json
[
  {
    "id": "role-id-1",
    "name": "superadmin",
    "description": "Full system access",
    "permissions": [
      {
        "id": "perm-id-1",
        "resource": "ops_user",
        "action": "read"
      },
      {
        "id": "perm-id-2",
        "resource": "ops_user",
        "action": "create"
      }
    ]
  }
]
```

#### 创建

**POST** `/rbac/roles`

```bash
curl -X POST http://localhost:3000/rbac/roles \
  -H "Authorization: Bearer <accessToken>" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "custom_role",
    "description": "Custom role description",
    "permissionIds": ["perm-id-1", "perm-id-3"]
  }'
```

**请求体**：

```json
{
  "name": "string",              // 必需，唯一
  "description": "string",       // 可选
  "permissionIds": ["string"]    // 分配的权限 ID 列表
}
```

### 权限（/rbac/permissions）

需权限：`rbac:manage`

#### 列表

**GET** `/rbac/permissions`

```bash
curl -X GET http://localhost:3000/rbac/permissions \
  -H "Authorization: Bearer <accessToken>"
```

**响应** (200 OK)：

```json
[
  {
    "id": "perm-id-1",
    "resource": "ops_user",
    "action": "read",
    "description": "Read ops users"
  },
  {
    "id": "perm-id-2",
    "resource": "ops_user",
    "action": "create",
    "description": "Create ops users"
  }
]
```

#### 创建

**POST** `/rbac/permissions`

```bash
curl -X POST http://localhost:3000/rbac/permissions \
  -H "Authorization: Bearer <accessToken>" \
  -H "Content-Type: application/json" \
  -d '{
    "resource": "custom_resource",
    "action": "manage",
    "description": "Custom action"
  }'
```

**请求体**：

```json
{
  "resource": "string",       // 必需
  "action": "string",         // 必需
  "description": "string"     // 可选
}
```

## 审计日志端点（/audit-logs）

需权限：`audit:read`（只读）

### 查询审计日志

**GET** `/audit-logs`

获取审计日志记录。

```bash
curl -X GET "http://localhost:3000/audit-logs?page=1&pageSize=50&startDate=2026-06-01&endDate=2026-06-30" \
  -H "Authorization: Bearer <accessToken>"
```

**查询参数**：

| 参数 | 类型 | 说明 |
|---|---|---|
| `page` | number | 页码 |
| `pageSize` | number | 每页条数（默认 50） |
| `startDate` | string | 起始日期（ISO 8601） |
| `endDate` | string | 结束日期（ISO 8601） |
| `actorId` | string | 过滤操作者 ID |
| `action` | string | 过滤操作类型（如 POST /ops-users） |
| `target` | string | 过滤目标资源 |

**响应** (200 OK)：

```json
{
  "data": [
    {
      "id": "audit-id-1",
      "actorId": "user-id-1",
      "actorName": "admin",
      "action": "POST /ops-users",
      "target": "ops-users",
      "beforeValue": null,
      "afterValue": {
        "username": "newuser",
        "email": "newuser@example.com"
      },
      "ipAddress": "192.168.1.100",
      "userAgent": "curl/7.64.1",
      "status": "SUCCESS",
      "createdAt": "2026-06-18T15:30:00Z"
    }
  ],
  "total": 1250,
  "page": 1,
  "pageSize": 50,
  "totalPages": 25
}
```

**敏感字段脱敏**：`password`、`refreshToken`、`secret` 等字段不记录具体值。

## 功能开关端点（/feature-flags）

需权限：`feature_flag:read`、`feature_flag:manage`

### 列表

**GET** `/feature-flags`

```bash
curl -X GET http://localhost:3000/feature-flags \
  -H "Authorization: Bearer <accessToken>"
```

**响应** (200 OK)：

```json
[
  {
    "id": "flag-id-1",
    "key": "new_dashboard",
    "description": "Enable new dashboard UI",
    "enabled": true,
    "createdAt": "2026-01-01T00:00:00Z",
    "updatedAt": "2026-06-18T12:00:00Z"
  }
]
```

### 创建/更新

**POST** `/feature-flags`

```bash
curl -X POST http://localhost:3000/feature-flags \
  -H "Authorization: Bearer <accessToken>" \
  -H "Content-Type: application/json" \
  -d '{
    "key": "experimental_feature",
    "description": "A new experimental feature",
    "enabled": false
  }'
```

## 远程配置端点（/remote-configs）

需权限：`remote_config:read`、`remote_config:manage`

### 列表

**GET** `/remote-configs`

```bash
curl -X GET http://localhost:3000/remote-configs \
  -H "Authorization: Bearer <accessToken>"
```

**响应** (200 OK)：

```json
[
  {
    "id": "config-id-1",
    "key": "api_timeout_ms",
    "value": "30000",
    "description": "API request timeout in milliseconds",
    "createdAt": "2026-01-01T00:00:00Z"
  }
]
```

### 创建/更新

**POST** `/remote-configs`

```bash
curl -X POST http://localhost:3000/remote-configs \
  -H "Authorization: Bearer <accessToken>" \
  -H "Content-Type: application/json" \
  -d '{
    "key": "max_concurrent_jobs",
    "value": "100",
    "description": "Maximum concurrent background jobs"
  }'
```

## 公告端点（/announcements）

需权限：`announcement:read`、`announcement:manage`

### 列表

**GET** `/announcements`

```bash
curl -X GET http://localhost:3000/announcements \
  -H "Authorization: Bearer <accessToken>"
```

**响应** (200 OK)：

```json
[
  {
    "id": "announce-id-1",
    "title": "Maintenance Window",
    "content": "System maintenance scheduled for June 20",
    "priority": "HIGH",
    "createdAt": "2026-06-18T10:00:00Z",
    "publishedAt": "2026-06-18T10:00:00Z"
  }
]
```

### 创建

**POST** `/announcements`

```bash
curl -X POST http://localhost:3000/announcements \
  -H "Authorization: Bearer <accessToken>" \
  -H "Content-Type: application/json" \
  -d '{
    "title": "New Feature Release",
    "content": "We have released a new dashboard",
    "priority": "MEDIUM"
  }'
```

## 异步任务端点（/jobs）

需权限：需认证

### 列表

**GET** `/jobs`

获取 BullMQ 异步任务队列状态。

```bash
curl -X GET http://localhost:3000/jobs \
  -H "Authorization: Bearer <accessToken>"
```

**响应** (200 OK)：

```json
{
  "queues": [
    {
      "name": "audit-logs",
      "active": 2,
      "delayed": 0,
      "failed": 1,
      "paused": 0,
      "waiting": 5
    },
    {
      "name": "notifications",
      "active": 0,
      "delayed": 0,
      "failed": 0,
      "paused": 0,
      "waiting": 0
    }
  ]
}
```

## 健康检查端点（/health）

无需认证（@Public）

### 检查健康状态

**GET** `/health`

```bash
curl -s http://localhost:3000/health | jq .
```

**响应** (200 OK)：

```json
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

**响应** (503 Service Unavailable)：

```json
{
  "status": "error",
  "error": {
    "database": {
      "status": "down",
      "message": "Connection refused"
    }
  }
}
```

## 错误响应格式

所有错误响应遵循统一格式：

```json
{
  "statusCode": 400,
  "message": "Error description",
  "error": "BadRequest"
}
```

### 常见错误码

| 状态码 | 说明 |
|---|---|
| 400 | 请求参数错误 |
| 401 | 未授权（无有效 token） |
| 403 | 禁止访问（权限不足） |
| 404 | 资源不存在 |
| 429 | 限流（请求过于频繁） |
| 500 | 服务器内部错误 |
| 503 | 服务不可用 |

## 限流政策

| 端点 | 限制 | 说明 |
|---|---|---|
| `/auth/login` | 5 请求/60 秒 | 防暴力破解 |
| 其他端点 | 60 请求/分钟 | 全局限流 |

超过限制返回 429 Too Many Requests。

## SDK/客户端库

### JavaScript / TypeScript

```typescript
import axios from 'axios';

const API_BASE = 'http://localhost:3000';

class OpsBackendClient {
  private accessToken: string | null = null;

  async login(username: string, password: string) {
    const res = await axios.post(`${API_BASE}/auth/login`, {
      username,
      password,
    });
    this.accessToken = res.data.accessToken;
    return res.data;
  }

  async getUsers() {
    return axios.get(`${API_BASE}/ops-users`, {
      headers: {
        Authorization: `Bearer ${this.accessToken}`,
      },
    });
  }
}

const client = new OpsBackendClient();
await client.login('admin', 'Admin@CatWallet2024!');
const users = await client.getUsers();
```

### Python

```python
import requests

BASE_URL = 'http://localhost:3000'

class OpsBackendClient:
    def __init__(self):
        self.access_token = None

    def login(self, username, password):
        res = requests.post(
            f'{BASE_URL}/auth/login',
            json={'username': username, 'password': password}
        )
        self.access_token = res.json()['accessToken']
        return res.json()

    def get_users(self):
        headers = {'Authorization': f'Bearer {self.access_token}'}
        return requests.get(f'{BASE_URL}/ops-users', headers=headers).json()

client = OpsBackendClient()
client.login('admin', 'Admin@CatWallet2024!')
print(client.get_users())
```

---

**最后更新**：2026-06-18  
**版本**：1.0  
**完整 Swagger 文档**：http://localhost:3000/docs
