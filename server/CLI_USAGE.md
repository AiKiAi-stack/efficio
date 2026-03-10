# Efficio Server CLI 使用指南

## 快速开始

### 基本用法

```bash
# 使用默认配置启动（端口 3001，监听 localhost）
./efficio-server

# 指定端口
./efficio-server --port 8080

# 监听所有网络接口
./efficio-server --host 0.0.0.0

# 指定端口和监听地址
./efficio-server --port 8080 --host 0.0.0.0
```

### 使用配置文件

```bash
# 使用默认配置文件 (~/.config/efficio.json)
./efficio-server

# 指定配置文件路径
./efficio-server --config /path/to/config.json

# 查看当前配置
./efficio-server config

# 以 JSON 格式输出配置
./efficio-server config --json
```

---

## 命令行参数

| 参数 | 简写 | 说明 | 默认值 |
|------|------|------|--------|
| `--port <number>` | `-p` | 服务器端口 | 3001 |
| `--host <address>` | `-h` | 监听地址 | localhost |
| `--config <path>` | `-c` | 配置文件路径 | ~/.config/efficio.json |
| `--database <path>` | `-d` | SQLite 数据库路径 | ./data/efficiency.db |
| `--log-level <level>` | - | 日志级别 | info |
| `--open-browser` | - | 启动时打开浏览器 | false |
| `--init` | - | 初始化数据库并退出 | - |
| `--help` | - | 显示帮助信息 | - |
| `--version` | - | 显示版本号 | - |

---

## 配置文件

### 配置文件位置（优先级从高到低）

1. 命令行 `--config` 指定的路径
2. 当前目录的 `efficio.json`
3. `~/.config/efficio.json`
4. `./config/efficio.json`

### 配置文件格式

```json
{
  "port": 3001,
  "host": "localhost",
  "database": "./data/efficiency.db",
  "logLevel": "info",
  "openBrowser": false,
  "allowedOrigins": [
    "http://localhost:5173",
    "http://localhost:5174"
  ]
}
```

### 配置项说明

| 配置项 | 类型 | 说明 | 默认值 |
|--------|------|------|--------|
| `port` | number | 服务器端口 | 3001 |
| `host` | string | 监听地址 | localhost |
| `database` | string | SQLite 数据库文件路径 | ./data/efficiency.db |
| `logLevel` | string | 日志级别 (debug/info/warn/error) | info |
| `openBrowser` | boolean | 启动时是否打开浏览器 | false |
| `allowedOrigins` | string[] | CORS 允许的源地址 | localhost 端口 |

---

## 使用场景

### 场景 1: VPS 部署（公开访问）

```bash
# 监听所有接口，使用配置文件
./efficio-server --host 0.0.0.0 --port 3001

# 或使用配置文件 ~/.config/efficio.json
{
  "host": "0.0.0.0",
  "port": 3001
}
```

### 场景 2: 本地开发

```bash
# 默认启动，自动打开浏览器
./efficio-server --open-browser
```

### 场景 3: Docker 容器

```bash
# 使用环境变量（仍然支持）
docker run -e PORT=3001 -e HOST=0.0.0.0 efficio-server

# 或挂载配置文件
docker run -v ~/.config/efficio.json:/app/efficio.json efficio-server
```

### 场景 4: 多实例部署

```bash
# 实例 1 - 端口 3001
./efficio-server --port 3001 --database ./data/instance1.db

# 实例 2 - 端口 3002
./efficio-server --port 3002 --database ./data/instance2.db
```

---

## 子命令

### config - 查看配置

```bash
# 查看当前配置
./efficio-server config

# JSON 格式输出
./efficio-server config --json
```

### init - 初始化数据库

```bash
./efficio-server init
```

---

## 环境变量兼容性

CLI 参数会转换为环境变量传递给主程序：

| CLI 参数 | 环境变量 |
|----------|----------|
| `--port` | `SERVER_PORT` |
| `--host` | `SERVER_HOST` |
| `--database` | `SQLITE_DB_PATH` |
| `--log-level` | `LOG_LEVEL` |
| `--open-browser` | `OPEN_BROWSER` |

---

## 示例脚本

### systemd 服务配置

```ini
# /etc/systemd/system/efficio.service
[Unit]
Description=Efficio Server
After=network.target

[Service]
Type=simple
User=efficio
WorkingDirectory=/opt/efficio
ExecStart=/opt/efficio/efficio-server --host 0.0.0.0 --config /etc/efficio/config.json
Restart=always

[Install]
WantedBy=multi-user.target
```

### Docker 启动脚本

```bash
#!/bin/bash
exec ./efficio-server --host 0.0.0.0 --port 3001
```

---

## 故障排除

### 端口被占用

```
Error: listen EADDRINUSE: address already in use :::3001
```

解决方法：使用其他端口
```bash
./efficio-server --port 3002
```

### 无法从外部访问

确保使用 `--host 0.0.0.0` 并检查防火墙：
```bash
# 启动时使用
./efficio-server --host 0.0.0.0

# 开放防火墙（Ubuntu）
sudo ufw allow 3001/tcp
```

### 配置文件无效

检查 JSON 格式：
```bash
jq . ~/.config/efficio.json
```
