#!/usr/bin/env bash
# =============================================================================
# Efficio 一键运行脚本（无需 Docker，适合公司电脑等受限环境）
#
# 用法:
#   ./run.sh              默认：装依赖(如缺) → 构建(如缺) → 启动服务
#   ./run.sh --rebuild    清除构建产物并强制重建后启动
#   ./run.sh --check      自检：构建后在临时端口用内存库跑冒烟测试，通过即退出
#   ./run.sh --dev        开发模式（前端 Vite + 后端 tsx-watch 热更新）
#
# 配置:
#   环境变量或仓库根 .env（自动加载）：PORT、HOST、DATABASE_MODE、
#   SQLITE_DB_PATH、AI_PROVIDER、*_API_KEY、ALLOWED_ORIGINS 等。
#   未配置时使用安全默认值（SQLite 落在 ~/.config/efficio/ 下）。
#
# 前置要求: Node.js >= 20.19（前端 Vite 8 的硬性要求），无其他依赖。
# =============================================================================

set -euo pipefail
cd "$(dirname "$0")"

RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; BLUE='\033[0;34m'; NC='\033[0m'
log_info()    { echo -e "${BLUE}[INFO]${NC} $1"; }
log_success() { echo -e "${GREEN}[ OK ]${NC} $1"; }
log_warn()    { echo -e "${YELLOW}[WARN]${NC} $1"; }
log_error()   { echo -e "${RED}[FAIL]${NC} $1"; }

MODE="start"
case "${1:-}" in
  --rebuild) MODE="rebuild" ;;
  --check)   MODE="check" ;;
  --dev)     MODE="dev" ;;
  "")        ;;
  *) log_error "未知参数: $1（支持 --rebuild / --check / --dev）"; exit 1 ;;
esac

# ---------- 1. Node 版本检查（>= 20.19）----------
NODE_MAJOR=$(node -v 2>/dev/null | sed 's/^v\([0-9]*\).*/\1/' || echo 0)
if [ "${NODE_MAJOR:-0}" -lt 20 ]; then
  log_error "未检测到 Node.js >= 20。请先安装（https://npmmirror.com/mirrors/node 有国内镜像）。"
  exit 1
fi
NODE_MINOR=$(node -v | sed 's/^v[0-9]*\.\([0-9]*\).*/\1/')
if [ "$NODE_MAJOR" -eq 20 ] && [ "$NODE_MINOR" -lt 19 ]; then
  log_error "Node $(node -v) 过旧：Vite 8 要求 >= 20.19。请升级 Node。"
  exit 1
fi
log_success "Node $(node -v)"

# ---------- 2. 加载仓库根 .env（AI 密钥等，存在才加载） ----------
if [ -f .env ]; then
  set -a; . ./.env; set +a
  log_info "已加载 .env 配置"
fi

# ---------- 3. 安装依赖（缺失时；失败自动换 npmmirror 镜像重试） ----------
install_deps() {
  local dir="$1"
  if [ -d "$dir/node_modules" ]; then
    return 0
  fi
  log_info "安装 $dir 依赖..."
  if ! (cd "$dir" && npm ci --no-audit --no-fund); then
    log_warn "npm ci 失败，改用 npmmirror 镜像重试..."
    (cd "$dir" && npm ci --no-audit --no-fund \
      --registry=https://registry.npmmirror.com)
  fi
}

log_info "检查依赖..."
install_deps .
install_deps server
install_deps client
log_success "依赖就绪"

# ---------- 4. 构建 ----------
if [ "$MODE" = "rebuild" ]; then
  log_info "--rebuild：清除旧构建产物..."
  rm -rf server/dist client/dist
fi

NEED_BUILD=0
[ ! -f server/dist/cli.js ] && NEED_BUILD=1
[ ! -f client/dist/index.html ] && NEED_BUILD=1
if [ "$NEED_BUILD" -eq 1 ]; then
  log_info "构建服务端与前端（首次约 1-2 分钟）..."
  (cd server && npm run build --silent)
  npm run build:client --silent
fi
log_success "构建产物就绪"

# ---------- 5a. 冒烟自检（--check）：临时端口 + 内存库，不碰真实数据 ----------
if [ "$MODE" = "check" ]; then
  CHECK_PORT="${CHECK_PORT:-3990}"
  log_info "冒烟测试：127.0.0.1:${CHECK_PORT}（内存数据库）..."
  PORT="$CHECK_PORT" HOST=127.0.0.1 DATABASE_MODE=memory LOG_LEVEL=warn \
    node server/dist/cli.js &
  SMOKE_PID=$!
  trap 'kill "$SMOKE_PID" 2>/dev/null || true' EXIT

  ok=0
  for _ in $(seq 1 30); do
    body=$(node -e "
      fetch('http://127.0.0.1:${CHECK_PORT}/health')
        .then(r => r.text().then(t => console.log(r.ok ? 'OK' : 'BAD ' + t)))
        .catch(() => {})" 2>/dev/null || true)
    [ "$body" = "OK" ] && ok=1 && break
    sleep 1
  done
  if [ "$ok" -ne 1 ]; then
    log_error "/health 未通过"
    exit 1
  fi
  log_success "/health 通过"

  # API 探活：带 X-User-Id 访问当日日志（走完整中间件 + 数据库层）
  api=$(node -e "
    fetch('http://127.0.0.1:${CHECK_PORT}/api/daily-logs/today',{headers:{'x-user-id':'smoke-check'}})
      .then(r=>console.log(r.ok?'OK':'BAD '+r.status)).catch(()=>{})" 2>/dev/null || true)
  if [ "$api" != "OK" ]; then
    log_error "API 探活失败"
    exit 1
  fi
  log_success "API 探活通过"

  # 前端静态托管探活
  html=$(node -e "
    fetch('http://127.0.0.1:${CHECK_PORT}/')
      .then(r=>r.text()).then(t=>console.log(t.includes('<div id=\"root\"')||t.includes('<!doctype')?'OK':'BAD')).catch(()=>{})" 2>/dev/null || true)
  if [ "$html" != "OK" ]; then
    log_error "前端页面未正确返回"
    exit 1
  fi
  log_success "前端托管通过"
  log_success "冒烟测试全部通过 ✓"
  exit 0
fi

# ---------- 5b. 启动 ----------
if [ "$MODE" = "dev" ]; then
  log_info "开发模式启动（Ctrl+C 退出）..."
  exec npm run dev
fi

# 端口占用预检（给出可操作的提示而不是晦涩的 EADDRINUSE）
if (exec 3<>"/dev/tcp/127.0.0.1/${PORT}") 2>/dev/null; then
  exec 3>&- 3<&- || true
  log_error "端口 ${PORT} 已被占用。换个端口：PORT=3002 ./run.sh"
  exit 1
fi

log_success "启动 Efficio: http://localhost:${PORT} （Ctrl+C 退出）"
exec env NODE_ENV=production node server/dist/cli.js
