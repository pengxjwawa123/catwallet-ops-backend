# 文档索引

CatWallet 运营后台后端完整文档导航。

## 快速导航

| 文档 | 目的 | 适用角色 |
|---|---|---|
| **README.md** | 项目概述、快速开始、常用命令 | 所有人 |
| **docs/API.md** | API 参考手册、请求示例、响应格式 | 前端开发、集成开发 |
| **docs/DEPLOYMENT.md** | 生产部署步骤、架构设计、监控告警 | 运维、DevOps、后端 |
| **docs/ARCHITECTURE.md** | 内部设计、认证机制、故障排查 | 后端开发、系统设计 |

## 按场景选择

### 🚀 我想快速开始开发

1. 阅读 [README.md](./README.md) 的"快速开始"部分（5 分钟）
2. 运行 Docker Compose：`docker compose up -d`
3. 查看 [docs/API.md](./docs/API.md) 的认证端点学习登录流程
4. 开始开发

### 🔌 我需要集成或调用 API

1. 参考 [docs/API.md](./docs/API.md) 找到对应端点
2. 复制 curl 示例进行测试
3. 查看"SDK/客户端库"部分获取代码示例
4. 调用 POST /auth/login 获取 token，后续请求使用 Bearer token

### 🛠️ 我要部署到生产环境

1. 阅读 [docs/DEPLOYMENT.md](./docs/DEPLOYMENT.md) 的"前置准备清单"
2. 按"部署步骤"逐步执行（1-10 步）
3. 参考"性能优化"和"安全加固"章节配置
4. 设置"监控告警"收集关键指标

### 🔍 出现问题无法解决

1. 先查阅 [README.md](./README.md) 的"故障排查"部分
2. 若问题未解决，阅读 [docs/ARCHITECTURE.md](./docs/ARCHITECTURE.md) 的"故障排查"深度诊断
3. 按诊断步骤收集日志、执行命令
4. 若仍未解决，查看"安全加固检查清单"确保未漏配置

### 📚 我想理解系统架构

1. 阅读 [docs/ARCHITECTURE.md](./docs/ARCHITECTURE.md) 的"架构设计"部分
2. 了解分层架构和请求流程
3. 深入研究"认证机制"、"权限检查机制"、"审计日志机制"
4. 查看代码对应实现

### 🛡️ 我要进行安全审查

1. 阅读 [docs/DEPLOYMENT.md](./docs/DEPLOYMENT.md) 的"安全加固"部分
2. 查看 [README.md](./README.md) 的"两轮安全审查及修复"描述
3. 使用"安全加固检查清单"验证所有配置
4. 进行渗透测试（2FA、权限提升、账号枚举等）

## 文档内容速查

### README.md

- 项目简介与技术栈（23 行）
- 快速开始（5 步，包含验证登录）（35 行）
- 架构概览（模块、Guard 链、权限、审计、认证流程）（120 行）
- 环境变量完整说明表（生产示例）（30 行）
- API 概览（按模块列出）（30 行）
- npm 脚本说明表（12 行）
- 部署到生产服务器（4 步 + 注意事项）（80 行）
- 常用运维命令（查日志、重建、seed、健康检查、性能）（60 行）
- 测试与质量（83 个单元测试、E2E、安全审查）（15 行）
- 故障排查（6 个常见问题 + 解决方案）（100 行）
- 项目结构（文件树）（40 行）

**总计**：659 行

### docs/DEPLOYMENT.md

- 部署架构图（ASCII）
- 环境要求（最小配置、软件要求）
- 前置准备清单（12 项）
- 部署步骤详解（第 1-10 步，含代码示例）
  - SSH 连接
  - 安装 Docker/Compose（Ubuntu 和 Amazon Linux 2）
  - 克隆仓库
  - 配置 .env（生产示例）
  - 启动 Docker Compose
  - 初始化数据库
  - 配置 Nginx 反向代理
  - 验证部署
  - 日志收集与监控
  - 备份恢复
- 滚动更新与无宕机部署（蓝绿部署、金丝雀部署）
- 故障恢复（应用崩溃、数据库失败、Redis 不可用等 5 种）
- 性能优化（数据库、Redis、应用）
- 安全加固（网络隔离、防火墙、SSL 续期、依赖更新）
- 监控告警（关键指标表、CloudWatch 示例）

**总计**：579 行

### docs/API.md

- 认证与授权（权限格式、预置 13 个权限表、公开端点）
- 认证端点详解（login、refresh、logout、2FA 三步流程）
- 运营账号端点（CRUD，含完整 curl 示例）
- RBAC 端点（角色、权限的创建和查询）
- 审计日志端点（查询、敏感字段脱敏说明）
- 功能开关端点
- 远程配置端点
- 公告端点
- 异步任务端点
- 健康检查端点
- 错误响应格式（状态码、常见错误码表）
- 限流政策表
- SDK 客户端库（JavaScript/TypeScript、Python 示例）

**总计**：955 行

### docs/ARCHITECTURE.md

- 分层架构图与说明
- 请求流程图（9 步）
- 权限检查机制图（7 步）
- 认证机制深度解析
  - JWT Token 结构
  - Token 轮换流程
  - 2FA 流程
- 审计日志机制
  - 拦截流程
  - 脱敏规则
- 缓存策略
  - Redis 缓存键设计
  - 缓存失效策略
- 故障排查（7 个问题 + 诊断步骤）
  - 登录 401、403、迁移失败、Redis 超时、JWT_SECRET、审计脱敏、性能
- 安全加固检查清单（12 项）
- 监控关键指标（3 个命令示例）

**总计**：518 行

## 核心概念速查

### 权限系统

- 格式：`resource:action`（如 `feature_flag:read`）
- 预置 13 个权限，分配给 2 个预置角色
- superadmin：全权限（短路权限检查）
- operator：只读子集 + 审计日志读

### 认证流程

```
登录 → JWT access + refresh tokens
→ 若需 2FA → 完成 TOTP 验证
→ 后续使用 accessToken (15m)
→ 过期时用 refreshToken 轮换 (7d)
→ 登出时撤销 refreshToken
```

### 全局 Guard 链

1. ThrottlerGuard（限流：60 req/min，/auth/login 5 req/60s）
2. JwtAuthGuard（JWT 验证，检查 @Public）
3. PermissionsGuard（细粒度权限，检查 @RequirePermission）

### 审计拦截

- 自动记录所有 POST/PUT/PATCH/DELETE
- 脱敏：password、refreshToken、secret、token
- 异步写入 audit_logs 表

## 常见命令

```bash
# 开发
npm install
npm run start:dev
npm test

# Docker
docker compose up -d
docker compose logs -f app
docker compose exec app npm run prisma:seed:prod

# 生产部署
docker compose up -d --build
curl https://ops.catwallet.com/health

# 故障排查
docker compose exec postgres psql -U ops -d catwallet_ops -c "SELECT * FROM ops_users;"
docker compose exec redis redis-cli DEL "perms:*"
```

## 文件变更历史

- **README.md**：从 135 行更新到 659 行（增加 484 行详细内容）
- **docs/DEPLOYMENT.md**：新建，579 行
- **docs/API.md**：新建，955 行
- **docs/ARCHITECTURE.md**：新建，518 行

**总新增**：2,193 行文档

## 如何贡献文档

1. 修改或新增 .md 文件
2. 验证所有代码示例可正常运行
3. 确保格式遵循 Markdown 最佳实践
4. 提交 PR 进行审查

---

**最后更新**：2026-06-18  
**文档版本**：1.0  
**覆盖产品版本**：0.1.0（阶段 0-3 完成，AWS EC2 生产验证通过）
