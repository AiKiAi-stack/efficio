import { Router } from 'express';
import { supabase } from '../lib/database';

export const recordsRouter = Router();

// 获取用户的所有记录
recordsRouter.get('/', async (req, res) => {
  try {
    const userId = req.headers['x-user-id'] as string;

    if (!userId) {
      return res.status(401).json({
        success: false,
        error: '未授权'
      });
    }

    const { data, error } = await supabase
      .from('work_records')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (error) throw error;

    res.json({
      success: true,
      data: data || []
    });
  } catch (error) {
    console.error('Get records error:', error);
    res.status(500).json({
      success: false,
      error: '获取记录失败'
    });
  }
});

// 创建新记录
recordsRouter.post('/', async (req, res) => {
  try {
    const userId = req.headers['x-user-id'] as string;

    if (!userId) {
      return res.status(401).json({
        success: false,
        error: '未授权'
      });
    }

    const { original_text, optimized_text } = req.body;

    if (!original_text) {
      return res.status(400).json({
        success: false,
        error: '原始内容不能为空'
      });
    }

    const { data, error } = await supabase
      .from('work_records')
      .insert([{
        user_id: userId,
        original_text,
        optimized_text: optimized_text || null
      }])
      .select()
      .single();

    if (error) throw error;

    res.json({
      success: true,
      data
    });
  } catch (error) {
    console.error('Create record error:', error);
    res.status(500).json({
      success: false,
      error: '创建记录失败'
    });
  }
});

// 获取单条记录
recordsRouter.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const { data, error } = await supabase
      .from('work_records')
      .select('*')
      .eq('id', id)
      .single();

    if (error) throw error;

    res.json({
      success: true,
      data
    });
  } catch (error) {
    console.error('Get record error:', error);
    res.status(500).json({
      success: false,
      error: '获取记录失败'
    });
  }
});

// 删除记录
recordsRouter.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const { error } = await supabase
      .from('work_records')
      .delete()
      .eq('id', id);

    if (error) throw error;

    res.json({
      success: true,
      message: '删除成功'
    });
  } catch (error) {
    console.error('Delete record error:', error);
    res.status(500).json({
      success: false,
      error: '删除失败'
    });
  }
});
