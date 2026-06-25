# CatWallet Admin Web

CatWallet 运营后台前端，基于 Vite + React 18 + TypeScript + Ant Design 5 构建。

## 快速启动

```bash
# 安装依赖
npm install

# 开发模式（默认 http://localhost:8080）
npm run dev

# 生产构建
npm run build

# 预览构建产物
npm run preview
```

## 环境变量

`.env` 文件中配置后端地址：

```
VITE_API_BASE_URL=http://localhost:3001
VITE_I18N_API_BASE_URL=https://dev.api.catwallet.ai/gt/wallet/api/i18n/config
```

其中普通后台接口继续走 `VITE_API_BASE_URL`；国际化管理页直连 `VITE_I18N_API_BASE_URL`。

## 技术栈

- **框架**: React 18 + TypeScript + Vite 5
- **UI**: Ant Design 5 + @ant-design/pro-components (ProTable/ProForm)
- **路由**: react-router-dom v6
- **HTTP**: axios（自动 Bearer 注入、统一解包 `.data`、401 自动刷新 token）
- **i18n**: react-i18next，中英双语，默认中文，顶部切换

## 目录结构

```
src/
├── api/          # axios 封装 + 所有 API 函数
├── components/   # 公共组件（Setup2FAModal 等）
├── hooks/        # useAuth（AuthContext + JWT 解析）
├── layouts/      # MainLayout（侧边菜单 + 顶部栏）
├── locales/      # i18n（zh-CN.json / en-US.json）
├── pages/        # 各功能页面
│   ├── login/
│   ├── dashboard/
│   ├── ops-users/
│   ├── rbac/
│   ├── audit-logs/
│   ├── feature-flags/
│   ├── remote-configs/
│   ├── announcements/
│   └── jobs/
├── router/       # AppRouter + RequireAuth 路由守卫
└── utils/        # types.ts / jwt.ts / storage.ts
```

## 鉴权流程

1. 登录 `POST /auth/login`，若 `requires2FA=true` 则进入第二步 TOTP 验证
2. Token 存储于 `localStorage`，axios 拦截器自动附加 `Authorization: Bearer`
3. 401 时自动调用 `POST /auth/refresh` 轮换 token，失败则跳登录页
4. 解析 JWT payload 中的 `roles` 字段，按权限控制菜单显隐

## 页面列表

| 路由 | 页面 | 权限 |
|------|------|------|
| /dashboard | 仪表盘 | 所有登录用户 |
| /ops-users | 运营账号管理 | ops_user:read |
| /rbac/roles | 角色管理 | rbac:manage |
| /rbac/permissions | 权限列表 | rbac:manage |
| /audit-logs | 审计日志 | audit:read |
| /feature-flags | 功能开关 | feature_flag:read |
| /remote-configs | 远程配置 | remote_config:read |
| /announcements | 公告管理 | announcement:read |
| /jobs | 任务队列 | 所有登录用户（入队仅 superadmin）|
