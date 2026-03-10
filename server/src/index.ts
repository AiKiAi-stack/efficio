import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
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
import { initCronJobs } from './lib/cron';
import { initializeDatabase } from './lib/database-new';
import open from 'open';

dotenv.config();

const app = express();

// 从环境变量或默认值读取配置（CLI 已设置环境变量）
const PORT = parseInt(process.env.SERVER_PORT || process.env.PORT || '3001', 10);
const HOST = process.env.SERVER_HOST || process.env.HOST || 'localhost';

// 初始化数据库
initializeDatabase().catch(err => {
  console.error('数据库初始化失败:', err);
  process.exit(1);
});

// CORS 配置
const allowedOrigins = process.env.ALLOWED_ORIGINS?.split(',') || [
  'http://localhost:5173',
  'http://localhost:5174',
  'http://localhost:5175'
];

app.use(cors({
  origin: (origin, callback) => {
    // 允许所有 localhost 端口用于开发
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

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// API Routes
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

// Error handling
app.use((err: Error, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error('Error:', err);
  res.status(500).json({
    success: false,
    error: err.message
  });
});

app.listen(PORT, HOST, () => {
  const baseUrl = `http://${HOST === '0.0.0.0' ? 'localhost' : HOST}:${PORT}`;

  console.log(`🚀 Server running on ${baseUrl}`);
  console.log(`📝 Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`📡 Listening on ${HOST}:${PORT}`);

  // 如果需要打开浏览器
  if (process.env.OPEN_BROWSER === 'true') {
    console.log('🌐 Opening browser...');
    open(baseUrl).catch(() => {
      console.log('  Unable to open browser automatically');
    });
  }

  // 初始化定时任务
  initCronJobs();
});
