import { Router } from 'express';
import { supabase, isMemoryMode, inMemoryStore } from '../lib/database';

export const taskLogsRouter = Router();

// 获取所有任务日志
taskLogsRouter.get('/', async (req, res) => {
  try {
    const userId = req.headers['x-user-id'] as string;
    if (!userId) {
      return res.status(401).json({ success: false, error: '未授权' });
    }

    if (isMemoryMode) {
      let logs = inMemoryStore.task_logs?.filter((l: any) => l.user_id === userId) || [];
      logs = logs.sort((a: any, b: any) =>
        new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      );
      return res.json({ success: true, data: logs });
    }

    const { data, error } = await supabase
      .from('task_logs')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (error) throw error;

    res.json({ success: true, data: data || [] });
  } catch (error) {
    console.error('Get task logs error:', error);
    res.status(500).json({ success: false, error: '获取任务列表失败' });
  }
});

// 获取单个任务日志
taskLogsRouter.get('/:id', async (req, res) => {
  try {
    const userId = req.headers['x-user-id'] as string;
    const taskId = req.params.id;
    if (!userId) {
      return res.status(401).json({ success: false, error: '未授权' });
    }

    if (isMemoryMode) {
      const log = inMemoryStore.task_logs?.find(
        (l: any) => l.id === taskId && l.user_id === userId
      );
      return res.json({ success: true, data: log || null });
    }

    const { data, error } = await supabase
      .from('task_logs')
      .select('*')
      .eq('id', taskId)
      .eq('user_id', userId)
      .single();

    if (error && error.code !== 'PGRST116') throw error;

    res.json({ success: true, data: data || null });
  } catch (error) {
    console.error('Get task log error:', error);
    res.status(500).json({ success: false, error: '获取任务失败' });
  }
});

// 创建/更新任务日志
taskLogsRouter.post('/', async (req, res) => {
  try {
    const userId = req.headers['x-user-id'] as string;
    if (!userId) {
      return res.status(401).json({ success: false, error: '未授权' });
    }

    const {
      task_title,
      task_description,
      task_category,
      start_time,
      end_time,
      status,
      outcome,
      reflection,
      time_spent_minutes,
      priority,
      tags
    } = req.body;

    const taskData: any = {
      user_id: userId,
      task_title: task_title || '',
      task_description: task_description || null,
      task_category: task_category || null,
      start_time: start_time || null,
      end_time: end_time || null,
      status: status || 'pending',
      outcome: outcome || null,
      reflection: reflection || null,
      time_spent_minutes: time_spent_minutes || null,
      priority: priority || null,
      tags: tags || null,
      updated_at: new Date().toISOString()
    };

    // 如果是开始任务，自动设置 start_time
    if (status === 'in_progress' && !start_time) {
      taskData.start_time = new Date().toISOString();
    }

    // 如果是完成任务，自动设置 end_time
    if (status === 'completed' && !end_time) {
      taskData.end_time = new Date().toISOString();
      // 计算花费时间
      if (taskData.start_time) {
        const start = new Date(taskData.start_time);
        const end = new Date(taskData.end_time);
        taskData.time_spent_minutes = Math.floor((end.getTime() - start.getTime()) / (1000 * 60));
      }
    }

    if (isMemoryMode) {
      if (!inMemoryStore.task_logs) {
        inMemoryStore.task_logs = [];
      }
      const store = inMemoryStore.task_logs as any[];

      // 如果有 id 则更新，否则创建
      if (req.body.id) {
        const existingIdx = store.findIndex((l: any) => l.id === req.body.id);
        if (existingIdx >= 0) {
          Object.assign(store[existingIdx], taskData);
          return res.json({ success: true, data: store[existingIdx] });
        }
      }

      const newLog = {
        ...taskData,
        id: Math.random().toString(36).substring(2) + Date.now().toString(36),
        created_at: new Date().toISOString()
      };
      store.push(newLog);
      return res.json({ success: true, data: newLog });
    }

    let savedLog;

    if (req.body.id) {
      // 更新现有任务
      const { data, error } = await supabase
        .from('task_logs')
        .update(taskData)
        .eq('id', req.body.id)
        .select()
        .single();

      if (error) throw error;
      savedLog = data;
    } else {
      // 创建新任务
      const { data, error } = await supabase
        .from('task_logs')
        .insert([taskData])
        .select()
        .single();

      if (error) throw error;
      savedLog = data;
    }

    res.json({ success: true, data: savedLog });
  } catch (error) {
    console.error('Save task log error:', error);
    res.status(500).json({ success: false, error: '保存任务失败' });
  }
});

// 删除任务日志
taskLogsRouter.delete('/:id', async (req, res) => {
  try {
    const userId = req.headers['x-user-id'] as string;
    const taskId = req.params.id;
    if (!userId) {
      return res.status(401).json({ success: false, error: '未授权' });
    }

    if (isMemoryMode) {
      const store = inMemoryStore.task_logs as any[];
      const idx = store.findIndex((l: any) => l.id === taskId && l.user_id === userId);
      if (idx >= 0) {
        store.splice(idx, 1);
      }
      return res.json({ success: true, data: null });
    }

    const { error } = await supabase
      .from('task_logs')
      .delete()
      .eq('id', taskId)
      .eq('user_id', userId);

    if (error) throw error;

    res.json({ success: true, data: null });
  } catch (error) {
    console.error('Delete task log error:', error);
    res.status(500).json({ success: false, error: '删除任务失败' });
  }
});
