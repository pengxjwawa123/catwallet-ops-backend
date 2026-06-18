# ── Stage 1: build ──────────────────────────────────────────────
FROM node:22-alpine AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
# 前端通过相对路径 /api 调用后端,由 nginx 反代,避免 CORS 与 IP 硬编码
ENV VITE_API_BASE_URL=/api
RUN npm run build

# ── Stage 2: nginx 托管 ─────────────────────────────────────────
FROM nginx:1.27-alpine AS runtime
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
