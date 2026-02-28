import { Router } from 'express';
import { supabase, isMemoryMode } from '../lib/database';
import { anthropic, isAiAvailable, generateSuggestionsWithoutAI } from '../lib/ai';

export const suggestionsRouter = Router();

// 获取优化建议
suggestionsRouter.get('/', async (req, res) => {
  try {
    const userId = req.headers['x-user-id'] as string;
    const { type } = req.query;

    if (!userId) {
      return res.status(401).json({
        success: false,
        error: '未授权'
      });
    }

    let query = supabase
      .from('optimization_suggestions')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (type) {
      query = query.eq('suggestion_type', type as string);
    }

    const { data, error } = await query;

    if (error) throw error;

    res.json({
      success: true,
      data: data || []
    });
  } catch (error) {
    console.error('Get suggestions error:', error);
    res.status(500).json({
      success: false,
      error: '获取优化建议失败'
    });
  }
});

// 生成优化建议
suggestionsRouter.post('/generate', async (req, res) => {
  try {
    const userId = req.headers['x-user-id'] as string;
    const { type } = req.body; // 'weekly' | 'monthly' | 'pattern'

    if (!userId) {
      return res.status(401).json({
        success: false,
        error: '未授权'
      });
    }

    // 获取用户的所有记录用于分析
    const { data: records } = await supabase
      .from('work_records')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(50);

    if (!records || records.length === 0) {
      return res.status(404).json({
        success: false,
        error: '暂无工作记录'
      });
    }

    // 获取最近的周总结
    const { data: recentSummaries } = await supabase
      .from('weekly_summaries')
      .select('markdown_content, summary_data')
      .eq('user_id', userId)
      .order('week_start', { ascending: false })
      .limit(4);

    let suggestionData;

    if (anthropic && isAiAvailable) {
      // 调用 AI 生成优化建议
      const message = await anthropic.messages.create({
        model: 'claude-sonnet-4-6',
        max_tokens: 1536,
        system: `你是一个专业的效率优化顾问。请根据用户的工作记录和历史总结生成具体的优化建议。

请分析以下维度并生成建议：

1. **时间管理** - 如何更好地分配时间
2. **深度工作** - 如何增加高质量专注时间
3. **减少打断** - 如何降低上下文切换
4. **工具优化** - 工具使用建议
5. **工作模式** - 识别低效模式并给出改进方案

要求：
- 建议必须具体可执行，不是泛泛而谈
- 每条建议都要有"为什么"和"怎么做"
- 优先级排序（高/中/低）

返回 JSON 格式：
{
  "suggestions": [
    {
      "title": "建议标题",
      "category": "时间管理 | 深度工作 | 减少打断 | 工具优化 | 工作模式",
      "priority": "high | medium | low",
      "why": "为什么需要这个改变",
      "how": "具体怎么做，包含可执行步骤",
      "expected_impact": "预期影响"
    }
  ]
}`,
        messages: [
          {
            role: 'user',
            content: `请根据以下数据生成优化建议：

最近工作记录（最多 50 条）：
${records.map(r => `- ${new Date(r.created_at).toLocaleDateString('zh-CN')}: ${r.optimized_text || r.original_text}${r.structured_data ? ` [${JSON.stringify(r.structured_data)}]` : ''}`).join('\n')}

${recentSummaries && recentSummaries.length > 0 ? `
最近周总结：
${recentSummaries.map(s => s.markdown_content).join('\n\n')}` : ''}`
          }
        ]
      });

      const content = message.content[0].type === 'text' ? message.content[0].text : '';

      // 解析 JSON
      let jsonStr = content.trim();
      if (jsonStr.startsWith('```json')) {
        jsonStr = jsonStr.replace(/^```json\s*/, '').replace(/\s*```$/, '');
      } else if (jsonStr.startsWith('```')) {
        jsonStr = jsonStr.replace(/^```\s*/, '').replace(/\s*```$/, '');
      }

      try {
        suggestionData = JSON.parse(jsonStr);
      } catch (e) {
        console.error('Failed to parse suggestions JSON:', jsonStr);
        return res.status(500).json({
          success: false,
          error: 'AI 生成建议格式错误'
        });
      }
    } else {
      // 降级模式
      suggestionData = generateSuggestionsWithoutAI(records);
      console.log('使用降级模式生成优化建议');
    }

    // 保存建议到数据库
    if (!isMemoryMode && suggestionData.suggestions) {
      const suggestionsToInsert = (suggestionData.suggestions || []).map((s: any) => ({
        user_id: userId,
        suggestion_type: type || 'pattern',
        suggestion_data: s
      }));

      if (suggestionsToInsert.length > 0) {
        await supabase
          .from('optimization_suggestions')
          .insert(suggestionsToInsert);
      }
    }

    res.json({
      success: true,
      data: suggestionData
    });
  } catch (error) {
    console.error('Generate suggestions error:', error);
    res.status(500).json({
      success: false,
      error: '生成优化建议失败'
    });
  }
});

// 标记建议为已执行
suggestionsRouter.patch('/:id/action', async (req, res) => {
  try {
    const { id } = req.params;

    const { error } = await supabase
      .from('optimization_suggestions')
      .update({ is_actioned: true })
      .eq('id', id);

    if (error) throw error;

    res.json({
      success: true,
      message: '建议已标记为已执行'
    });
  } catch (error) {
    console.error('Update suggestion error:', error);
    res.status(500).json({
      success: false,
      error: '更新建议失败'
    });
  }
});
