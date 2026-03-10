# Efficio 部署配置指南

## 部署场景

### 场景 1: 本地开发

**后端启动：**
```bash
cd server
./efficio-server --host localhost --port 3001
```

**前端配置（`.env`）：**
```bash
VITE_API_URL=http://localhost:3001/api
```

**前端启动：**
```bash
cd client
npm run dev
```

访问：`http://localhost:5173`

---

### 场景 2: VPS 部署（公网 IP 访问）

假设你的 VPS 公网 IP 是 `203.0.113.100`

#### 后端配置

**启动后端（监听所有接口）：**
```bash
cd server
./efficio-server --host 0.0.0.0 --port 3001
```

#### 前端构建和部署

**方案 A：前端也在 VPS 上部署（推荐）**

1. **修改前端 `.env` 文件：**
   ```bash
   # 本地开发配置
   VITE_API_URL=http://localhost:3001/api

   # 生产环境配置（构建时使用）
   VITE_API_URL=http://203.0.113.100:3001/api
   ```

2. **构建前端：**
   ```bash
   cd client
   npm run build
   ```

3. **使用后端静态文件服务：**
   后端会自动提供 `client/dist` 目录的静态文件

4. **访问：** `http://203.0.113.100:3001`

**方案 B：前后端分离部署**

1. **前端构建（指定 API 地址）：**
   ```bash
   cd client
   VITE_API_URL=http://203.0.113.100:3001/api npm run build
   ```

2. **将 `dist` 目录部署到 CDN 或静态托管服务**

3. **后端启动（配置 CORS）：**
   ```bash
   ./efficio-server --host 0.0.0.0 --port 3001 \
     --allowed-origins "http://your-cdn.com,http://203.0.113.100"
   ```

---

### 场景 3: 使用 Nginx 反向代理

**Nginx 配置：**
```nginx
server {
    listen 80;
    server_name efficio.example.com;

    # 前端静态文件
    location / {
        root /var/www/efficio/client/dist;
        try_files $uri $uri/ /index.html;
    }

    # 后端 API 代理
    location /api {
        proxy_pass http://localhost:3001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    }
}
```

**后端启动：**
```bash
./efficio-server --host localhost --port 3001
```

**前端 `.env`：**
```bash
VITE_API_URL=http://efficio.example.com/api
```

---

## 环境变量说明

### 前端环境变量

| 变量名 | 说明 | 示例 |
|--------|------|------|
| `VITE_API_URL` | 后端 API 地址 | `http://localhost:3001/api` |
| `VITE_API_HOST` | 开发环境代理目标（可选） | `localhost:3001` |

### 后端环境变量

| CLI 参数 | 环境变量 | 说明 |
|---------|----------|------|
| `--port` | `SERVER_PORT` | 监听端口 |
| `--host` | `SERVER_HOST` | 监听地址 |
| `--allowed-origins` | `ALLOWED_ORIGINS` | CORS 允许的源 |

---

## 快速部署脚本

### VPS 一键部署

```bash
#!/bin/bash

# 1. 下载后端二进制
wget https://github.com/AiKiAi-stack/efficio/releases/download/v0.2.0/efficio-server-linux-x64.tar.gz
tar -xzf efficio-server-linux-x64.tar.gz
cd efficio-server

# 2. 启动后端
./efficio-server --host 0.0.0.0 --port 3001 &

# 3. 部署前端
cd ..
wget https://github.com/AiKiAi-stack/efficio/releases/download/v0.2.0/client-dist.tar.gz
tar -xzf client-dist.tar.gz -C /var/www/html

# 4. 配置 Nginx（可选）
# 参考上面的 Nginx 配置
```

---

## 防火墙配置

### Ubuntu (UFW)
```bash
sudo ufw allow 3001/tcp
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
```

### CentOS (firewalld)
```bash
sudo firewall-cmd --permanent --add-port=3001/tcp
sudo firewall-cmd --permanent --add-service=http
sudo firewall-cmd --permanent --add-service=https
sudo firewall-cmd --reload
```

---

## 常见问题

### Q: 前端无法连接后端 API？

**A:** 检查以下几点：
1. 后端是否监听 `0.0.0.0` 而不是 `localhost`
2. 防火墙是否开放对应端口
3. 前端 `.env` 中的 `VITE_API_URL` 是否正确
4. CORS 配置是否包含前端地址

### Q: 构建后前端仍然请求 localhost？

**A:** 前端构建时会固化 `VITE_API_URL` 的值，需要：
1. 修改 `.env` 文件
2. 重新运行 `npm run build`
3. 部署新的 `dist` 目录

### Q: 如何验证部署是否成功？

**A:**
```bash
# 检查后端健康状态
curl http://YOUR_SERVER_IP:3001/health

# 应该返回：
# {"status":"ok","timestamp":"...","environment":"production"}
```
