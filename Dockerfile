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

# Install only production dependencies (no dev tooling)
COPY package*.json ./
COPY prisma ./prisma/

RUN npm ci --omit=dev && npx prisma generate

# Copy compiled output from the build stage
COPY --from=build /app/dist ./dist

# Copy entrypoint script
COPY docker-entrypoint.sh ./docker-entrypoint.sh
RUN chmod +x ./docker-entrypoint.sh

EXPOSE 3000

# docker-entrypoint.sh runs `prisma migrate deploy` then starts the app.
# To skip migrations (e.g. in CI smoke tests) set SKIP_MIGRATIONS=true.
ENTRYPOINT ["./docker-entrypoint.sh"]
CMD ["node", "dist/apps/api/src/main"]
