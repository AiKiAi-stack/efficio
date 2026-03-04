# RecordEvo - Efficiency Tracker

> 🎯 PDCA-based personal/team efficiency analysis tool - Track work, optimize expression, analyze efficiency patterns

[![TypeScript](https://img.shields.io/badge/TypeScript-5.3-blue.svg)](https://www.typescriptlang.org/)
[![React](https://img.shields.io/badge/React-18.2-087ea4.svg)](https://react.dev/)
[![Node.js](https://img.shields.io/badge/Node.js-20+-228f3c.svg)](https://nodejs.org/)
[![License](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

**[🌐 中文](README_zh.md)**

---

## ✨ Features

| Feature | Description |
|---------|-------------|
| 📝 **Work Logging** | Complete daily work entries in 3 minutes, supports semi-structured input |
| 🤖 **AI Optimization** | Auto-optimize work expressions with Anthropic Claude, highlight value |
| 📊 **Structured Analysis** | Auto task classification, time extraction, tagging, deep work detection |
| 📈 **Weekly/Monthly Reports** | Auto-generate efficiency reports, identify time distribution and patterns |
| 💡 **Actionable Suggestions** | Personalized data-driven recommendations to boost efficiency |
| 🌍 **Weather Integration** | Real-time weather display, correlate efficiency with weather conditions |
| 🔌 **Multi AI Provider** | Support 10+ AI services, including custom OpenAI-compatible endpoints |

---

## 🏗️ Architecture

```
┌─────────────┐     ┌─────────┐     ┌──────────────┐     ┌──────────┐
│  Web Input  │ ──▶ │  API    │ ──▶ │  AI Layer    │ ──▶ │ Database │
│  Interface  │     │  Server │     │  Optimize +  │     │ Storage  │
└─────────────┘     └─────────┘     │  Structured  │     └──────────┘
                                    └──────────────┘
                                               │
                                               ▼
                                      ┌──────────────┐
                                      │  Markdown    │
                                      │  Dashboard   │
                                      └──────────────┘
```

---

## 🚀 Quick Start

### Option 1: Docker Deployment (Recommended for Production)

```bash
# 1. Clone the repository
git clone https://github.com/your-org/RecordEvo.git
cd RecordEvo

# 2. Copy environment file
cp .env.example .env

# 3. Edit .env with your credentials
# - SUPABASE_URL
# - SUPABASE_SERVICE_KEY
# - ANTHROPIC_API_KEY

# 4. Start services
docker-compose up -d

# 5. View logs
docker-compose logs -f
```

Visit http://localhost:3001

### Option 2: Development Mode

```bash
# 1. Install dependencies
npm install

# 2. Configure environment
cp server/.env.example server/.env
# Edit server/.env with your configuration

# 3. Start development server
npm run dev
```

Visit:
- Frontend: http://localhost:5173
- Backend: http://localhost:3001

---

## 📦 Tech Stack

### Backend
| Technology | Purpose |
|------------|---------|
| **Node.js + Express** | Web server framework |
| **TypeScript** | Type-safe JavaScript |
| **SQLite / Turso** | Local/Cloud database |
| **Supabase** | PostgreSQL cloud database (optional) |
| **Anthropic SDK** | Claude AI integration |
| **OpenAI SDK** | Multi AI Provider compatible |
| **node-cron** | Scheduled task management |
| **Zod** | Runtime type validation |

### Frontend
| Technology | Purpose |
|------------|---------|
| **React 18** | UI framework |
| **TypeScript** | Type safety |
| **Vite** | Build tool |
| **TailwindCSS** | Atomic CSS |
| **React Router** | Route management |
| **Recharts** | Data visualization |

---

## 📋 API Endpoints

### Authentication
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/auth/login` | User login |

### Work Records
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/records` | Get record list |
| POST | `/api/records` | Create new record (with AI analysis) |
| GET | `/api/records/:id` | Get single record |
| DELETE | `/api/records/:id` | Delete record |

### AI Features
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/optimize` | AI text optimization |
| POST | `/api/analyze` | AI structured analysis |

### Summary Reports
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/summaries/weekly` | Get weekly summaries |
| POST | `/api/summaries/weekly/generate` | Generate weekly summary |
| GET | `/api/trends/monthly` | Get monthly trends |
| POST | `/api/trends/monthly/generate` | Generate monthly trend |

### Suggestions
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/suggestions` | Get optimization suggestions |
| POST | `/api/suggestions/generate` | Generate suggestions |
| PATCH | `/api/suggestions/:id/action` | Mark suggestion as actioned |

### Settings
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/settings/ai-providers` | Get all AI Providers |
| POST | `/api/settings/ai-providers/:provider/config` | Save Provider config |
| POST | `/api/settings/ai-providers/:provider/activate` | Activate Provider |
| POST | `/api/settings/ai-providers/:provider/test` | Test connection |
| GET | `/api/settings/custom-providers` | Get custom Providers |
| POST | `/api/settings/custom-providers` | Create custom Provider |
| PUT | `/api/settings/custom-providers/:id` | Update custom Provider |
| DELETE | `/api/settings/custom-providers/:id` | Delete custom Provider |

---

## 📁 Project Structure

```
RecordEvo/
├── client/                 # Frontend React application
│   ├── src/
│   │   ├── App.tsx        # Main application component
│   │   ├── api.ts         # API client
│   │   └── pages/
│   │       ├── Dashboard.tsx      # Dashboard
│   │       ├── TaskTracker.tsx    # Task tracking
│   │       ├── RecordsHistory.tsx # History records
│   │       └── Settings.tsx       # Settings page
│   ├── package.json
│   └── vite.config.ts
│
├── server/                 # Backend Express service
│   ├── src/
│   │   ├── index.ts       # Entry point
│   │   ├── routes/        # API routes
│   │   │   ├── auth.ts
│   │   │   ├── records.ts
│   │   │   ├── optimize.ts
│   │   │   ├── analyze.ts
│   │   │   ├── summaries.ts
│   │   │   ├── trends.ts
│   │   │   ├── suggestions.ts
│   │   │   └── settings.ts
│   │   └── lib/           # Core libraries
│   │       ├── ai.ts              # AI service
│   │       ├── ai-providers.ts    # AI Provider management
│   │       ├── config-manager.ts  # Configuration management
│   │       ├── database.ts        # Database service
│   │       ├── database-adapter.ts# Database adapter interface
│   │       ├── sqlite-adapter.ts  # SQLite implementation
│   │       ├── turso-adapter.ts   # Turso implementation
│   │       └── cron.ts            # Scheduled tasks
│   ├── sql/
│   │   └── sqlite-schema.sql      # Database Schema
│   └── package.json
│
├── scripts/                # Utility scripts
├── docker-compose.yml      # Docker orchestration
├── Dockerfile             # Docker image
├── .env.example           # Environment variables example
└── package.json           # Root project configuration
```

---

## 🎯 Supported AI Providers

### Pre-defined Providers

| Provider | Description |
|----------|-------------|
| Anthropic Claude | US AI company, Claude series models |
| OpenAI GPT | GPT-4/ChatGPT |
| DeepSeek | Chinese large model, cost-effective |
| Zhipu AI | GLM series models |
| Kimi | Moonshot AI, long-text processing |
| NVIDIA NIM | NVIDIA GPU cloud, Llama and more |
| vLLM | Open-source model inference framework |
| Aliyun Bailian | Tongyi Qianwen Qwen series |
| Volcengine | Doubao/Ark large models |
| MiniMax | Chinese MiniMax large models |
| OpenRouter | Aggregates multiple AI providers |

### Custom Provider

Support adding any OpenAI-compatible API endpoint, just provide:
- Provider name
- API Key
- API Endpoint
- Model name

---

## 🔧 Environment Variables

```bash
# Required configuration
SUPABASE_URL=your_supabase_url          # Supabase project URL
SUPABASE_SERVICE_KEY=your_service_key   # Supabase service key
ANTHROPIC_API_KEY=your_anthropic_key    # Anthropic API Key

# Optional configuration
PORT=3001                               # Server port
NODE_ENV=production                     # Runtime environment
ALLOWED_ORIGINS=http://localhost:5173   # CORS allowed origins

# AI Provider configuration (as needed)
OPENAI_API_KEY=your_openai_key
DEEPSEEK_API_KEY=your_deepseek_key
ZHIPU_API_KEY=your_zhipu_key
# ... more Provider configurations

# Database mode (optional: memory | sqlite | turso)
DATABASE_MODE=sqlite
SQLITE_DB_PATH=./data/efficiency.db
```

---

## 📅 Roadmap

| Phase | Time | Content | Status |
|-------|------|---------|--------|
| Phase 1 | Week 1-2 | MVP - Basic recording system | ✅ Completed |
| Phase 2 | Week 3-4 | Structured data extraction | ✅ Completed |
| Phase 3 | Week 5-6 | Weekly Summary Agent | ✅ Completed |
| Phase 4 | Week 7-8 | Monthly trend analysis | ✅ Completed |
| Phase 5 | Week 9-10 | Dashboard | ✅ Completed |
| Phase 6 | Week 11-12 | Optimization suggestions | ✅ Completed |
| Phase 7 | Week 13+ | SQLite/Turso support | ✅ Completed |
| Phase 8 | Week 14+ | Custom AI Provider | ✅ Completed |

---

## 🛡️ Security Notes

- ⚠️ **Do NOT commit `.env` files to version control**
- 🔒 **Use HTTPS in production**
- 🔑 **Rotate API keys regularly**
- 🚫 **Restrict CORS origins**

---

## 📝 Design Principles

1. **Only build features you'll use long-term** - Avoid over-engineering
2. **Structure over fancy UI** - Data value > Visual effects
3. **AI output must have decision value** - Every output needs actionable guidance
4. **System must be evolvable** - Iterative development in phases

---

## 🧪 Testing

```bash
# Run tests
npm test

# Test coverage
npm run test:coverage

# Watch mode
npm run test:watch
```

---

## 🤝 Contributing

1. Fork this repository
2. Create your feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit your changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

---

## 📄 License

MIT License - See [LICENSE](LICENSE) file for details

---

## 🙏 Acknowledgments

- [Supabase](https://supabase.com/) - Database service
- [React](https://react.dev/) - Frontend framework
- [Express](https://expressjs.com/) - Web framework

---

<div align="center">

**Made with ❤️ by RecordEvo Team**

[⭐ Star this repo](https://github.com/your-org/RecordEvo/stargazers) | [🐛 Report Issues](https://github.com/your-org/RecordEvo/issues)

</div>
