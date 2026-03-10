# CLI 配置系统实现总结

## 实现概述

已完成 Efficio Server 的完整 CLI 配置系统实现，支持通过命令行参数、环境变量和配置文件三种方式配置服务器。

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

## 支持的配置参数

### Server 配置
| 参数 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| `--port` | number | 3001 | HTTP 监听端口 |
| `--host` | string | localhost | 监听地址 (0.0.0.0 表示公开) |
| `--env` | string | production | 运行环境：development / production |
| `--log-level` | string | info | 日志级别：debug / info / warn / error |
| `--allowed-origins` | string[] | localhost:* | CORS 允许的源 |

### Database 配置
| 参数 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| `--db-mode` | string | sqlite | 数据库模式：memory/sqlite/turso/supabase |
| `--db-path` | string | ./data/efficiency.db | SQLite 数据库路径 |
| `--turso-url` | string | - | Turso 数据库 URL |
| `--turso-token` | string | - | Turso 认证 Token |
| `--supabase-url` | string | - | Supabase 项目 URL |
| `--supabase-key` | string | - | Supabase 服务密钥 |

### AI Provider 配置
| 参数 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| `--ai-provider` | string | anthropic | AI 提供商名称 |

支持的 AI 提供商：anthropic, openai, deepseek, zhipu, kimi, nvidia, vllm, aliyun, volcengine, minimax, openrouter

### Cron 配置
| 参数 | 说明 |
|------|------|
| `--no-cron` | 禁用定时任务 |

### 其他
| 参数 | 说明 |
|------|------|
| `--config` | 配置文件路径 |
| `--open-browser` | 启动时打开浏览器 |

## 配置文件格式

配置文件位置（优先级从高到低）：
1. 命令行 `--config` 指定的路径
2. 当前目录的 `efficio.json`
3. `~/.config/efficio.json`
4. `./config/efficio.json`
5. `.efficio.json`

### 配置文件示例

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
      }
    }
  },
  "cron": {
    "enabled": true,
    "weeklySummary": "0 8 * * 1"
  }
}
```

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

## 使用场景

### VPS 部署（公开访问）

```bash
./efficio-server --host 0.0.0.0 --port 3001
```

### 本地开发

```bash
./efficio-server --env development --open-browser
```

### 切换 AI Provider

```bash
./efficio-server --ai-provider deepseek
```

### 使用 Turso 数据库

```bash
./efficio-server \
  --db-mode turso \
  --turso-url "libsql://org-db.turso.io" \
  --turso-token "eyJhbG..."
```

## 环境变量兼容性

CLI 参数会自动转换为环境变量：

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

## 技术实现

### 核心文件

- `src/cli.ts` - CLI 主程序，包含：
  - 配置接口定义
  - 配置文件查找和加载
  - 深层合并算法
  - 环境变量导出
  - 启动信息显示

- `src/index.ts` - 主服务器程序，从环境变量读取配置

### 配置合并算法

```typescript
function deepMerge(target, source): Record<string, unknown> {
  const result = { ...target };
  for (const key in source) {
    if (source[key] instanceof Object && key in result) {
      result[key] = deepMerge(result[key], source[key]);
    } else if (source[key] !== undefined) {
      result[key] = source[key];
    }
  }
  return result;
}
```

## 构建和部署

### GitHub Actions

CI/CD 工作流已配置为在 main 分支推送和标签推送时自动触发：

```yaml
on:
  push:
    branches:
      - main
    tags:
      - 'v*'
```

### 支持的平台

- Linux x64 (`efficio-server-linux-x64.tar.gz`)
- macOS x64 (`efficio-server-macos-x64.tar.gz`)
- Windows x64 (`efficio-server-win-x64.zip`)

## 测试验证

所有功能已通过测试：

```bash
# CLI 帮助
./efficio-server --help

# 配置显示
./efficio-server config --show

# 自定义参数启动
./efficio-server --port 8080 --host 0.0.0.0 --log-level debug
```

## 文档

- `CLI_USAGE.md` - 完整的使用指南
- `efficio.example.json` - 配置文件示例

## 下一步

1. 创建新的 Git 标签触发 Release
2. 在 VPS 上测试实际部署
3. 添加更多 AI Provider 的配置示例
