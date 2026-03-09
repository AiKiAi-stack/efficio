# VPS 一键部署快速指南

## 解决问题

这个部署脚本解决了以下问题：

1. ✅ **VPS 部署报错** - 不再依赖 `npm install`，使用预编译的二进制文件
2. ✅ **跨平台支持** - 支持 VPS、本地机器、Docker
3. ✅ **systemd 集成** - 自动配置开机自启、服务管理
4. ✅ **简单卸载** - 一键完全卸载

## 使用方法

### 步骤 1：下载脚本

```bash
# 创建 scripts 目录
mkdir -p ~/scripts
cd ~/scripts

# 下载部署脚本
curl -fsSL https://raw.githubusercontent.com/YOUR_USERNAME/RecordEvo/main/scripts/deploy.sh -o deploy.sh
chmod +x deploy.sh
```

### 步骤 2：选择部署模式

#### 模式 A：二进制部署（推荐，最快）

无需 Node.js，直接下载预编译的二进制文件：

```bash
sudo ./deploy.sh --binary
```

部署后：
- 二进制文件位置：`/opt/efficio/efficio-server`
- 配置文件位置：`/etc/efficio/.env`
- 服务名称：`efficio`

#### 模式 B：源码部署（开发环境）

需要 Node.js 20+：

```bash
sudo ./deploy.sh --source
```

#### 模式 C：Docker 部署（隔离环境）

需要 Docker 和 Docker Compose：

```bash
sudo ./deploy.sh --docker
```

### 步骤 3：配置环境变量

```bash
# 编辑配置文件
sudo nano /etc/efficio/.env
```

必需配置的环境变量：

```bash
# Supabase 配置
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_KEY=your-service-key

# AI 配置
ANTHROPIC_API_KEY=sk-ant-xxx
OPENAI_API_KEY=sk-xxx

# 其他配置
PORT=3001
NODE_ENV=production
```

### 步骤 4：验证部署

```bash
# 查看服务状态
sudo ./deploy.sh --status

# 健康检查
curl http://localhost:3001/health

# 查看日志
sudo journalctl -u efficio -f
```

## 常用命令

```bash
# 查看服务状态
sudo ./deploy.sh --status

# 重启服务
sudo ./deploy.sh --restart

# 查看日志
sudo journalctl -u efficio -f

# 卸载
sudo ./deploy.sh --uninstall
```

## 故障排查

### 问题：二进制文件下载失败

**原因**: GitHub Releases 尚未创建

**解决**: 使用源码模式或等待 CI/CD 构建完成

```bash
# 使用源码模式
sudo ./deploy.sh --source
```

### 问题：服务无法启动

**查看日志**:
```bash
sudo journalctl -u efficio -f
```

**常见原因**:
1. 端口被占用 - 修改 `.env` 中的 `PORT`
2. 环境变量缺失 - 检查 `/etc/efficio/.env`
3. 数据库连接失败 - 检查 Supabase 配置

### 问题：权限错误

确保使用 `sudo` 运行脚本：
```bash
sudo ./deploy.sh --binary
```

## 本地机器部署（macOS/Linux）

本地机器推荐使用源码模式：

```bash
# macOS
./deploy.sh --source

# Linux
sudo ./deploy.sh --source
```

或者使用 Homebrew（macOS）:
```bash
brew install node
cd /path/to/RecordEvo
npm install
npm run build
npm start
```

## 自动化更新

创建一个更新脚本 `~/scripts/update-efficio.sh`:

```bash
#!/bin/bash
cd ~/scripts
curl -fsSL https://raw.githubusercontent.com/YOUR_USERNAME/RecordEvo/main/scripts/deploy.sh -o deploy.sh
chmod +x deploy.sh
sudo ./deploy.sh --binary
```

赋予执行权限：
```bash
chmod +x ~/scripts/update-efficio.sh
```

## 安全建议

1. **防火墙配置**:
   ```bash
   # UFW (Ubuntu)
   sudo ufw allow 3001/tcp
   sudo ufw enable
   ```

2. **HTTPS 配置**:
   使用 Nginx 反向代理：
   ```bash
   sudo apt install nginx
   sudo certbot --nginx -d your-domain.com
   ```

3. **定期备份**:
   ```bash
   # 备份配置文件
   sudo cp /etc/efficio/.env /etc/efficio/.env.backup.$(date +%Y%m%d)
   ```
