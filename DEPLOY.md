# 效率追踪器 - 部署指南

## 系统要求

- **最低配置**: 1GB 内存，1 Core CPU, 5GB SSD
- **推荐配置**: 2GB 内存，2 Core CPU, 10GB SSD
- **Node.js**: v18+
- **数据库**: Supabase (云服务或自托管)

## 快速部署

### 方案一：一键部署脚本（推荐，支持 VPS/本地机器）

**适用场景**:
- VPS 服务器（Ubuntu/Debian/CentOS）
- 本地机器（macOS/Linux）
- 无需 Docker，无需 Node.js（二进制模式）

```bash
# 下载部署脚本
curl -fsSL https://raw.githubusercontent.com/YOUR_USERNAME/RecordEvo/main/scripts/deploy.sh -o deploy.sh
chmod +x deploy.sh

# 二进制模式部署（最快，推荐 VPS 使用）
sudo ./deploy.sh --binary

# 或者：源码模式部署（需要 Node.js，适合开发环境）
sudo ./deploy.sh --source

# 或者：Docker 模式部署
sudo ./deploy.sh --docker
```

**部署后配置**:
```bash
# 1. 编辑环境变量
sudo nano /etc/efficio/.env

# 2. 查看服务状态
sudo ./deploy.sh --status

# 3. 查看日志
sudo journalctl -u efficio -f

# 4. 重启服务
sudo ./deploy.sh --restart

# 5. 卸载
sudo ./deploy.sh --uninstall
```

### 方案二：Docker Compose

1. **克隆项目**
```bash
git clone <your-repo-url>
cd RecordEvo
```

2. **配置环境变量**
```bash
cp .env.example .env
# 编辑 .env 文件，填入你的配置
```

3. **启动服务**
```bash
docker-compose up -d
```

4. **查看日志**
```bash
docker-compose logs -f app
```

5. **停止服务**
```bash
docker-compose down
```

### 方案二：直接部署

1. **安装依赖**
```bash
# 根目录
npm install

# 服务端
cd server && npm install

# 客户端
cd ../client && npm install
```

2. **构建**
```bash
# 服务端
cd server && npm run build

# 客户端
cd ../client && npm run build
```

3. **启动**
```bash
# 服务端
cd server && npm start

# 客户端（开发环境）
cd client && npm run dev
```

或使用 PM2 生产部署：

```bash
npm install -g pm2

# 启动服务端
cd server
pm2 start dist/index.js --name efficiency-tracker-api

# 保存 PM2 配置
pm2 save

# 设置开机自启
pm2 startup
```

## 环境变量配置

| 变量名 | 说明 | 示例 |
|--------|------|------|
| `SUPABASE_URL` | Supabase 项目 URL | `https://xxx.supabase.co` |
| `SUPABASE_SERVICE_KEY` | Supabase 服务密钥 | `eyJh...` |
| `ANTHROPIC_API_KEY` | Anthropic API 密钥 | `sk-ant-...` |
| `PORT` | 服务端端口（可选） | `3001` |
| `ALLOWED_ORIGINS` | 允许的 CORS 源（可选） | `http://localhost:5173` |

## 数据库初始化

在 Supabase 控制台执行 `server/sql/init.sql`

或如果使用本地 PostgreSQL：

```bash
psql -U postgres -f server/sql/init.sql efficiency_tracker
```

## 定时任务

系统内置定时任务：
- **周总结**: 每周一 8:00 自动生成
- **月趋势**: 每月 1 号 9:00 自动生成

时区：Asia/Shanghai

如需修改，编辑 `server/src/lib/cron.ts`

## 资源优化

针对 1G 1Core 环境的优化措施：

1. **内存限制**: Node.js 最大堆内存 256MB
2. **Docker 限制**: 容器最大 512MB 内存
3. **日志轮转**: 最大 3 个文件，每个 10MB
4. **单线程运行**: 避免多进程消耗

## 健康检查

```bash
curl http://localhost:3001/health
```

## 故障排查

### 内存不足
```bash
# 查看内存使用
docker stats

# 增加限制（docker-compose.yml）
# 修改 deploy.resources.limits.memory
```

### 数据库连接失败
```bash
# 检查 Supabase 状态
# 检查 .env 配置
```

### API 调用失败
```bash
# 检查 ANTHROPIC_API_KEY
# 检查网络连接
```

## 备份

### 数据库备份
如果使用 Supabase 云服务，自动备份。

如果使用本地 PostgreSQL：
```bash
pg_dump -U postgres efficiency_tracker > backup.sql
```

### 日志备份
```bash
docker-compose logs app > logs.txt
```

## 更新部署

```bash
git pull
docker-compose down
docker-compose up -d --build
```

## 安全注意

1. 不要将 `.env` 文件提交到 Git
2. 定期轮换 API 密钥
3. 生产环境使用 HTTPS
4. 限制 CORS 源
