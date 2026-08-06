# syntax=docker/dockerfile:1
# 多阶段构建：源码构建阶段 + 生产运行阶段
# 使用 npm（与本地开发 / GitHub CI 一致）。仓库没有 pnpm-lock.yaml，
# 原 pnpm 方案会导致构建失败，故移除。
# 构建阶段安装了编译工具链，确保 better-sqlite3 在无法下载预编译二进制
# （GitHub 被墙）时能本地编译，构建不依赖外网可达性。

# ---------- 构建阶段 ----------
FROM node:20-alpine AS builder

WORKDIR /app

# 国内网络加速（如需官方源可注释掉）
ENV npm_config_registry=https://registry.npmmirror.com
# 注意：不给 better-sqlite3 设置二进制镜像 —— 预编译产物是 glibc 版，
# 在 alpine(musl) 里无法加载（缺 ld-linux-x86-64.so.2）。
# 依赖下方编译工具链在构建期本地编译 musl 版本。

# 编译工具链：better-sqlite3 在 alpine 上必须本地编译（预编译产物是 glibc 的），
# 需要 python3/make/g++ 和 musl 头文件（musl-dev）
# apk 使用阿里云镜像（官方源 dl-cdn.alpinelinux.org 在国内慢/不通）
RUN sed -i 's|https://dl-cdn.alpinelinux.org|https://mirrors.aliyun.com|g' /etc/apk/repositories \
 && apk add --no-cache python3 make g++ musl-dev

# 先复制依赖清单，充分利用 Docker 层缓存
COPY package.json package-lock.json ./
COPY server/package.json server/package-lock.json ./server/
COPY client/package.json client/package-lock.json ./client/

# 安装三个子项目的依赖
RUN npm ci --no-audit --no-fund \
 && cd server && npm ci --no-audit --no-fund \
 && cd ../client && npm ci --no-audit --no-fund

# 复制源码（.dockerignore 已排除 node_modules/dist/.env/data）
COPY server ./server
COPY client ./client

# 构建服务端和前端
RUN cd server && npm run build \
 && cd ../client && npm run build

# 移除开发依赖，缩小运行镜像体积
RUN cd server && npm prune --omit=dev --no-audit --no-fund

# ---------- 生产阶段 ----------
FROM node:20-alpine

WORKDIR /app

ENV NODE_ENV=production
# 单线程运行，节省内存
ENV NODE_OPTIONS="--max-old-space-size=256"

# SQLite 数据目录（docker-compose 将卷挂载到 /app/data）
RUN mkdir -p /app/data

# 复制构建产物与生产依赖（依赖从构建阶段带过来，避免运行阶段二次编译原生模块）
COPY --from=builder /app/server/dist ./server/dist
COPY --from=builder /app/server/node_modules ./server/node_modules
COPY --from=builder /app/server/sql ./server/sql
COPY --from=builder /app/client/dist ./client/dist

# 健康检查
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:3001/health || exit 1

EXPOSE 3001

CMD ["node", "server/dist/cli.js"]
