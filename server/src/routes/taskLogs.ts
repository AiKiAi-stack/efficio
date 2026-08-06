import { Router } from 'express';
import { getDatabase } from '../lib/database-new';

export const taskLogsRouter = Router();

// 获取所有任务日志
taskLogsRouter.get('/', async (req, res) => {
  try {
    const userId = req.headers['x-user-id'] as string;
    if (!userId) {
      return res.status(401).json({ success: false, error: '未授权' });
    }

    const db = getDatabase();
    const { data, error } = await db.select('task_logs', {
      where: { user_id: userId },
      orderBy: { column: 'created_at', direction: 'DESC' }
    });

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

    const db = getDatabase();
    const { data, error } = await db.selectSingle('task_logs', {
      where: { id: taskId, user_id: userId }
    });

    if (error) throw error;

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

    const taskData: Record<string, any> = {
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

    const db = getDatabase();

    let savedLog;

    if (req.body.id) {
      // 更新现有任务
      const { data, error } = await db.update('task_logs', req.body.id, taskData);
      if (error) throw error;
      savedLog = data;
    } else {
      // 创建新任务
      const { data, error } = await db.insert('task_logs', taskData);
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

    const db = getDatabase();

    // 校验所有权后删除
    const { data: existing } = await db.selectSingle('task_logs', {
      where: { id: taskId, user_id: userId }
    });

    if (!existing) {
      return res.json({ success: true, data: null });
    }

    const { error } = await db.delete('task_logs', taskId);
    if (error) throw error;

    res.json({ success: true, data: null });
  } catch (error) {
    console.error('Delete task log error:', error);
    res.status(500).json({ success: false, error: '删除任务失败' });
  }
});
