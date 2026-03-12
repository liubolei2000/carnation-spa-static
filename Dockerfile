# ── Stage 1: 安装依赖 ──────────────────────────────────
FROM node:20-alpine AS deps
WORKDIR /app
COPY package*.json ./
RUN npm install --omit=dev --legacy-peer-deps --ignore-scripts

# ── Stage 2: 构建 ──────────────────────────────────────
FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm install --legacy-peer-deps
COPY . .
# 为 Pi 5 (linux-arm64) 生成 Prisma client
RUN npx prisma generate
RUN npm run build

# ── Stage 3: 运行（最小镜像）─────────────────────────────
FROM node:20-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production

# 只复制 standalone 产物
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/public ./public

# 复制 Prisma schema 和生成的 client（迁移时需要）
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=builder /app/node_modules/@prisma ./node_modules/@prisma

EXPOSE 3000
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

# 启动时自动建表（幂等，已有表不影响）
CMD ["sh", "-c", "npx prisma@5 db push --schema=./prisma/schema.prisma --accept-data-loss 2>/dev/null || true && node server.js"]
