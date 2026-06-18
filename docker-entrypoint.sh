#!/bin/sh
set -e

# 数据库 schema 同步:
# - 若存在迁移文件(prisma/migrations/),用 migrate deploy 应用(生产标准做法)
# - 若无迁移文件(首次/开发联调),用 db push 直接同步 schema 建表
# 设 SKIP_MIGRATIONS=true 可跳过(用于 smoke-test 容器)。
if [ "${SKIP_MIGRATIONS}" != "true" ]; then
  if [ -d "prisma/migrations" ] && [ -n "$(ls -A prisma/migrations 2>/dev/null)" ]; then
    echo "[entrypoint] Found migrations — running prisma migrate deploy..."
    npx prisma migrate deploy
  else
    echo "[entrypoint] No migrations found — running prisma db push..."
    npx prisma db push --skip-generate
  fi
fi

echo "[entrypoint] Starting application: $*"
exec "$@"
