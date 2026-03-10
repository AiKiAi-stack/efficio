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

dotenv.config();

const app = express();

// 从环境变量读取配置（由 CLI 设置）
const PORT = parseInt(process.env.SERVER_PORT || process.env.PORT || '3001', 10);
const HOST = process.env.SERVER_HOST || process.env.HOST || 'localhost';
const LOG_LEVEL = (process.env.LOG_LEVEL as 'debug' | 'info' | 'warn' | 'error') || 'info';

// 初始化数据库
initializeDatabase().catch(err => {
  console.error('Database initialization failed:', err);
  process.exit(1);
});

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

// Health check
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'production'
  });
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
  if (LOG_LEVEL === 'debug') {
    console.error('Error:', err);
  }
  res.status(500).json({
    success: false,
    error: err.message
  });
});

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
