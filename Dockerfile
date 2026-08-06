# syntax=docker/dockerfile:1
# 多阶段构建：源码构建阶段 + 生产运行阶段
# 使用 node:20-slim（Debian/glibc）而非 alpine：
#   - better-sqlite3 的预编译二进制是 glibc 版，alpine(musl) 无法加载
#   - node-gyp 在 alpine 上要从 unofficial-builds.nodejs.org 拉取 musl 头文件（国内不通）
# 使用 npm（与本地开发 / GitHub CI 一致），仓库无 pnpm-lock.yaml

# ---------- 构建阶段 ----------
FROM node:20-slim AS builder

WORKDIR /app

# 国内网络加速（如需官方源可注释掉）
ENV npm_config_registry=https://registry.npmmirror.com
# better-sqlite3 预编译二进制（glibc）走 npmmirror 镜像
ENV npm_config_better_sqlite3_binary_host_mirror=https://registry.npmmirror.com/-/binary/better-sqlite3
# node-gyp 编译所需的 Node 头文件走 npmmirror（官方 nodejs.org/dist 国内慢）
ENV npm_config_disturl=https://registry.npmmirror.com/-/binary/node

# 编译工具链（预编译二进制下载失败时的回退路径）
# apt 使用阿里云镜像（官方 deb.debian.org 在国内慢/不通）
RUN sed -i 's|deb.debian.org|mirrors.aliyun.com|g' /etc/apt/sources.list.d/debian.sources \
 && apt-get update \
 && apt-get install -y --no-install-recommends python3 make g++ \
 && rm -rf /var/lib/apt/lists/*

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
FROM node:20-slim

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

# 健康检查（用 node 自身探测，避免依赖 wget/curl）
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD ["node", "-e", "fetch('http://localhost:3001/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"]

EXPOSE 3001

CMD ["node", "server/dist/cli.js"]
