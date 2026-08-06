import { Router } from 'express';
import { getDatabase } from '../lib/database-new';

export const dailyLogsRouter = Router();

// 获取当日日志
dailyLogsRouter.get('/today', async (req, res) => {
  try {
    const userId = req.headers['x-user-id'] as string;
    if (!userId) {
      return res.status(401).json({ success: false, error: '未授权' });
    }

    const today = new Date().toISOString().split('T')[0];

    const db = getDatabase();
    const { data, error } = await db.selectSingle('daily_logs', {
      where: { user_id: userId, log_date: today }
    });

    if (error) throw error;

    res.json({ success: true, data: data || null });
  } catch (error) {
    console.error('Get today log error:', error);
    res.status(500).json({ success: false, error: '获取今日日志失败' });
  }
});

// 保存/更新当日日志
dailyLogsRouter.post('/', async (req, res) => {
  try {
    const userId = req.headers['x-user-id'] as string;
    if (!userId) {
      return res.status(401).json({ success: false, error: '未授权' });
    }

    const {
      goals,
      goal_priority,
      accomplishments,
      reflection,
      lessons_learned,
      improvement_plan,
      mood_score,
      energy_level
    } = req.body;

    const today = new Date().toISOString().split('T')[0];

    const logData: Record<string, any> = {
      user_id: userId,
      log_date: today,
      goals: goals || null,
      goal_priority: goal_priority || null,
      start_time: req.body.start_time || new Date().toISOString(),
      end_time: req.body.end_time || null,
      accomplishments: accomplishments || null,
      reflection: reflection || null,
      lessons_learned: lessons_learned || null,
      improvement_plan: improvement_plan || null,
      mood_score: mood_score || null,
      energy_level: energy_level || null,
      structured_data: null,
      updated_at: new Date().toISOString()
    };

    const db = getDatabase();

    // 检查是否已存在
    const { data: existing } = await db.selectSingle('daily_logs', {
      where: { user_id: userId, log_date: today }
    });

    let savedLog;

    if (existing) {
      const { data, error } = await db.update('daily_logs', existing.id, logData);
      if (error) throw error;
      savedLog = data;
    } else {
      const { data, error } = await db.insert('daily_logs', logData);
      if (error) throw error;
      savedLog = data;
    }

    res.json({ success: true, data: savedLog });
  } catch (error) {
    console.error('Save daily log error:', error);
    res.status(500).json({ success: false, error: '保存日志失败' });
  }
});

// 获取历史日志
dailyLogsRouter.get('/history', async (req, res) => {
  try {
    const userId = req.headers['x-user-id'] as string;
    if (!userId) {
      return res.status(401).json({ success: false, error: '未授权' });
    }

    const { days } = req.query;
    const limit = days ? parseInt(days as string) : undefined;

    const db = getDatabase();
    const { data, error } = await db.select('daily_logs', {
      where: { user_id: userId },
      orderBy: { column: 'log_date', direction: 'DESC' },
      limit
    });

    if (error) throw error;

    res.json({ success: true, data: data || [] });
  } catch (error) {
    console.error('Get history error:', error);
    res.status(500).json({ success: false, error: '获取历史失败' });
  }
});
