#!/bin/bash

# =============================================================================
# Efficio 通用部署脚本
# 支持：VPS / 本地机器 / Docker
# 模式：二进制模式 / 源码模式
# =============================================================================

set -e

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# 日志函数
log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

log_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# 检测系统架构
detect_arch() {
    local arch=$(uname -m)
    case $arch in
        x86_64)
            echo "x64"
            ;;
        aarch64|arm64)
            echo "arm64"
            ;;
        *)
            log_error "不支持的架构：$arch"
            exit 1
            ;;
    esac
}

# 检测操作系统
detect_os() {
    local os=$(uname -s)
    case $os in
        Linux)
            echo "linux"
            ;;
        Darwin)
            echo "macos"
            ;;
        *)
            log_error "不支持的操作系统：$os"
            exit 1
            ;;
    esac
}

# 检查 Node.js 安装
check_nodejs() {
    if command -v node &> /dev/null; then
        local version=$(node -v)
        log_info "Node.js 已安装：$version"
        return 0
    else
        log_warning "Node.js 未安装"
        return 1
    fi
}

# 检查 Docker 安装
check_docker() {
    if command -v docker &> /dev/null && command -v docker-compose &> /dev/null; then
        log_info "Docker 和 Docker Compose 已安装"
        return 0
    else
        log_warning "Docker 或 Docker Compose 未安装"
        return 1
    fi
}

# 安装 Node.js (Ubuntu/Debian)
install_nodejs() {
    log_info "正在安装 Node.js 20..."
    curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
    sudo apt-get install -y nodejs
    log_success "Node.js 安装完成"
}

# 下载二进制文件
download_binary() {
    local arch=$(detect_arch)
    local os=$(detect_os)
    local binary_name="efficio-server-${os}-${arch}"
    local release_url="https://github.com/YOUR_USERNAME/RecordEvo/releases/latest/download/${binary_name}"

    log_info "正在下载二进制文件：${binary_name}"

    # 创建安装目录
    sudo mkdir -p /opt/efficio
    sudo mkdir -p /etc/efficio

    # 下载二进制
    if command -v curl &> /dev/null; then
        sudo curl -L -o /opt/efficio/efficio-server "${release_url}"
    else
        sudo wget -O /opt/efficio/efficio-server "${release_url}"
    fi

    # 设置权限
    sudo chmod +x /opt/efficio/efficio-server
    log_success "二进制文件下载完成"
}

# 创建 systemd 服务文件
create_systemd_service() {
    log_info "正在创建 systemd 服务文件..."

    sudo tee /etc/systemd/system/efficio.service > /dev/null <<EOF
[Unit]
Description=Efficio Server
After=network.target

[Service]
Type=simple
User=root
WorkingDirectory=/opt/efficio
ExecStart=/opt/efficio/efficio-server
Restart=on-failure
RestartSec=10
Environment=NODE_ENV=production
EnvironmentFile=-/etc/efficio/.env

[Install]
WantedBy=multi-user.target
EOF

    log_success "systemd 服务文件创建完成"
}

# 配置环境变量
setup_env() {
    if [ ! -f /etc/efficio/.env ]; then
        log_info "正在创建环境变量文件..."
        sudo cp /opt/efficio/.env.example /etc/efficio/.env 2>/dev/null || {
            log_warning ".env.example 不存在，创建空的 .env 文件"
            sudo touch /etc/efficio/.env
        }
        log_success "环境变量文件创建完成：/etc/efficio/.env"
        log_warning "请编辑 /etc/efficio/.env 配置你的环境变量"
    else
        log_info "环境变量文件已存在"
    fi
}

# 启动服务
start_service() {
    log_info "正在启动服务..."
    sudo systemctl daemon-reload
    sudo systemctl enable efficio
    sudo systemctl start efficio
    log_success "Efficio 服务已启动"
}

# 检查服务状态
check_status() {
    sudo systemctl status efficio --no-pager
}

# 源码部署模式
deploy_from_source() {
    log_info "正在使用源码模式部署..."

    # 检查 Node.js
    if ! check_nodejs; then
        log_warning "是否安装 Node.js 20? (y/n)"
        read -r response
        if [[ "$response" =~ ^[Yy]$ ]]; then
            install_nodejs
        else
            log_error "Node.js 是必需的"
            exit 1
        fi
    fi

    # 进入项目目录
    cd "$(dirname "$0")/.."

    # 安装依赖
    log_info "正在安装依赖..."
    npm install --production

    cd server
    npm install --production
    npm run build

    cd ../client
    npm install --production
    npm run build

    log_success "源码构建完成"

    # 创建 systemd 服务
    create_systemd_service_source

    # 启动服务
    start_service
}

# 创建 systemd 服务文件（源码模式）
create_systemd_service_source() {
    local project_dir="$(cd "$(dirname "$0")/.." && pwd)"

    sudo tee /etc/systemd/system/efficio.service > /dev/null <<EOF
[Unit]
Description=Efficio Server
After=network.target

[Service]
Type=simple
User=root
WorkingDirectory=${project_dir}/server
ExecStart=$(command -v node) ${project_dir}/server/dist/index.js
Restart=on-failure
RestartSec=10
Environment=NODE_ENV=production
EnvironmentFile=-${project_dir}/.env

[Install]
WantedBy=multi-user.target
EOF

    log_success "systemd 服务文件创建完成"
}

# Docker 部署模式
deploy_with_docker() {
    log_info "正在使用 Docker 模式部署..."

    if ! check_docker; then
        log_warning "是否安装 Docker? (y/n)"
        read -r response
        if [[ "$response" =~ ^[Yy]$ ]]; then
            curl -fsSL https://get.docker.com | sh
            sudo usermod -aG docker $USER
            log_success "Docker 安装完成，请重新运行此脚本"
            exit 0
        else
            log_error "Docker 是必需的"
            exit 1
        fi
    fi

    # 进入项目目录
    cd "$(dirname "$0")/.."

    # 复制环境变量
    if [ ! -f .env ]; then
        cp .env.example .env
        log_warning "请编辑 .env 文件配置环境变量"
    fi

    # 启动 Docker
    docker-compose up -d --build

    log_success "Docker 部署完成"
    log_info "查看日志：docker-compose logs -f"
}

# 显示使用帮助
show_help() {
    cat << EOF
Efficio 部署脚本

使用方法:
    $0 [选项]

选项:
    --binary        二进制模式（推荐，需要预编译的二进制文件）
    --source        源码模式（需要 Node.js）
    --docker        Docker 模式（需要 Docker）
    --uninstall     卸载 Efficio
    --status        查看服务状态
    --restart       重启服务
    --help          显示此帮助信息

示例:
    # 二进制模式部署（最快）
    $0 --binary

    # 源码模式部署（开发环境）
    $0 --source

    # Docker 部署（隔离环境）
    $0 --docker

    # 查看服务状态
    $0 --status

    # 卸载
    $0 --uninstall

EOF
}

# 卸载
uninstall() {
    log_info "正在卸载 Efficio..."

    # 停止服务
    sudo systemctl stop efficio 2>/dev/null || true
    sudo systemctl disable efficio 2>/dev/null || true

    # 删除服务文件
    sudo rm -f /etc/systemd/system/efficio.service

    # 删除安装文件
    sudo rm -rf /opt/efficio
    sudo rm -rf /etc/efficio

    # 重新加载 systemd
    sudo systemctl daemon-reload

    log_success "Efficio 已卸载"
}

# 重启服务
restart_service() {
    log_info "正在重启服务..."
    sudo systemctl restart efficio
    log_success "Efficio 服务已重启"
}

# 主函数
main() {
    # 需要 root 权限
    if [ "$EUID" -ne 0 ] && [[ "$1" != "--help" ]]; then
        log_warning "请使用 sudo 运行此脚本"
        echo "Usage: sudo $0 [选项]"
        exit 1
    fi

    case "$1" in
        --binary)
            setup_env
            download_binary
            create_systemd_service
            start_service
            ;;
        --source)
            deploy_from_source
            ;;
        --docker)
            deploy_with_docker
            ;;
        --uninstall)
            uninstall
            ;;
        --status)
            check_status
            ;;
        --restart)
            restart_service
            ;;
        --help|"")
            show_help
            ;;
        *)
            log_error "未知选项：$1"
            show_help
            exit 1
            ;;
    esac
}

main "$@"
