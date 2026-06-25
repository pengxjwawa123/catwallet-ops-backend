# ── Stage 1: build ──────────────────────────────────────────────
FROM node:22-alpine AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
ARG VITE_API_BASE_URL=/api
ARG VITE_I18N_API_BASE_URL=https://dev.api.catwallet.ai/gt/wallet/api/i18n/config
# 普通后台 API 继续走 /api 反代；i18n 直连独立 CatWallet API。
ENV VITE_API_BASE_URL=${VITE_API_BASE_URL}
ENV VITE_I18N_API_BASE_URL=${VITE_I18N_API_BASE_URL}
RUN npm run build

# ── Stage 2: nginx 托管 ─────────────────────────────────────────
FROM nginx:1.27-alpine AS runtime
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
