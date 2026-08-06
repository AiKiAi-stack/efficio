#!/usr/bin/env bash
# =============================================================================
# Efficio 一键安装脚本
#
# 安装 root / server / client 三个子项目的全部依赖（仓库是三个独立 npm 项目，
# 根目录 npm install 不会装子项目依赖 —— 本脚本解决这个问题）
#
# 自动检测 npm 源速度：官方源慢或不可达时自动使用 npmmirror 镜像，
# 仅对本安装生效，不修改全局 npm 配置。
#
# 用法:
#   bash scripts/install.sh             # 自动检测源
#   bash scripts/install.sh --mirror    # 强制使用 npmmirror
#   bash scripts/install.sh --no-mirror # 强制使用官方源
#   npm run setup                       # 等价于第一个
# =============================================================================

set -euo pipefail

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

log_info()    { echo -e "${BLUE}[INFO]${NC} $1"; }
log_success() { echo -e "${GREEN}[SUCCESS]${NC} $1"; }
log_warning() { echo -e "${YELLOW}[WARNING]${NC} $1"; }
log_error()   { echo -e "${RED}[ERROR]${NC} $1"; }

MIRROR="https://registry.npmmirror.com"
USE_MIRROR="auto"

for arg in "$@"; do
  case "$arg" in
    --mirror)    USE_MIRROR="yes" ;;
    --no-mirror) USE_MIRROR="no" ;;
    --help|-h)
      echo "用法: bash scripts/install.sh [--mirror|--no-mirror]"
      exit 0
      ;;
  esac
done

# ---------- 环境检查 ----------
if ! command -v node >/dev/null 2>&1; then
  log_error "未找到 Node.js，请先安装 Node.js 20+（推荐 https://nodejs.org 或 nvm）"
  exit 1
fi
if ! command -v npm >/dev/null 2>&1; then
  log_error "未找到 npm"
  exit 1
fi

NODE_MAJOR=$(node -v | sed 's/^v\([0-9]*\).*/\1/')
if [[ "$NODE_MAJOR" -lt 18 ]]; then
  log_error "Node.js >= 18 是必需的，当前 $(node -v)"
  exit 1
fi
log_info "Node.js $(node -v) / npm $(npm -v)"

# ---------- npm 源检测 ----------
detect_registry() {
  local registry
  registry=$(npm config get registry)

  if [[ "$USE_MIRROR" == "yes" ]]; then
    log_info "使用 npmmirror 镜像: $MIRROR"
    echo "$MIRROR"
    return
  fi
  if [[ "$USE_MIRROR" == "no" ]]; then
    log_info "使用配置的 npm 源: $registry"
    echo "$registry"
    return
  fi
  if [[ "$registry" == *npmmirror* ]]; then
    log_info "已配置 npmmirror 源: $registry"
    echo "$registry"
    return
  fi

  # 测速：请求官方源，3 秒超时
  if command -v curl >/dev/null 2>&1; then
    local start_ms end_ms cost_ms
    start_ms=$(date +%s%N)
    if curl -s -m 3 -o /dev/null -w '%{http_code}' "$registry/-/ping" 2>/dev/null | grep -q 200; then
      end_ms=$(date +%s%N)
      cost_ms=$(( (end_ms - start_ms) / 1000000 ))
      if [[ "$cost_ms" -gt 1500 ]]; then
        log_warning "官方源响应 ${cost_ms}ms（较慢），本次安装改用 npmmirror 镜像加速"
        echo "$MIRROR"
      else
        log_info "官方源响应 ${cost_ms}ms，使用官方源"
        echo "$registry"
      fi
    else
      log_warning "官方源不可达，本次安装改用 npmmirror 镜像"
      echo "$MIRROR"
    fi
  else
    log_warning "未找到 curl，无法测速，继续使用当前源: $registry"
    echo "$registry"
  fi
}

REGISTRY=$(detect_registry)
CURRENT_REGISTRY=$(npm config get registry)
REGISTRY_ARGS=()
if [[ "$REGISTRY" != "$CURRENT_REGISTRY" ]]; then
  REGISTRY_ARGS=(--registry "$REGISTRY")
fi

PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

# ---------- 安装依赖 ----------
install_deps() {
  local dir="$1"
  log_info "安装依赖: $dir"
  cd "$PROJECT_ROOT/$dir"
  if [[ -f package-lock.json ]]; then
    if ! npm ci --no-audit --no-fund "${REGISTRY_ARGS[@]}" 2>/dev/null; then
      log_warning "$dir: npm ci 失败（lockfile 可能过期），回退到 npm install"
      npm install --no-audit --no-fund "${REGISTRY_ARGS[@]}"
    fi
  else
    npm install --no-audit --no-fund "${REGISTRY_ARGS[@]}"
  fi
}

install_deps "."
install_deps "server"
install_deps "client"

log_success "全部依赖安装完成！"
echo ""
echo "接下来你可以："
echo "  开发模式:     npm run dev          (前端 http://localhost:5173，后端 http://localhost:3001)"
echo "  生产模式:     npm run build && npm start"
echo "  Docker 部署:  cp .env.example .env && docker-compose up -d --build"
echo "  二进制打包:   cd server && npm run build:binary"
echo ""
echo "配置 AI Provider：启动后打开 http://localhost:3001 → 设置页，"
echo "或编辑 server/.env（参考 server/.env.example，国内推荐 DeepSeek/智谱/Kimi/通义/火山）"
