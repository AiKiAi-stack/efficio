#!/bin/bash

# =============================================================================
# 修复 npm install 错误
# 用于解决 "Missing: @vercel/ncc from lock file" 等问题
# =============================================================================

set -e

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

echo "=============================================="
echo "修复 npm package-lock.json 问题"
echo "=============================================="

# 进入 server 目录
cd "$(dirname "$0")/../server"

log_info "删除旧的 lock文件..."
rm -f package-lock.json

log_info "删除 node_modules..."
rm -rf node_modules

log_info "重新安装依赖..."
npm install

log_success "修复完成！"
echo ""
echo "现在可以运行："
echo "  npm run build    - 构建项目"
echo "  npm start        - 启动服务"
echo "  npm run dev      - 开发模式"
