# GitHub Release 自动发布指南

## 概述

本项目已配置 GitHub Actions 工作流，在推送版本标签时自动编译并发布二进制文件到 GitHub Release。

## 支持的平台

| 平台 | 操作系统 | 架构 | 文件名 |
|------|----------|------|--------|
| Linux | ubuntu-22.04 | x64 | `efficio-server-linux-x64.tar.gz` |
| macOS | macos-latest | x64 | `efficio-server-macos-x64.tar.gz` |
| Windows | windows-latest | x64 | `efficio-server-win-x64.zip` |

## 发布流程

### 1. 创建版本标签

在本地 git 仓库中创建并推送版本标签：

```bash
# 确保在 main 分支
git checkout main

# 拉取最新代码
git pull origin main

# 创建版本标签（语义化版本）
git tag v0.1.0

# 推送标签到 GitHub
git push origin v0.1.0
```

### 2. 自动触发 Action

推送标签后，GitHub Actions 会自动触发：

1. **编译阶段**（并行执行）：
   - Linux x64 编译
   - macOS x64 编译
   - Windows x64 编译

2. **打包阶段**：
   - Linux/macOS: 打包为 `.tar.gz`
   - Windows: 打包为 `.zip`

3. **发布阶段**：
   - 创建 Draft Release
   - 上传所有平台的二进制文件

### 3. 查看发布状态

访问：https://github.com/你的用户名/efficio/actions

查看 "Build Binary Releases" 工作流的执行状态。

### 4. 编辑并发布 Release

Action 完成后：

1. 访问：https://github.com/你的用户名/efficio/releases
2. 找到标记为 "Draft" 的 Release
3. 编辑 Release 说明（自动生成变更日志）
4. 点击 "Publish release"

## 手动触发

也可以通过 GitHub Actions 页面手动触发：

1. 访问：https://github.com/你的用户名/efficio/actions/workflows/build-binary.yml
2. 点击 "Run workflow"
3. 选择分支（通常为 main）
4. 点击 "Run workflow"

> 注意：手动触发不会创建 Release，只会编译和上传构建产物。

## 配置文件说明

### `.github/workflows/build-binary.yml`

GitHub Actions 工作流配置：
- `on.push.tags`: 定义触发条件（v* 标签）
- `matrix.include`: 定义支持的平台
- `jobs.release`: 创建 GitHub Release

### `server/package.json`

pkg 打包工具配置：
```json
"pkg": {
  "targets": [
    "node20-linux-x64",
    "node20-macos-x64",
    "node20-win-x64"
  ]
}
```

## 版本命名规范

遵循语义化版本（SemVer）：

- **MAJOR.MINOR.PATCH** (主版本号。次版本号。修订号)
- 例如：`v1.0.0`, `v1.2.3`, `v2.0.0-beta.1`

类型说明：
- `v0.1.0` - 初始开发版本
- `v1.0.0` - 正式版本
- `v1.0.0-beta.1` - Beta 测试版
- `v1.0.0-rc.1` - 发布候选版

## 故障排除

### 构建失败

1. 检查 `server/package.json` 中的依赖是否正确
2. 确认 `pkg` 工具版本兼容性
3. 查看 Action 日志获取详细错误信息

### Release 未创建

检查是否满足条件：
- 标签格式必须是 `v*`（如 v1.0.0）
- 必须推送到远程仓库
- build 任务必须全部成功

### 二进制文件无法运行

Linux/macOS:
```bash
# 添加执行权限
chmod +x efficio-server
```

Windows:
- 确保系统已安装 Visual C++ Redistributable
- 右键点击文件 → 属性 → 解除锁定

## 下载和使用二进制文件

### Linux

```bash
# 下载
wget https://github.com/你的用户名/efficio/releases/download/v0.1.0/efficio-server-linux-x64.tar.gz

# 解压
tar -xzf efficio-server-linux-x64.tar.gz

# 运行
chmod +x efficio-server
./efficio-server
```

### macOS

```bash
# 下载
curl -LO https://github.com/你的用户名/efficio/releases/download/v0.1.0/efficio-server-macos-x64.tar.gz

# 解压
tar -xzf efficio-server-macos-x64.tar.gz

# 运行
chmod +x efficio-server
./efficio-server
```

### Windows

```powershell
# 下载
Invoke-WebRequest -Uri "https://github.com/你的用户名/efficio/releases/download/v0.1.0/efficio-server-win-x64.zip" -OutFile "efficio-server-win-x64.zip"

# 解压
Expand-Archive efficio-server-win-x64.zip

# 运行
.\efficio-server.exe
```

## 环境变量配置

运行前请复制 `.env.example` 为 `.env` 并配置必要的变量：

```bash
# Linux/macOS
cp .env.example .env

# Windows
copy .env.example .env
```

必要的环境变量：
- `SUPABASE_URL` - Supabase 项目 URL
- `SUPABASE_SERVICE_KEY` - Supabase 服务密钥
- `ANTHROPIC_API_KEY` - Anthropic API 密钥
