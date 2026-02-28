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
import { initCronJobs } from './lib/cron';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;

// CORS 配置
const allowedOrigins = process.env.ALLOWED_ORIGINS?.split(',') || ['http://localhost:5173'];

app.use(cors({
  origin: (origin, callback) => {
    if (!origin || allowedOrigins.includes(origin)) {
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

// Error handling
app.use((err: Error, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error('Error:', err);
  res.status(500).json({
    success: false,
    error: err.message
  });
});

app.listen(PORT, () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
  console.log(`📝 Environment: ${process.env.NODE_ENV}`);

  // 初始化定时任务
  initCronJobs();
});
