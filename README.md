# Efficiency Tracker - 效率追踪器

> 工作记录与效率分析系统 - Work Record & Efficiency Analysis System

一个基于 AI 的个人/团队效率分析工具，帮助你记录工作、优化表达、分析效率模式。

## 🎯 核心功能

- **工作记录** - 简单快速的每日工作记录
- **AI 优化** - 自动优化工作表达，突出价值
- **历史记录** - 长期存储和查看
- **结构化分析** - 任务分类、时间提取、标签生成
- **周/月总结** - 自动生成效率报告
- **优化建议** - 基于数据的行动建议

## 🏗️ 技术栈

### 后端
- Node.js + Express
- TypeScript
- Supabase (PostgreSQL)
- Anthropic Claude API

### 前端
- React 18 + TypeScript
- Vite
- TailwindCSS
- React Router

## 🚀 快速开始

### 方式一：Docker 部署（推荐）

```bash
# 复制环境变量
cp .env.example .env

# 编辑 .env 填入配置
# - SUPABASE_URL
# - SUPABASE_SERVICE_KEY
# - ANTHROPIC_API_KEY

# 启动服务
docker-compose up -d

# 查看日志
docker-compose logs -f
```

访问 http://localhost:3001

### 方式二：开发模式

### 1. 环境准备

```bash
# 安装依赖
npm install

# 安装服务端依赖
cd server && npm install

# 安装客户端依赖
cd ../client && npm install
```

### 2. 配置环境变量

```bash
# 复制环境变量文件
cp server/.env.example server/.env
cp client/.env.example client/.env

# 编辑 server/.env 配置：
# - SUPABASE_URL
# - SUPABASE_SERVICE_KEY
# - ANTHROPIC_API_KEY
```

### 3. 初始化数据库

在 Supabase 控制台执行 `server/sql/init.sql`

### 4. 启动开发服务器

```bash
# 根目录执行
npm run dev
```

访问 http://localhost:5173

## 📁 项目结构

```
efficiency-tracker/
├── client/              # 前端 React 应用
│   ├── src/
│   │   ├── App.tsx
│   │   ├── api.ts
│   │   └── pages/
│   │       └── Dashboard.tsx
│   ├── package.json
│   └── vite.config.ts
├── server/              # 后端 Express 服务
│   ├── src/
│   │   ├── routes/
│   │   │   ├── auth.ts
│   │   │   ├── records.ts
│   │   │   ├── optimize.ts
│   │   │   ├── analyze.ts
│   │   │   ├── summaries.ts
│   │   │   ├── trends.ts
│   │   │   └── suggestions.ts
│   │   ├── lib/
│   │   │   ├── database.ts
│   │   │   ├── ai.ts
│   │   │   └── cron.ts
│   │   └── index.ts
│   ├── sql/
│   │   └── init.sql
│   └── package.json
├── docker-compose.yml   # Docker 编排
├── Dockerfile          # Docker 镜像
├── DEPLOY.md          # 部署文档
├── .env.example       # 环境变量示例
└── README.md
```

## 📋 API 接口

### 认证
- `POST /api/auth/login` - 用户登录

### 工作记录
- `GET /api/records` - 获取记录列表
- `POST /api/records` - 创建新记录（含自动 AI 分析）
- `GET /api/records/:id` - 获取单条记录
- `DELETE /api/records/:id` - 删除记录

### AI 功能
- `POST /api/optimize` - AI 文本优化
- `POST /api/analyze` - AI 结构化分析

### 周总结
- `GET /api/summaries/weekly` - 获取周总结列表
- `POST /api/summaries/weekly/generate` - 生成周总结

### 月趋势
- `GET /api/trends/monthly` - 获取月趋势列表
- `POST /api/trends/monthly/generate` - 生成月趋势

### 优化建议
- `GET /api/suggestions` - 获取优化建议
- `POST /api/suggestions/generate` - 生成优化建议
- `PATCH /api/suggestions/:id/action` - 标记建议为已执行

## 📅 开发计划

参见 [design.md](./design.md)

| 阶段 | 时间 | 内容 | 状态 |
|------|------|------|------|
| Phase 1 | Week 1-2 | MVP - 基础记录系统 | ✅ 完成 |
| Phase 2 | Week 3-4 | 结构化数据抽取 | ✅ 完成 |
| Phase 3 | Week 5-6 | 周总结 Agent | ✅ 完成 |
| Phase 4 | Week 7-8 | 月趋势分析 | ✅ 完成 |
| Phase 5 | Week 9-10 | Dashboard | ✅ 完成 |
| Phase 6 | Week 11-12 | 优化建议 | ✅ 完成 |

## 📝 设计原则

1. **只做自己会长期使用的功能** - 避免过度设计
2. **结构化优先于花哨 UI** - 数据价值 > 视觉效果
3. **AI 输出必须有决策价值** - 每个输出都要有行动指导
4. **系统要可演进** - 分阶段迭代

## 🔒 安全注意

- 不要提交 `.env` 文件到版本控制
- 生产环境使用 HTTPS
- 定期轮换 API 密钥

## 📄 License

MIT
