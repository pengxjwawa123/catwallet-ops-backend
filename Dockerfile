# ─────────────────────────────────────────────────────────────────────────────
# Stage 1: deps — install ALL dependencies (including dev) for the build step
# ─────────────────────────────────────────────────────────────────────────────
FROM node:22-alpine AS deps

WORKDIR /app

# Install OS-level build deps (argon2 native binding) + OpenSSL for Prisma engine
RUN apk add --no-cache python3 make g++ openssl libc6-compat

COPY package*.json ./
COPY prisma ./prisma/

RUN npm ci

# ─────────────────────────────────────────────────────────────────────────────
# Stage 2: build — compile TypeScript and generate Prisma client
# ─────────────────────────────────────────────────────────────────────────────
FROM node:22-alpine AS build

WORKDIR /app

# OpenSSL needed for `prisma generate`
RUN apk add --no-cache openssl libc6-compat

COPY --from=deps /app/node_modules ./node_modules
COPY . .

RUN npx prisma generate
RUN npm run build

# ─────────────────────────────────────────────────────────────────────────────
# Stage 3: runtime — lean production image
# ─────────────────────────────────────────────────────────────────────────────
FROM node:22-alpine AS runtime

WORKDIR /app

ENV NODE_ENV=production

# OpenSSL needed for Prisma engine at runtime (db push / migrate deploy / queries)
RUN apk add --no-cache openssl libc6-compat

# Reuse the already-installed & compiled node_modules from the build stage
# instead of running `npm ci` again. This avoids recompiling native modules
# (argon2) at this stage, which lacks the build toolchain (python3/make/g++).
COPY package*.json ./
COPY prisma ./prisma/
COPY --from=build /app/node_modules ./node_modules

# The Prisma client was already generated in the build stage and copied over
# with node_modules above. Regenerate BEFORE pruning (the `prisma` CLI is a
# devDependency, so it must still be present), then drop dev-only deps. Neither
# step recompiles native modules, so no build toolchain is needed here.
RUN npx prisma generate && npm prune --omit=dev

# Copy compiled output from the build stage
COPY --from=build /app/dist ./dist

# Copy entrypoint script
COPY docker-entrypoint.sh ./docker-entrypoint.sh
RUN chmod +x ./docker-entrypoint.sh

EXPOSE 3000

# docker-entrypoint.sh runs `prisma migrate deploy` then starts the app.
# To skip migrations (e.g. in CI smoke tests) set SKIP_MIGRATIONS=true.
ENTRYPOINT ["./docker-entrypoint.sh"]
CMD ["node", "dist/main"]
