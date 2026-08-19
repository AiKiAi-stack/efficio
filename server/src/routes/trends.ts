import { Router } from 'express';
import { getDatabase } from '../lib/database-new';
import { generateMonthlyTrendForUser } from '../lib/report-generator';

export const trendsRouter = Router();

// 获取月趋势
trendsRouter.get('/monthly', async (req, res) => {
  try {
    const userId = req.headers['x-user-id'] as string;
    const { year, month } = req.query;

    if (!userId) {
      return res.status(401).json({
        success: false,
        error: '未授权'
      });
    }

    const db = getDatabase();
    const { data, error } = await db.select('monthly_trends', {
      where: { user_id: userId }
    });

    if (error) throw error;

    let trends = data || [];

    if (year && month) {
      const y = parseInt(year as string);
      const m = parseInt(month as string);
      trends = trends.filter(t => t.year === y && t.month === m);
    }

    // 按年份/月份降序排序
    trends = [...trends].sort((a, b) => {
      if (a.year !== b.year) return b.year - a.year;
      return b.month - a.month;
    });

    res.json({
      success: true,
      data: trends
    });
  } catch (error) {
    console.error('Get monthly trends error:', error);
    res.status(500).json({
      success: false,
      error: '获取月趋势失败'
    });
  }
});

// 生成月趋势分析
trendsRouter.post('/monthly/generate', async (req, res) => {
  try {
    const userId = req.headers['x-user-id'] as string;
    const { year, month } = req.body;

    if (!userId) {
      return res.status(401).json({
        success: false,
        error: '未授权'
      });
    }

    if (!year || !month) {
      return res.status(400).json({
        success: false,
        error: '请提供年份和月份'
      });
    }

    // 生成逻辑在 report-generator 中与 cron 共用
    // （含 12 月边界修复：原实现 endDate 计算错误导致 12 月永远查不到记录）
    const result = await generateMonthlyTrendForUser(userId, Number(year), Number(month));

    if (result.status === 'no_records') {
      return res.status(404).json({
        success: false,
        error: '该月暂无工作记录'
      });
    }

    res.json({
      success: true,
      data: result.data
    });
  } catch (error) {
    console.error('Generate monthly trend error:', error);
    res.status(500).json({
      success: false,
      error: '生成月趋势失败'
    });
  }
});
