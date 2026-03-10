#!/bin/bash

# GitHub Release 一键发布脚本
# 用法：./scripts/release.sh <version>
# 例如：./scripts/release.sh v0.1.0

set -e

# 颜色输出
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo_info() {
    echo -e "${GREEN}>>> $1${NC}"
}

echo_warn() {
    echo -e "${YELLOW}>>> $1${NC}"
}

echo_error() {
    echo -e "${RED}>>> $1${NC}"
}

# 检查参数
if [ -z "$1" ]; then
    echo_error "错误：请提供版本号"
    echo "用法：$0 <version>"
    echo "例如：$0 v0.1.0"
    exit 1
fi

VERSION=$1

# 验证版本格式
if [[ ! $VERSION =~ ^v[0-9]+\.[0-9]+\.[0-9]+(-[a-zA-Z0-9.]+)?$ ]]; then
    echo_error "错误：版本号格式不正确"
    echo "请使用语义化版本格式，如：v0.1.0, v1.0.0-beta.1"
    exit 1
fi

echo_info "准备发布版本：$VERSION"

# 检查是否在 main 分支
CURRENT_BRANCH=$(git rev-parse --abbrev-ref HEAD)
if [ "$CURRENT_BRANCH" != "main" ]; then
    echo_warn "当前不在 main 分支（当前：$CURRENT_BRANCH）"
    read -p "是否继续？(y/N): " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        exit 1
    fi
fi

# 检查是否有未提交的更改
if [ -n "$(git status --porcelain)" ]; then
    echo_warn "存在未提交的更改"
    read -p "是否继续？(y/N): " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        exit 1
    fi
fi

# 拉取最新代码
echo_info "拉取最新代码..."
git pull origin main

# 检查标签是否已存在
if git rev-parse "$VERSION" >/dev/null 2>&1; then
    echo_error "错误：标签 $VERSION 已存在"
    exit 1
fi

# 创建标签
echo_info "创建标签 $VERSION..."
git tag -a "$VERSION" -m "Release $VERSION"

# 推送标签
echo_info "推送标签到 GitHub..."
git push origin "$VERSION"

echo_info ""
echo_info "========================================="
echo_info "发布已触发！"
echo_info "========================================="
echo_info ""
echo_info "查看构建状态："
echo_info "  https://github.com/$(git remote get-url origin | sed 's/.*github.com[:/]/https:\/\/github.com\//' | sed 's/\.git$//')/actions"
echo_info ""
echo_info "查看 Release："
echo_info "  https://github.com/$(git remote get-url origin | sed 's/.*github.com[:/]/https:\/\/github.com\//' | sed 's/\.git$//')/releases"
echo_info ""
echo_warn "注意：Release 初始状态为 Draft，需要手动编辑并发布"
echo_info ""
