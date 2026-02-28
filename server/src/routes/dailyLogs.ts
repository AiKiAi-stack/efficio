import { Router } from 'express';
import { supabase, isMemoryMode, inMemoryStore } from '../lib/database';

export const dailyLogsRouter = Router();

// 获取当日日志
dailyLogsRouter.get('/today', async (req, res) => {
  try {
    const userId = req.headers['x-user-id'] as string;
    if (!userId) {
      return res.status(401).json({ success: false, error: '未授权' });
    }

    const today = new Date().toISOString().split('T')[0];

    if (isMemoryMode) {
      const log = inMemoryStore.daily_logs?.find(
        (l: any) => l.user_id === userId && l.log_date === today
      );
      return res.json({ success: true, data: log || null });
    }

    const { data, error } = await supabase
      .from('daily_logs')
      .select('*')
      .eq('user_id', userId)
      .eq('log_date', today)
      .single();

    if (error && error.code !== 'PGRST116') throw error;

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

    const logData = {
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

    if (isMemoryMode) {
      if (!inMemoryStore.daily_logs) {
        inMemoryStore.daily_logs = [];
      }
      const store = inMemoryStore.daily_logs as any[];
      const existingIdx = store.findIndex(
        (l: any) => l.user_id === userId && l.log_date === today
      );

      if (existingIdx >= 0) {
        Object.assign(store[existingIdx], logData);
        return res.json({ success: true, data: store[existingIdx] });
      } else {
        const newLog = { ...logData, id: Math.random().toString(36).substring(2) };
        store.push(newLog);
        return res.json({ success: true, data: newLog });
      }
    }

    // 检查是否已存在
    const { data: existing } = await supabase
      .from('daily_logs')
      .select('id')
      .eq('user_id', userId)
      .eq('log_date', today)
      .single();

    let savedLog;

    if (existing) {
      const { data, error } = await supabase
        .from('daily_logs')
        .update(logData)
        .eq('id', existing.id)
        .select()
        .single();

      if (error) throw error;
      savedLog = data;
    } else {
      const { data, error } = await supabase
        .from('daily_logs')
        .insert([logData])
        .select()
        .single();

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
    const { days } = req.query;
    if (!userId) {
      return res.status(401).json({ success: false, error: '未授权' });
    }

    if (isMemoryMode) {
      let logs = inMemoryStore.daily_logs?.filter((l: any) => l.user_id === userId) || [];
      logs = logs.sort((a: any, b: any) =>
        new Date(b.log_date).getTime() - new Date(a.log_date).getTime()
      );
      if (days) {
        const limit = parseInt(days as string);
        logs = logs.slice(0, limit);
      }
      return res.json({ success: true, data: logs });
    }

    let query = supabase
      .from('daily_logs')
      .select('*')
      .eq('user_id', userId)
      .order('log_date', { ascending: false });

    if (days) {
      const limit = parseInt(days as string);
      query = query.limit(limit);
    }

    const { data, error } = await query;
    if (error) throw error;

    res.json({ success: true, data: data || [] });
  } catch (error) {
    console.error('Get history error:', error);
    res.status(500).json({ success: false, error: '获取历史失败' });
  }
});
