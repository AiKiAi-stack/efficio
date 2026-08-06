import { Router } from 'express';
import { getRecentErrors } from '../lib/logger';
import { isAiAvailable, getCurrentProvider } from '../lib/ai';
import { getDatabaseMode, getDatabase } from '../lib/database-new';

export const systemRouter = Router();

// 获取最近错误（可追溯性：用户/前端可直接查看服务器最近发生了什么）
systemRouter.get('/recent-errors', (req, res) => {
  try {
    const limit = parseInt(req.query.limit as string, 10) || 20;
    res.json({
      success: true,
      data: getRecentErrors(Math.min(limit, 100))
    });
  } catch (error) {
    console.error('Get recent errors error:', error);
    res.status(500).json({ success: false, error: '获取最近错误失败' });
  }
});

// 系统状态（数据库连通性 / AI 配置状态 / 版本）
systemRouter.get('/status', async (req, res) => {
  try {
    const db = getDatabase();

    let dbConnected = false;
    try {
      const result = await db.select('users', { limit: 1 });
      dbConnected = !result.error;
    } catch {
      dbConnected = false;
    }

    const provider = getCurrentProvider();

    let version = '0.1.0';
    try {
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const pkg = require('../../package.json');
      version = pkg.version || version;
    } catch {
      // 版本读取失败使用默认值
    }

    res.json({
      success: true,
      data: {
        version,
        database: {
          mode: getDatabaseMode(),
          connected: dbConnected
        },
        ai: {
          configured: isAiAvailable(),
          provider: provider?.provider || 'anthropic',
          model: provider?.model || null
        },
        recentErrorCount: getRecentErrors(100).length
      }
    });
  } catch (error) {
    console.error('Get system status error:', error);
    res.status(500).json({ success: false, error: '获取系统状态失败' });
  }
});
