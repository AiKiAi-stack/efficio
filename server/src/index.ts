import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';
import { recordsRouter } from './routes/records';
import { authRouter } from './routes/auth';
import { optimizeRouter } from './routes/optimize';
import { analyzeRouter } from './routes/analyze';
import { summariesRouter } from './routes/summaries';
import { trendsRouter } from './routes/trends';
import { suggestionsRouter } from './routes/suggestions';
import { dailyLogsRouter } from './routes/dailyLogs';
import { taskLogsRouter } from './routes/taskLogs';
import { settingsRouter } from './routes/settings';
import { jiraRouter } from './routes/jira';
import { initCronJobs } from './lib/cron';
import { initializeDatabase } from './lib/database-new';
import { getDefaultEnvFilePath } from './lib/config-manager';
import { patchConsole, requestLogger } from './lib/logger';
import { systemRouter } from './routes/system';
import { isAiAvailable } from './lib/ai';

// 从固定路径加载 .env（不随启动目录变化，见 lib/config-manager.ts）
dotenv.config({ path: getDefaultEnvFilePath() });

// 日志补丁：console.error/warn 落文件 + 最近错误缓冲（可追溯）
patchConsole();

const app = express();

// 从环境变量读取配置（由 CLI 设置）
const PORT = parseInt(process.env.SERVER_PORT || process.env.PORT || '3001', 10);
const HOST = process.env.SERVER_HOST || process.env.HOST || 'localhost';
const LOG_LEVEL = (process.env.LOG_LEVEL as 'debug' | 'info' | 'warn' | 'error') || 'info';

// 初始化数据库（在 HTTP 服务启动前完成，失败则快速退出）
// 见文件底部 app.listen 处的初始化调用

// CORS 配置
const allowedOrigins = process.env.ALLOWED_ORIGINS?.split(',').filter(Boolean) || [
  'http://localhost:5173',
  'http://localhost:5174',
  'http://localhost:5175'
];

app.use(cors({
  origin: (origin, callback) => {
    if (!origin || allowedOrigins.includes(origin) || /^http:\/\/localhost:\d+$/.test(origin)) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
}));

app.use(express.json());
app.use(express.text());

// 请求日志中间件：request-id + 方法/路径/状态/耗时
app.use(requestLogger);

// Health check
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'production',
    version: (() => {
      try {
        // eslint-disable-next-line @typescript-eslint/no-var-requires
        return require('../../package.json').version || '0.1.0';
      } catch {
        return '0.1.0';
      }
    })(),
    database: process.env.DATABASE_MODE || 'sqlite',
    aiConfigured: isAiAvailable()
  });
});

// API Routes
app.use('/api/system', systemRouter);
app.use('/api/auth', authRouter);
app.use('/api/records', recordsRouter);
app.use('/api/optimize', optimizeRouter);
app.use('/api/analyze', analyzeRouter);
app.use('/api/summaries', summariesRouter);
app.use('/api/trends', trendsRouter);
app.use('/api/suggestions', suggestionsRouter);
app.use('/api/daily-logs', dailyLogsRouter);
app.use('/api/task-logs', taskLogsRouter);
app.use('/api/settings', settingsRouter);
app.use('/api/jira', jiraRouter);

// 生产环境：服务前端静态文件
if (process.env.NODE_ENV === 'production') {
  const fs = require('fs');
  const path = require('path');

  // pkg 打包后，需要找到 client/dist 的正确路径
  // pkg 环境中，process.execPath 指向 binary，__dirname 类似于 /snapshot/project/server/dist
  // 尝试多个可能的位置
  const possiblePaths = [
    // pkg 环境：client/dist 被打包到 /snapshot/project/client/dist
    '/snapshot/server/client/dist',
    '/snapshot/efficio/client/dist',
    // 也可能在 binary 同级目录
    path.join(path.dirname(process.execPath), 'client', 'dist'),
    // 普通 Node 环境：相对路径
    path.join(__dirname, '../../client/dist'),
    path.join(__dirname, '../client/dist'),
  ];

  let clientDist: string | null = null;
  for (const p of possiblePaths) {
    if (fs.existsSync(p)) {
      clientDist = p;
      break;
    }
  }

  if (clientDist) {
    app.use(express.static(clientDist, {
      index: 'index.html',
      fallthrough: false
    }));

    // SPA fallback - 所有非 API 的 GET 请求返回 index.html
    // 用中间件而非 app.get('*')：Express 5 的 path-to-regexp 不再支持 '*' 通配符
    app.use((req, res, next) => {
      if (req.method !== 'GET' || req.path.startsWith('/api/')) {
        return next();
      }
      res.sendFile(path.join(clientDist, 'index.html'));
    });
  } else {
    console.warn('⚠️  Client dist directory not found. Frontend will not be served.');
  }
}

// Error handling
app.use((err: Error, req: express.Request, res: express.Response, next: express.NextFunction) => {
  if (LOG_LEVEL === 'debug') {
    console.error('Error:', err);
  }
  res.status(500).json({
    success: false,
    error: err.message,
    requestId: (req.headers['x-request-id'] as string) || undefined
  });
});

initializeDatabase().then(() => {
  app.listen(PORT, HOST, () => {
  const displayHost = HOST === '0.0.0.0' ? 'localhost' : HOST;
  const baseUrl = `http://${displayHost}:${PORT}`;

  console.log(`🚀 Server running on ${baseUrl}`);
  console.log(`📡 Listening on ${HOST}:${PORT}`);
  console.log(`📝 Environment: ${process.env.NODE_ENV || 'production'}`);
  console.log(`📊 Log Level: ${LOG_LEVEL}`);

  // 如果需要打开浏览器
  if (process.env.OPEN_BROWSER === 'true') {
    console.log('🌐 Opening browser...');
    import('open').then(({ default: open }) => {
      open(baseUrl).catch(() => {
        console.log('  Unable to open browser automatically');
      });
    });
  }

  // 初始化定时任务
  const cronEnabled = process.env.CRON_ENABLED !== 'false';
  if (cronEnabled) {
    console.log('⏰ Cron jobs enabled');
    initCronJobs();
  } else {
    console.log('⏰ Cron jobs disabled');
  }
  });
}).catch(err => {
  console.error('Database initialization failed:', err);
  process.exit(1);
});
