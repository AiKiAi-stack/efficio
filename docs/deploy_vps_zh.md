# Efficio VPS 部署指南

> 适用于 1GB 内存 / 1 核心 / 5GB SSD 的 VPS 部署

**[🌐 English Version](deploy_vps_en.md)**

---

## 📦 推荐配置

| 配置项 | 要求 |
|--------|------|
| 内存 | 1GB (推荐 2GB) |
| CPU | 1 核心 |
| 存储 | 5GB SSD |
| 系统 | Ubuntu 20.04+ / Debian 11+ |
| Node.js | 18.0.0+ |

---

## 🚀 一键部署

### 1. 登录 VPS，执行部署脚本

```bash
# 下载部署脚本
curl -O https://raw.githubusercontent.com/AiKiAi-stack/efficio/main/deploy-vps.sh

# 添加执行权限
chmod +x deploy-vps.sh

# 执行部署
sudo ./deploy-vps.sh
```

### 2. 配置环境变量

编辑 `.env` 文件：

```bash
cd /var/www/efficio/server
nano .env
```

必填配置：

```bash
# 服务器端口
PORT=3001

# 数据库模式
DATABASE_MODE=sqlite

# AI Provider 选择
AI_PROVIDER=anthropic

# API Key (替换为你的)
ANTHROPIC_API_KEY=your_anthropic_api_key

# CORS 配置（如有前端部署）
ALLOWED_ORIGINS=http://your-domain.com
```

### 3. 重启服务

```bash
pm2 restart efficio-api
```

---

## 📋 常用命令

### PM2 管理

```bash
# 查看状态
pm2 status

# 查看日志
pm2 logs efficio-api

# 重启服务
pm2 restart efficio-api

# 停止服务
pm2 stop efficio-api

# 删除服务
pm2 delete efficio-api

# 开机自启配置
pm2 save
pm2 startup
```

### 更新代码

```bash
cd /var/www/efficio

# 拉取最新代码
git pull

# 重新安装依赖
cd server
npm install --production

# 重新构建
npm run build
npm run build:ncc

# 重启服务
pm2 restart efficio-api
```

---

## 🔧 手动部署（备选方案）

如果自动脚本失败，可手动执行：

### 1. 安装 Node.js

```bash
# 使用 NodeSource 安装 Node.js 20
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo bash -
sudo apt-get install -y nodejs

# 验证安装
node -v
npm -v
```

### 2. 克隆项目

```bash
mkdir -p /var/www/efficio
cd /var/www/efficio
git clone git@github.com:AiKiAi-stack/efficio.git .
cd server
```

### 3. 安装依赖

```bash
# 安装生产依赖
npm install --production

# 安装构建工具
npm install --save-dev @vercel/ncc
```

### 4. 构建项目

```bash
# TypeScript 编译
npm run build

# ncc 打包（优化内存占用）
npm run build:ncc
```

### 5. 初始化数据库

```bash
npm run db:init
```

### 6. 启动 PM2

```bash
# 创建日志目录
mkdir -p logs

# 启动服务
pm2 start ecosystem.config.js

# 保存配置
pm2 save
```

---

## 🔍 故障排查

### 服务无法启动

```bash
# 查看详细日志
pm2 logs efficio-api --lines 100

# 检查端口占用
lsof -i :3001

# 检查内存使用
free -h
```

### 内存不足

```bash
# 创建 swap 分区（2GB）
sudo fallocate -l 2G /swapfile
sudo chmod 600 /swapfile
sudo mkswap /swapfile
sudo swapon /swapfile

# 永久生效
echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab
```

### 数据库锁定

```bash
# 检查数据库文件
ls -la /var/www/efficio/server/data/

# 备份并重建
cp data/efficiency.db data/efficiency.db.backup
rm data/efficiency.db
npm run db:init
```

---

## 📊 资源监控

### 查看内存占用

```bash
# PM2 应用内存
pm2 status

# 系统内存
free -h

# 进程内存
ps aux | grep node
```

### 查看 CPU 占用

```bash
# 实时查看
top

# PM2 监控
pm2 monit
```

### 查看磁盘使用

```bash
# 磁盘空间
df -h

# 目录大小
du -sh /var/www/efficio/*
```

---

## 🔒 安全建议

### 1. 配置防火墙

```bash
# 开放必要端口
ufw allow 22/tcp    # SSH
ufw allow 3001/tcp  # API

# 启用防火墙
ufw enable

# 查看状态
ufw status
```

### 2. 配置 SSH 密钥

```bash
# 生成密钥（本地执行）
ssh-keygen -t ed25519

# 上传公钥到 VPS
ssh-copy-id user@your-vps-ip
```

### 3. 禁用密码登录（可选）

编辑 `/etc/ssh/sshd_config`：

```bash
PasswordAuthentication no
PubkeyAuthentication yes
```

重启 SSH：

```bash
sudo systemctl restart sshd
```

---

## 📈 性能优化

### 1. 使用 ncc 打包

已配置在 `ecosystem.config.js` 中，脚本打包可减少内存占用约 30%。

### 2. 限制 PM2 内存

```javascript
// ecosystem.config.js
max_memory_restart: '400M'  // 超过 400MB 自动重启
```

### 3. 添加 Swap

如前面故障排查部分所述，2GB swap 可防止内存溢出。

---

## 🎯 预期资源占用

| 项目 | 占用 |
|------|------|
| 应用内存 | 60-100MB |
| 磁盘空间 | ~300MB |
| CPU 空闲 | <5% |
| CPU 峰值 | ~50% (AI 请求时) |

---

## 📞 获取帮助

遇到问题？

- 查看日志：`pm2 logs efficio-api`
- 查看状态：`pm2 status`
- GitHub Issues: https://github.com/AiKiAi-stack/efficio/issues
