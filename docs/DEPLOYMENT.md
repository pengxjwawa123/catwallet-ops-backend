# 部署指南

生产环境部署 CatWallet 运营后台后端的详细步骤。

## 部署架构

```
┌─────────────┐
│   Clients   │
└──────┬──────┘
       │ HTTPS
       ▼
┌─────────────────────┐
│  Nginx / Load       │
│  Balancer           │
│  (反向代理)         │
└──────┬──────────────┘
       │ HTTP:3000
       ▼
┌──────────────────────────────────────┐
│  Docker Container (app)              │
│  ├─ NestJS Application               │
│  ├─ Prisma ORM                       │
│  └─ Node.js 22                       │
└──────┬───────────────────────────────┘
       │
       ├─────────────┬──────────────────┐
       ▼             ▼                  ▼
   ┌────────┐  ┌──────────┐  ┌─────────────┐
   │ Postgre│  │  Redis   │  │ BullMQ      │
   │ SQL 16 │  │  7 或    │  │ Queue       │
   │        │  │ Cluster  │  │             │
   └────────┘  └──────────┘  └─────────────┘
```

## 环境要求

### 最小配置

- **CPU**：2 核心
- **内存**：2 GB（建议 4+ GB）
- **磁盘**：20 GB SSD
- **网络**：出站 443（HTTPS）、入站 80/443
- **操作系统**：Ubuntu 20.04 LTS+ 或 Amazon Linux 2+

### 软件要求

- **Docker**：≥20.10
- **Docker Compose**：≥2.0
- **PostgreSQL**：16（RDS 或自建）
- **Redis**：7（ElastiCache 或自建）
- **SSL 证书**：Let's Encrypt 或商业 CA

## 前置准备清单

```bash
☐ 申请 AWS EC2 实例（或其他云主机）
☐ 配置 VPC、安全组、网络策略
☐ 申请或配置 PostgreSQL 16（RDS 或 Compute Engine）
☐ 申请或配置 Redis 7（ElastiCache 或 Compute Engine）
☐ 申请域名和 SSL 证书
☐ 配置 DNS 解析指向 EC2 实例
☐ 准备强密码和 JWT_SECRET（32+ 字符）
☐ 配置监控告警（CloudWatch、Datadog 等）
☐ 备份策略（RDS 自动备份、Redis AOF）
```

## 部署步骤

### 第 1 步：SSH 连接到服务器

```bash
ssh -i /path/to/key.pem ec2-user@<instance-public-ip>
# 或
ssh -i /path/to/key.pem ubuntu@<instance-public-ip>
```

### 第 2 步：安装 Docker 和 Docker Compose

**Ubuntu 20.04+：**
```bash
sudo apt update && sudo apt install -y docker.io docker-compose git curl

sudo systemctl start docker
sudo systemctl enable docker

# 将当前用户加入 docker group（重新登录后生效）
sudo usermod -aG docker $USER
```

**Amazon Linux 2：**
```bash
sudo yum install -y docker git curl

# 安装 Docker Compose
sudo curl -L "https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
sudo chmod +x /usr/local/bin/docker-compose

sudo systemctl start docker
sudo systemctl enable docker

sudo usermod -aG docker ec2-user
```

验证安装：
```bash
docker --version
docker-compose --version
```

### 第 3 步：克隆仓库

```bash
cd /opt  # 或选择其他目录
git clone https://github.com/your-org/catwallet-ops-backend.git
cd catwallet-ops-backend
```

### 第 4 步：配置环境变量

```bash
cp .env.example .env
```

编辑 `.env`，设置生产参数：

```bash
cat > .env << 'EOF'
# ─── 应用 ─────────────────────────────────────────────────────────
NODE_ENV=production
PORT=3000
APP_PORT=80                    # 宿主机 80（或 8080）
CORS_ORIGIN=https://ops.catwallet.com

# ─── 数据库 ───────────────────────────────────────────────────────
# 例：AWS RDS PostgreSQL
DATABASE_URL=postgresql://ops_user:StrongPassword123@prod-db.xxxxx.rds.amazonaws.com:5432/catwallet_ops?schema=public&sslmode=require

POSTGRES_USER=ops_user
POSTGRES_PASSWORD=StrongPassword123
POSTGRES_DB=catwallet_ops

# ─── Redis ────────────────────────────────────────────────────────
# 例：AWS ElastiCache
REDIS_URL=redis://prod-redis.xxxxx.ng.0001.apse1.cache.amazonaws.com:6379

# ─── JWT ──────────────────────────────────────────────────────────
# 使用强随机值（32+ 字符）
JWT_SECRET=your-super-long-random-secret-generated-by-openssl-rand

JWT_ACCESS_EXPIRY=15m
JWT_REFRESH_EXPIRY=7d

# ─── Seed ─────────────────────────────────────────────────────────
SEED_ADMIN_USERNAME=admin
SEED_ADMIN_PASSWORD=YourAdminPassword123!@#

# ─── 可观测性 ─────────────────────────────────────────────────────
SENTRY_DSN=https://your-sentry-key@your-sentry-domain/project-id
EOF
```

**生成 JWT_SECRET：**
```bash
openssl rand -base64 32
# 或
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
```

### 第 5 步：若使用自建 PostgreSQL/Redis，启动全栈

若 PostgreSQL 和 Redis 已在 RDS/ElastiCache，仅启动应用容器：

```bash
docker-compose up -d app
```

若本地自建（仅用于测试/开发环境）：

```bash
docker-compose up -d
```

验证容器：
```bash
docker-compose ps
```

### 第 6 步：初始化数据库

应用启动时 `docker-entrypoint.sh` 会自动运行迁移。若需手动触发或重新 seed：

```bash
# 查看应用日志，确认迁移成功
docker-compose logs -f app

# 手动重新 seed（首次或重置）
docker-compose exec -e SEED_ADMIN_PASSWORD='YourAdminPassword123!@#' app npm run prisma:seed:prod
```

### 第 7 步：配置反向代理（Nginx）

若需 HTTPS 和负载均衡，使用 Nginx：

**安装 Nginx：**
```bash
sudo apt install -y nginx
# 或
sudo yum install -y nginx
```

**配置 Nginx（/etc/nginx/sites-available/catwallet-ops 或 /etc/nginx/conf.d/catwallet-ops.conf）：**

```nginx
upstream app_backend {
    server 127.0.0.1:3000;
}

server {
    listen 80;
    server_name ops.catwallet.com;

    # 重定向 HTTP 到 HTTPS
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name ops.catwallet.com;

    # SSL 证书配置（Let's Encrypt）
    ssl_certificate /etc/letsencrypt/live/ops.catwallet.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/ops.catwallet.com/privkey.pem;
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers HIGH:!aNULL:!MD5;
    ssl_prefer_server_ciphers on;

    # 日志
    access_log /var/log/nginx/catwallet-ops-access.log;
    error_log /var/log/nginx/catwallet-ops-error.log;

    # 允许大文件上传(如 App 更新包 .apk)。不设置时 nginx 默认仅 1MB,
    # 上传较大安装包会被这一层直接以 413 Request Entity Too Large 拒绝。
    # 需 >= 后端 multer 限制(500MB),这里留余量。
    client_max_body_size 600m;

    # 代理配置
    location / {
        proxy_pass http://app_backend;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;

        # 超时配置。大文件上传慢,send/read 放到 300s;并关闭请求体缓冲
        # 以便边收边转发,避免大包先落盘再转发。
        proxy_request_buffering off;
        proxy_connect_timeout 60s;
        proxy_send_timeout 300s;
        proxy_read_timeout 300s;
    }

    # WebSocket 支持（若需）
    location /ws {
        proxy_pass http://app_backend;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
    }
}
```

**启用站点并重载 Nginx：**
```bash
sudo ln -s /etc/nginx/sites-available/catwallet-ops /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx
```

**配置 Let's Encrypt SSL（Certbot）：**
```bash
sudo apt install -y certbot python3-certbot-nginx
sudo certbot certonly --nginx -d ops.catwallet.com
```

### 第 8 步：验证部署

```bash
# 健康检查
curl -s https://ops.catwallet.com/health | jq .

# 登录测试
curl -X POST https://ops.catwallet.com/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"YourAdminPassword123!@#"}'

# 访问 Swagger 文档
# https://ops.catwallet.com/docs
```

### 第 9 步：设置日志收集与监控

**本地日志查看：**
```bash
# 实时应用日志
docker-compose logs -f app

# 导出日志到文件
docker-compose logs app > /var/log/catwallet-ops-$(date +%Y%m%d).log
```

**配置日志轮转（logrotate）：**
```bash
sudo tee /etc/logrotate.d/catwallet-ops > /dev/null << 'EOF'
/var/log/catwallet-ops-*.log {
    daily
    rotate 30
    compress
    delaycompress
    missingok
    notifempty
    create 0640 root root
}
EOF
```

**集成 Sentry（错误追踪）：**
1. 在 Sentry.io 创建项目
2. 获取 DSN，填入 `.env` 的 `SENTRY_DSN`
3. 重启应用

**集成 CloudWatch（AWS）：**
```bash
# 安装 CloudWatch 代理
sudo yum install -y amazon-cloudwatch-agent

# 配置 Docker 日志驱动
# 修改 /etc/docker/daemon.json
{
  "log-driver": "awslogs",
  "log-opts": {
    "awslogs-group": "/catwallet/ops-backend",
    "awslogs-region": "us-east-1",
    "awslogs-stream-prefix": "app"
  }
}

sudo systemctl restart docker
```

### 第 10 步：配置备份和恢复

**PostgreSQL RDS 自动备份（AWS Console 配置）：**
- 备份保留期：30 天
- 备份窗口：02:00-03:00 UTC（避免业务高峰）
- 多 AZ 部署（生产推荐）

**手动备份 PostgreSQL：**
```bash
# 本地自建 PostgreSQL
docker-compose exec postgres pg_dump -U ops catwallet_ops > backup-$(date +%Y%m%d-%H%M%S).sql

# 恢复
docker-compose exec -T postgres psql -U ops catwallet_ops < backup-20260618.sql
```

**Redis 持久化配置（docker-compose.yml）：**
```yaml
redis:
  image: redis:7-alpine
  command: redis-server --appendonly yes  # 启用 AOF 持久化
  volumes:
    - redis_data:/data  # 持久化路径
```

## 滚动更新与无宕机部署

### 蓝绿部署

1. 启动新版本容器（绿色）：
   ```bash
   # 编辑 docker-compose.yml，创建新服务 app-v2
   docker-compose up -d app-v2
   
   # 等待健康检查通过
   docker-compose exec app-v2 curl localhost:3000/health
   ```

2. 更新 Nginx 指向新服务：
   ```nginx
   upstream app_backend {
       server 127.0.0.1:3001;  # 指向 app-v2
   }
   ```

3. 重载 Nginx，验证新版本工作正常

4. 停止旧版本（蓝色）：
   ```bash
   docker-compose stop app
   docker-compose rm app
   ```

### 金丝雀部署

使用 Nginx 按比例分流流量到新版本：

```nginx
upstream app_backend {
    server 127.0.0.1:3000 weight=90;   # 旧版本 90%
    server 127.0.0.1:3001 weight=10;   # 新版本 10%
}
```

逐步增加权重，完全切换后下线旧版本。

## 故障恢复

### 应用崩溃

```bash
# 查看错误日志
docker-compose logs app | tail -50

# 重启应用
docker-compose restart app

# 若重启失败，检查 JWT_SECRET 或数据库连接
docker-compose logs app | grep -i "error\|invalid"
```

### 数据库连接失败

```bash
# 测试数据库连接
docker-compose exec app npm run typecheck

# 验证 DATABASE_URL
echo $DATABASE_URL

# 若使用 RDS，检查安全组规则允许出站到 5432
# 若使用本地 PostgreSQL，检查容器网络连通性
docker-compose exec app ping postgres
```

### Redis 不可用

```bash
# 检查 Redis 连接
docker-compose exec redis redis-cli ping

# 清空 Redis（若缓存数据不重要）
docker-compose exec redis redis-cli FLUSHALL

# 重启 Redis
docker-compose restart redis
```

### 权限问题导致 403

```bash
# 清除权限缓存，强制重新加载
docker-compose exec redis redis-cli DEL "perms:*"

# 验证用户角色和权限
docker-compose exec postgres psql -U ops -d catwallet_ops -c \
  "SELECT u.username, r.name FROM ops_users u \
   LEFT JOIN ops_user_roles ur ON u.id = ur.ops_user_id \
   LEFT JOIN ops_roles r ON ur.ops_role_id = r.id;"
```

## 性能优化

### 数据库优化

```sql
-- 创建索引加速常用查询
CREATE INDEX idx_ops_users_username ON ops_users(username);
CREATE INDEX idx_audit_logs_actor_id ON audit_logs(actor_id);
CREATE INDEX idx_audit_logs_created_at ON audit_logs(created_at DESC);
CREATE INDEX idx_user_roles ON ops_user_roles(ops_user_id);
```

### Redis 优化

```bash
# 监控 Redis 内存使用
docker-compose exec redis redis-cli info memory | grep used_memory_human

# 优化权限缓存 TTL（默认 60 秒）
# 修改 apps/api/src/auth/guards/permissions.guard.ts 的 CACHE_TTL
```

### 应用调优

```bash
# 增加 Node.js 进程可打开文件数
ulimit -n 65535

# 修改 docker-compose.yml 增加内存限制
services:
  app:
    mem_limit: 2g
    memswap_limit: 2g
```

## 安全加固

### 网络隔离

```bash
# 创建私有网络，限制访问
docker network create --internal ops_private
docker-compose down
# 修改 docker-compose.yml 使用 ops_private，仅 app 暴露端口
```

### 防火墙规则

```bash
# UFW（Ubuntu）
sudo ufw default deny incoming
sudo ufw default allow outgoing
sudo ufw allow 22/tcp   # SSH
sudo ufw allow 80/tcp   # HTTP
sudo ufw allow 443/tcp  # HTTPS
sudo ufw enable
```

### SSL 证书自动续期

```bash
# Certbot 自动续期配置（cron job）
sudo systemctl enable certbot.timer
sudo systemctl start certbot.timer

# 手动续期测试
sudo certbot renew --dry-run
```

### 定期更新依赖

```bash
# 检查过期依赖
npm audit

# 更新依赖
npm update

# 重新构建镜像
docker-compose down
docker-compose up -d --build
```

## 监控告警

### 关键指标

| 指标 | 告警阈值 | 检查命令 |
|---|---|---|
| CPU 使用率 | > 80% | `docker stats` |
| 内存使用率 | > 85% | `docker stats` |
| 磁盘使用率 | > 90% | `df -h` |
| 响应时间 | > 1000ms | Nginx access.log |
| 错误率 | > 1% | `grep ERROR /var/log/app.log` |
| 数据库连接 | > 90% | `SELECT count(*) FROM pg_stat_activity` |

### 设置告警（CloudWatch 示例）

```bash
# CPU > 80%
aws cloudwatch put-metric-alarm \
  --alarm-name ops-backend-high-cpu \
  --alarm-actions arn:aws:sns:us-east-1:123456789:alerts \
  --metric-name CPUUtilization \
  --namespace AWS/EC2 \
  --statistic Average \
  --period 300 \
  --threshold 80 \
  --comparison-operator GreaterThanThreshold
```

---

**最后更新**：2026-06-18  
**版本**：1.0
