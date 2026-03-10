# Efficio Server CLI 使用指南

## 快速开始

### 基本用法

```bash
# 使用默认配置启动
./efficio-server

# 指定端口和监听地址
./efficio-server --port 8080 --host 0.0.0.0

# 指定配置文件
./efficio-server --config /path/to/config.json

# 查看当前配置
./efficio-server config --show
```

---

## 命令行参数

### 服务器配置

| 参数 | 简写 | 默认值 | 说明 |
|------|------|--------|------|
| `--port <number>` | `-p` | 3001 | HTTP 监听端口 |
| `--host <address>` | `-h` | localhost | 监听地址 (0.0.0.0 表示公开) |
| `--env <environment>` | `-e` | production | 运行环境：development / production |
| `--log-level <level>` | - | info | 日志级别：debug / info / warn / error |
| `--allowed-origins <origins>` | - | localhost:* | CORS 允许的源（逗号分隔） |

### 数据库配置

| 参数 | 默认值 | 说明 |
|------|--------|------|
| `--db-mode <mode>` | sqlite | 数据库模式：memory / sqlite / turso / supabase |
| `--db-path <path>` | ./data/efficiency.db | SQLite 数据库文件路径 |
| `--turso-url <url>` | - | Turso 数据库 URL |
| `--turso-token <token>` | - | Turso 认证 Token |
| `--supabase-url <url>` | - | Supabase 项目 URL |
| `--supabase-key <key>` | - | Supabase 服务密钥 |

### AI 配置

| 参数 | 默认值 | 说明 |
|------|--------|------|
| `--ai-provider <provider>` | anthropic | AI 提供商：anthropic / openai / deepseek / zhipu / kimi / nvidia / vllm / aliyun / volcengine / minimax / openrouter |

### Cron 配置

| 参数 | 默认值 | 说明 |
|------|--------|------|
| `--no-cron` | - | 禁用定时任务 |

### 配置文件

| 参数 | 简写 | 说明 |
|------|------|------|
| `--config <path>` | `-c` | 配置文件路径（默认：~/.config/efficio.json 或 ./efficio.json） |

### 其他

| 参数 | 说明 |
|------|------|
| `--open-browser` | 启动时打开浏览器 |
| `--help` | 显示帮助信息 |
| `--version` | 显示版本号 |

---

## 配置文件格式

### 配置文件位置（优先级从高到低）

1. 命令行 `--config` 指定的路径
2. 当前目录的 `efficio.json`
3. `~/.config/efficio.json`
4. `./config/efficio.json`
5. `.efficio.json`

### 完整配置示例

```json
{
  "server": {
    "port": 3001,
    "host": "0.0.0.0",
    "env": "production",
    "logLevel": "info",
    "allowedOrigins": [
      "https://efficio.example.com",
      "http://localhost:5173"
    ]
  },
  "database": {
    "mode": "sqlite",
    "sqlitePath": "/var/lib/efficio/efficiency.db"
  },
  "ai": {
    "provider": "anthropic",
    "providers": {
      "anthropic": {
        "apiKey": "sk-ant-...",
        "endpoint": "https://api.anthropic.com",
        "model": "claude-sonnet-4-6"
      },
      "openai": {
        "apiKey": "sk-...",
        "endpoint": "https://api.openai.com/v1",
        "model": "gpt-4o"
      }
    }
  },
  "cron": {
    "enabled": true,
    "weeklySummary": "0 8 * * 1"
  }
}
```

### 配置项说明

#### Server

| 字段 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| `port` | number | 3001 | HTTP 监听端口 |
| `host` | string | localhost | 监听地址 |
| `env` | string | production | 运行环境 |
| `logLevel` | string | info | 日志级别 |
| `allowedOrigins` | string[] | localhost:* | CORS 允许的来源 |

#### Database

| 字段 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| `mode` | string | sqlite | 数据库模式 |
| `sqlitePath` | string | ./data/efficiency.db | SQLite 路径（sqlite 模式） |
| `tursoUrl` | string | - | Turso URL（turso 模式） |
| `tursoToken` | string | - | Turso Token（turso 模式） |
| `supabaseUrl` | string | - | Supabase URL（supabase 模式） |
| `supabaseKey` | string | - | Supabase Key（supabase 模式） |

#### AI

| 字段 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| `provider` | string | anthropic | 当前激活的 AI 提供商 |
| `providers.anthropic.apiKey` | string | - | Anthropic API 密钥 |
| `providers.openai.apiKey` | string | - | OpenAI API 密钥 |
| `providers.deepseek.apiKey` | string | - | DeepSeek API 密钥 |
| ... | ... | ... | 其他 Provider 配置 |

#### Cron

| 字段 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| `enabled` | boolean | true | 是否启用定时任务 |
| `weeklySummary` | string | 0 8 * * 1 | 周总结生成时间（Cron 表达式） |

---

## 子命令

### config - 配置管理

```bash
# 显示当前配置
./efficio-server config --show

# JSON 格式输出
./efficio-server config --json

# 创建配置文件模板
./efficio-server config --init

# 验证配置文件
./efficio-server config --validate
```

### init - 初始化数据库

```bash
./efficio-server init
```

---

## 使用场景

### 场景 1: VPS 部署（公开访问）

```bash
# 方法 1：命令行参数
./efficio-server --host 0.0.0.0 --port 3001

# 方法 2：配置文件
# ~/.config/efficio.json
{
  "server": {
    "host": "0.0.0.0",
    "port": 3001
  }
}
```

### 场景 2: 本地开发

```bash
# 开发模式，自动打开浏览器
./efficio-server --env development --open-browser

# 使用自定义数据库
./efficio-server --db-path ./dev-data/dev.db
```

### 场景 3: 切换 AI Provider

```bash
# 使用 DeepSeek
./efficio-server --ai-provider deepseek

# 使用本地 vLLM
./efficio-server --ai-provider vllm
# 配置文件中设置：
# {
#   "ai": {
#     "provider": "vllm",
#     "providers": {
#       "vllm": {
#         "endpoint": "http://localhost:8000/v1",
#         "model": "llama-2-70b"
#       }
#     }
#   }
# }
```

### 场景 4: 禁用定时任务

```bash
# 适用于资源受限环境
./efficio-server --no-cron
```

### 场景 5: 使用 Turso 数据库

```bash
./efficio-server \
  --db-mode turso \
  --turso-url "libsql://org-db.turso.io" \
  --turso-token "eyJhbG..."
```

### 场景 6: 使用 Supabase

```bash
./efficio-server \
  --db-mode supabase \
  --supabase-url "https://xxx.supabase.co" \
  --supabase-key "eyJhbG..."
```

---

## 环境变量兼容性

CLI 参数会转换为环境变量：

| CLI 参数 | 环境变量 |
|----------|----------|
| `--port` | `SERVER_PORT` |
| `--host` | `SERVER_HOST` |
| `--env` | `NODE_ENV` |
| `--log-level` | `LOG_LEVEL` |
| `--allowed-origins` | `ALLOWED_ORIGINS` |
| `--db-mode` | `DATABASE_MODE` |
| `--db-path` | `SQLITE_DB_PATH` |
| `--turso-url` | `TURSO_DATABASE_URL` |
| `--turso-token` | `TURSO_AUTH_TOKEN` |
| `--supabase-url` | `SUPABASE_URL` |
| `--supabase-key` | `SUPABASE_SERVICE_KEY` |
| `--ai-provider` | `AI_PROVIDER` |
| `--no-cron` | `CRON_ENABLED=false` |

---

## 配置优先级

```
1. CLI 参数          (最高优先级，覆盖所有)
   ↓
2. 环境变量          (如 SERVER_PORT)
   ↓
3. 配置文件          (efficio.json)
   ↓
4. 默认值           (最低优先级)
```

---

## 故障排除

### 端口被占用

```
Error: listen EADDRINUSE: address already in use :::3001
```

解决：
```bash
./efficio-server --port 3002
```

### 无法从外部访问

```bash
# 确保使用 0.0.0.0
./efficio-server --host 0.0.0.0

# 开放防火墙
sudo ufw allow 3001/tcp
```

### 配置文件无效

```bash
# 验证配置文件
./efficio-server config --validate

# 检查 JSON 格式
jq . ~/.config/efficio.json
```

### 查看完整配置

```bash
# 显示合并后的配置（包含默认值）
./efficio-server config --show

# JSON 格式输出
./efficio-server config --json
```
