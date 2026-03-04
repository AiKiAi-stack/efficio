# RecordEvo - 效率追踪器

> 🎯 基于 PDCA 循环的个人/团队效率分析工具 - 记录工作、优化表达、分析效率模式

[![TypeScript](https://img.shields.io/badge/TypeScript-5.3-blue.svg)](https://www.typescriptlang.org/)
[![React](https://img.shields.io/badge/React-18.2-087ea4.svg)](https://react.dev/)
[![Node.js](https://img.shields.io/badge/Node.js-20+-228f3c.svg)](https://nodejs.org/)
[![License](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

**[🌐 English Version](README.md)**

---

## ✨ 特性亮点

| 特性 | 描述 |
|------|------|
| 📝 **工作记录** | 3 分钟内完成每日工作记录，支持半结构化输入 |
| 🤖 **AI 优化** | 基于 Anthropic Claude 自动优化工作表达，突出价值 |
| 📊 **结构化分析** | 自动任务分类、时间提取、标签生成、深度工作判断 |
| 📈 **周/月总结** | 自动生成效率报告，识别时间分布和任务模式 |
| 💡 **优化建议** | 基于数据的个性化行动建议，提升效率 |
| 🌍 **天气集成** | 实时天气显示，记录效率与天气的关联 |
| 🔌 **多 AI Provider** | 支持 10+ AI 服务，包括自定义 OpenAI 兼容端点 |

---

## 🏗️ 架构图

```
┌─────────────┐     ┌─────────┐     ┌──────────────┐     ┌──────────┐
│  Web 输入   │ ──▶│  API    │ ──▶ │  AI 处理层   │ ──▶ │  数据库  │
│  界面       │     │  服务   │     │  优化 + 结构化│     │  存储    │
└─────────────┘     └─────────┘     └──────────────┘     └──────────┘
                                               │
                                               ▼
                                      ┌──────────────┐
                                      │  Markdown    │
                                      │  Dashboard   │
                                      └──────────────┘
```

---

## 🚀 快速开始

### 方式一：Docker 部署（推荐生产环境）

```bash
# 1. 克隆项目
git clone https://github.com/your-org/RecordEvo.git
cd RecordEvo

# 2. 复制环境变量
cp .env.example .env

# 3. 编辑 .env 填入配置
# - SUPABASE_URL
# - SUPABASE_SERVICE_KEY
# - ANTHROPIC_API_KEY

# 4. 启动服务
docker-compose up -d

# 5. 查看日志
docker-compose logs -f
```

访问 http://localhost:3001

### 方式二：开发模式

```bash
# 1. 安装依赖
npm install

# 2. 配置环境变量
cp server/.env.example server/.env
# 编辑 server/.env 配置

# 3. 启动开发服务器
npm run dev
```

访问：
- 前端：http://localhost:5173
- 后端：http://localhost:3001

---

## 📦 技术栈

### 后端
| 技术 | 用途 |
|------|------|
| **Node.js + Express** | Web 服务器框架 |
| **TypeScript** | 类型安全的 JavaScript |
| **SQLite / Turso** | 本地/云端数据库 |
| **Supabase** | PostgreSQL 云端数据库（可选） |
| **Anthropic SDK** | Claude AI 集成 |
| **OpenAI SDK** | 多 AI Provider 兼容 |
| **node-cron** | 定时任务调度 |
| **Zod** | 运行时类型验证 |

### 前端
| 技术 | 用途 |
|------|------|
| **React 18** | UI 框架 |
| **TypeScript** | 类型安全 |
| **Vite** | 构建工具 |
| **TailwindCSS** | 原子化 CSS |
| **React Router** | 路由管理 |
| **Recharts** | 数据可视化 |

---

## 📋 API 接口

### 认证
| 方法 | 端点 | 描述 |
|------|------|------|
| POST | `/api/auth/login` | 用户登录 |

### 工作记录
| 方法 | 端点 | 描述 |
|------|------|------|
| GET | `/api/records` | 获取记录列表 |
| POST | `/api/records` | 创建新记录（含 AI 分析） |
| GET | `/api/records/:id` | 获取单条记录 |
| DELETE | `/api/records/:id` | 删除记录 |

### AI 功能
| 方法 | 端点 | 描述 |
|------|------|------|
| POST | `/api/optimize` | AI 文本优化 |
| POST | `/api/analyze` | AI 结构化分析 |

### 总结报告
| 方法 | 端点 | 描述 |
|------|------|------|
| GET | `/api/summaries/weekly` | 获取周总结列表 |
| POST | `/api/summaries/weekly/generate` | 生成周总结 |
| GET | `/api/trends/monthly` | 获取月趋势 |
| POST | `/api/trends/monthly/generate` | 生成月趋势 |

### 优化建议
| 方法 | 端点 | 描述 |
|------|------|------|
| GET | `/api/suggestions` | 获取优化建议 |
| POST | `/api/suggestions/generate` | 生成优化建议 |
| PATCH | `/api/suggestions/:id/action` | 标记建议已执行 |

### 设置
| 方法 | 端点 | 描述 |
|------|------|------|
| GET | `/api/settings/ai-providers` | 获取所有 AI Provider |
| POST | `/api/settings/ai-providers/:provider/config` | 保存 Provider 配置 |
| POST | `/api/settings/ai-providers/:provider/activate` | 激活 Provider |
| POST | `/api/settings/ai-providers/:provider/test` | 测试连接 |
| GET | `/api/settings/custom-providers` | 获取自定义 Provider |
| POST | `/api/settings/custom-providers` | 创建自定义 Provider |
| PUT | `/api/settings/custom-providers/:id` | 更新自定义 Provider |
| DELETE | `/api/settings/custom-providers/:id` | 删除自定义 Provider |

---

## 📁 项目结构

```
RecordEvo/
├── client/                 # 前端 React 应用
│   ├── src/
│   │   ├── App.tsx        # 主应用组件
│   │   ├── api.ts         # API 客户端
│   │   └── pages/
│   │       ├── Dashboard.tsx      # 仪表板
│   │       ├── TaskTracker.tsx    # 任务追踪
│   │       ├── RecordsHistory.tsx # 历史记录
│   │       └── Settings.tsx       # 设置页面
│   ├── package.json
│   └── vite.config.ts
│
├── server/                 # 后端 Express 服务
│   ├── src/
│   │   ├── index.ts       # 入口文件
│   │   ├── routes/        # API 路由
│   │   │   ├── auth.ts
│   │   │   ├── records.ts
│   │   │   ├── optimize.ts
│   │   │   ├── analyze.ts
│   │   │   ├── summaries.ts
│   │   │   ├── trends.ts
│   │   │   ├── suggestions.ts
│   │   │   └── settings.ts
│   │   └── lib/           # 核心库
│   │       ├── ai.ts              # AI 服务
│   │       ├── ai-providers.ts    # AI Provider 管理
│   │       ├── config-manager.ts  # 配置管理
│   │       ├── database.ts        # 数据库服务
│   │       ├── database-adapter.ts# 数据库适配器接口
│   │       ├── sqlite-adapter.ts  # SQLite 实现
│   │       ├── turso-adapter.ts   # Turso 实现
│   │       └── cron.ts            # 定时任务
│   ├── sql/
│   │   └── sqlite-schema.sql      # 数据库 Schema
│   └── package.json
│
├── scripts/                # 工具脚本
├── docker-compose.yml      # Docker 编排
├── Dockerfile             # Docker 镜像
├── .env.example           # 环境变量示例
└── package.json           # 根项目配置
```

---

## 🎯 支持 AI Provider

### 预定义 Provider

| Provider | 描述 |
|----------|------|
| Anthropic Claude | 美国 AI 公司，Claude 系列模型 |
| OpenAI GPT | GPT-4/ChatGPT |
| DeepSeek | 国产大模型，性价比高 |
| Zhipu AI | 智谱 AI，GLM 系列 |
| Kimi | 月之暗面，长文本处理 |
| NVIDIA NIM | NVIDIA GPU 云，Llama 等模型 |
| vLLM | 开源模型推理框架 |
| 阿里云百炼 | 通义千问 Qwen 系列 |
| 火山引擎 | 豆包/方舟大模型 |
| MiniMax | 国产 MiniMax 大模型 |
| OpenRouter | 聚合多个 AI 服务商 |

### 自定义 Provider

支持添加任意 OpenAI 兼容的 API 端点，只需提供：
- Provider 名称
- API Key
- API Endpoint
- 模型名称

---

## 🔧 环境变量

```bash
# 必需配置
SUPABASE_URL=your_supabase_url          # Supabase 项目 URL
SUPABASE_SERVICE_KEY=your_service_key   # Supabase 服务密钥
ANTHROPIC_API_KEY=your_anthropic_key    # Anthropic API Key

# 可选配置
PORT=3001                               # 服务器端口
NODE_ENV=production                     # 运行环境
ALLOWED_ORIGINS=http://localhost:5173   # CORS 允许的来源

# AI Provider 配置（根据需要配置）
OPENAI_API_KEY=your_openai_key
DEEPSEEK_API_KEY=your_deepseek_key
ZHIPU_API_KEY=your_zhipu_key
# ... 更多 Provider 配置

# 数据库模式（可选：memory | sqlite | turso）
DATABASE_MODE=sqlite
SQLITE_DB_PATH=./data/efficiency.db
```

---

## 📅 开发路线图

| 阶段 | 时间 | 内容 | 状态 |
|------|------|------|------|
| Phase 1 | Week 1-2 | MVP - 基础记录系统 | ✅ 完成 |
| Phase 2 | Week 3-4 | 结构化数据抽取 | ✅ 完成 |
| Phase 3 | Week 5-6 | 周总结 Agent | ✅ 完成 |
| Phase 4 | Week 7-8 | 月趋势分析 | ✅ 完成 |
| Phase 5 | Week 9-10 | Dashboard | ✅ 完成 |
| Phase 6 | Week 11-12 | 优化建议 | ✅ 完成 |
| Phase 7 | Week 13+ | SQLite/Turso 支持 | ✅ 完成 |
| Phase 8 | Week 14+ | 自定义 AI Provider | ✅ 完成 |

---

## 🛡️ 安全注意

- ⚠️ **不要提交 `.env` 文件到版本控制**
- 🔒 **生产环境使用 HTTPS**
- 🔑 **定期轮换 API 密钥**
- 🚫 **限制 CORS 来源**

---

## 📝 设计原则

1. **只做自己会长期使用的功能** - 避免过度设计
2. **结构化优先于花哨 UI** - 数据价值 > 视觉效果
3. **AI 输出必须有决策价值** - 每个输出都要有行动指导
4. **系统要可演进** - 分阶段迭代

---

## 🧪 测试

```bash
# 运行测试
npm test

# 测试覆盖率
npm run test:coverage

# 监听模式
npm run test:watch
```

---

## 🤝 贡献

1. Fork 本仓库
2. 创建特性分支 (`git checkout -b feature/AmazingFeature`)
3. 提交更改 (`git commit -m 'Add some AmazingFeature'`)
4. 推送到分支 (`git push origin feature/AmazingFeature`)
5. 开启 Pull Request

---

## 📄 License

MIT License - 详见 [LICENSE](LICENSE) 文件

---

## 🙏 致谢

- [Supabase](https://supabase.com/) - 数据库服务
- [React](https://react.dev/) - 前端框架
- [Express](https://expressjs.com/) - Web 框架

---

<div align="center">

**Made with ❤️ by RecordEvo Team**

[⭐ Star this repo](https://github.com/your-org/RecordEvo/stargazers) | [🐛 Report Issues](https://github.com/your-org/RecordEvo/issues)

</div>
