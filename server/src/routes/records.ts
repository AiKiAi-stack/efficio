import { Router } from 'express';
import { supabase, isMemoryMode } from '../lib/database';
import { anthropic, analyzeWithoutAI, isAiAvailable } from '../lib/ai';

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

// 创建新记录（带自动分析）
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

    // 使用优化后的文本进行 AI 分析
    const textToAnalyze = optimized_text || original_text;
    let structuredData = null;

    try {
      if (anthropic && isAiAvailable) {
        // 使用 AI 分析
        const message = await anthropic.messages.create({
          model: 'claude-sonnet-4-6',
          max_tokens: 1024,
          system: `你是一个专业的结构化数据抽取助手。请从用户的工作记录中提取以下信息：

1. task_category: 任务类别 - 从以下选择最匹配的：
   - "development" (开发工作)
   - "meeting" (会议)
   - "communication" (沟通协作)
   - "documentation" (文档编写)
   - "review" (代码审查/设计评审)
   - "learning" (学习研究)
   - "other" (其他)

2. time_spent: 预估耗时 - 根据描述推断，格式如 "2h", "30m", "1.5h"

3. tools_used: 使用的工具列表 - 如 ["VSCode", "Git", "Slack", "Jira"]

4. tags: 标签列表 - 2-5 个关键词标签

5. is_deep_work: 是否需要深度专注（boolean）

6. interruptions: 被打断的可能性（0-5 的整数）

7. value_level: 价值等级 "high" | "medium" | "low"

请以纯 JSON 格式返回，不要任何解释或多余文字。`,
          messages: [
            {
              role: 'user',
              content: `请分析以下工作记录并提取结构化数据：\n\n${textToAnalyze}`
            }
          ]
        });

        const content = message.content[0].type === 'text' ? message.content[0].text : '';

        // 清理 JSON 字符串
        let jsonStr = content.trim();
        if (jsonStr.startsWith('```json')) {
          jsonStr = jsonStr.replace(/^```json\s*/, '').replace(/\s*```$/, '');
        } else if (jsonStr.startsWith('```')) {
          jsonStr = jsonStr.replace(/^```\s*/, '').replace(/\s*```$/, '');
        }

        structuredData = JSON.parse(jsonStr);
      } else {
        // 降级模式：使用规则分析
        structuredData = analyzeWithoutAI(textToAnalyze);
        console.log('使用降级模式分析:', structuredData);
      }
    } catch (e) {
      console.warn('AI 分析失败，使用降级模式:', e);
      structuredData = analyzeWithoutAI(textToAnalyze);
    }

    const { data, error } = await supabase
      .from('work_records')
      .insert([{
        user_id: userId,
        original_text,
        optimized_text: optimized_text || null,
        structured_data: structuredData
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
