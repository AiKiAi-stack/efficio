# 多阶段构建 - 优化镜像大小
FROM node:20-alpine AS builder

WORKDIR /app

# 安装 pnpm（更节省空间）
RUN corepack enable && corepack prepare pnpm@latest --activate

# 复制 package.json
COPY package.json ./
COPY server/package.json ./server/
COPY client/package.json ./client/

# 安装依赖
RUN pnpm install --frozen-lockfile || pnpm install

# 复制源码
COPY server ./server
COPY client ./client

# 构建服务端
WORKDIR /app/server
RUN pnpm build

# 构建客户端
WORKDIR /app/client
RUN pnpm build

# 生产阶段
FROM node:20-alpine

WORKDIR /app

# 安装 pnpm
RUN corepack enable && corepack prepare pnpm@latest --activate

# 只复制生产依赖
COPY package.json ./
COPY server/package.json ./server/
COPY server/dist ./server/dist
COPY server/node_modules ./server/node_modules

# 复制构建好的客户端
COPY client/dist ./client/dist

# 健康检查
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:3001/health || exit 1

EXPOSE 3001

ENV NODE_ENV=production

# 单线程运行，节省内存
ENV NODE_OPTIONS="--max-old-space-size=256"

CMD ["sh", "-c", "cd server && node dist/index.js"]
