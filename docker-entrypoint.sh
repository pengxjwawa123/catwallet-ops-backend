#!/bin/sh
set -e

# Run Prisma migrations before starting the application.
# Set SKIP_MIGRATIONS=true to bypass (useful in smoke-test containers).
if [ "${SKIP_MIGRATIONS}" != "true" ]; then
  echo "[entrypoint] Running prisma migrate deploy..."
  npx prisma migrate deploy
fi

echo "[entrypoint] Starting application: $*"
exec "$@"
