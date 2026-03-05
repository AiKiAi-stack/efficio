#!/bin/bash

# =============================================================================
# Efficio VPS 部署脚本
# 适用配置：1GB 内存 / 1 核心 / 5GB SSD
# =============================================================================

set -e

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo_info() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

echo_warn() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

echo_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# 检查是否为 root 用户
if [ "$EUID" -ne 0 ]; then
    echo_error "请使用 sudo 运行此脚本"
    exit 1
fi

# =============================================================================
# 1. 系统更新和基础依赖安装
# =============================================================================
echo_info "步骤 1: 更新系统并安装基础依赖..."

apt-get update -y
apt-get upgrade -y
apt-get install -y curl git build-essential ufw

# =============================================================================
# 2. 安装 Node.js 20 LTS
# =============================================================================
echo_info "步骤 2: 安装 Node.js 20 LTS..."

# 检查是否已安装 Node.js
if command -v node &> /dev/null; then
    NODE_VERSION=$(node -v)
    echo_warn "已安装 Node.js: $NODE_VERSION"
    read -p "是否继续安装 Node.js 20? (y/N): " confirm
    if [ "$confirm" != "y" ]; then
        echo_info "跳过 Node.js 安装"
    else
        curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
        apt-get install -y nodejs
    fi
else
    curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
    apt-get install -y nodejs
fi

# 验证安装
echo_info "Node.js 版本：$(node -v)"
echo_info "npm 版本：$(npm -v)"

# =============================================================================
# 3. 安装 PM2
# =============================================================================
echo_info "步骤 3: 安装 PM2..."

npm install -g pm2
pm2 update

# =============================================================================
# 4. 克隆项目代码
# =============================================================================
echo_info "步骤 4: 克隆项目代码..."

DEPLOY_DIR="/var/www/efficio"

if [ -d "$DEPLOY_DIR" ]; then
    echo_warn "部署目录已存在：$DEPLOY_DIR"
    read -p "是否删除并重新克隆？(y/N): " confirm
    if [ "$confirm" = "y" ]; then
        rm -rf "$DEPLOY_DIR"
    else
        echo_info "跳过克隆，进入目录..."
        cd "$DEPLOY_DIR"
        git pull
    fi
fi

if [ ! -d "$DEPLOY_DIR" ]; then
    mkdir -p "$DEPLOY_DIR"
    cd "$DEPLOY_DIR"
    git clone git@github.com:AiKiAi-stack/efficio.git .
fi

# =============================================================================
# 5. 安装项目依赖
# =============================================================================
echo_info "步骤 5: 安装项目依赖..."

cd server

# 清理 node_modules（如果有）
if [ -d "node_modules" ]; then
    echo_info "清理旧的 node_modules..."
    rm -rf node_modules
fi

# 安装依赖（使用 npm ci 加速）
if [ -f "package-lock.json" ]; then
    npm ci --production
else
    npm install --production
fi

# 安装构建工具（用于 ncc 打包）
npm install --save-dev @vercel/ncc

# =============================================================================
# 6. 配置环境变量
# =============================================================================
echo_info "步骤 6: 配置环境变量..."

if [ ! -f ".env" ]; then
    cp .env.example .env
    echo_warn "请编辑 $DEPLOY_DIR/server/.env 文件配置环境变量"
    echo_info "必须配置的项目:"
    echo "  - DATABASE_MODE=sqlite"
    echo "  - AI_PROVIDER=anthropic (或其他 provider)"
    echo "  - ANTHROPIC_API_KEY=your_key"
    read -p "按回车继续..."
else
    echo_info ".env 文件已存在，跳过配置"
fi

# =============================================================================
# 7. 构建项目 (ncc 打包)
# =============================================================================
echo_info "步骤 7: 构建项目 (ncc 打包)..."

# TypeScript 编译
npm run build

# ncc 打包
npm run build:ncc

# =============================================================================
# 8. 初始化数据库
# =============================================================================
echo_info "步骤 8: 初始化数据库..."

npm run db:init || echo_warn "数据库可能已初始化，跳过"

# =============================================================================
# 9. 启动服务
# =============================================================================
echo_info "步骤 9: 启动服务..."

# 停止旧进程
pm2 stop efficio-api 2>/dev/null || true
pm2 delete efficio-api 2>/dev/null || true

# 创建日志目录
mkdir -p logs

# 启动 PM2
pm2 start ecosystem.config.js

# 保存 PM2 配置（开机自启）
pm2 save
pm2 startup

# =============================================================================
# 10. 配置防火墙
# =============================================================================
echo_info "步骤 10: 配置防火墙..."

if ! ufw status &> /dev/null; then
    echo_warn "UFW 未安装，跳过防火墙配置"
else
    ufw allow 22/tcp
    ufw allow 3001/tcp
    ufw --force enable
    echo_info "防火墙已配置：开放端口 22 (SSH) 和 3001 (API)"
fi

# =============================================================================
# 完成
# =============================================================================
echo_info "=============================================="
echo_info "部署完成！"
echo_info "=============================================="
echo_info "服务状态：pm2 status"
echo_info "查看日志：pm2 logs efficio-api"
echo_info "重启服务：pm2 restart efficio-api"
echo_info "停止服务：pm2 stop efficio-api"
echo_info ""
echo_info "API 地址：http://$(hostname -I | awk '{print $1}'):3001"
echo_info "=============================================="

# 显示 PM2 状态
pm2 status
