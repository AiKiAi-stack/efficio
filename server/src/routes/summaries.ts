import { Router } from 'express';
import { supabase } from '../lib/database';
import { anthropic } from '../lib/ai';

export const summariesRouter = Router();

// 获取周总结
summariesRouter.get('/weekly', async (req, res) => {
  try {
    const userId = req.headers['x-user-id'] as string;
    const { week_start } = req.query;

    if (!userId) {
      return res.status(401).json({
        success: false,
        error: '未授权'
      });
    }

    // 如果指定了 week_start，获取特定周的总结
    if (week_start) {
      const { data, error } = await supabase
        .from('weekly_summaries')
        .select('*')
        .eq('user_id', userId)
        .eq('week_start', week_start)
        .single();

      if (error && error.code !== 'PGRST116') throw error;

      res.json({
        success: true,
        data: data || null
      });
      return;
    }

    // 否则获取所有周的总结
    const { data, error } = await supabase
      .from('weekly_summaries')
      .select('*')
      .eq('user_id', userId)
      .order('week_start', { ascending: false });

    if (error) throw error;

    res.json({
      success: true,
      data: data || []
    });
  } catch (error) {
    console.error('Get weekly summaries error:', error);
    res.status(500).json({
      success: false,
      error: '获取周总结失败'
    });
  }
});

// 生成周总结
summariesRouter.post('/weekly/generate', async (req, res) => {
  try {
    const userId = req.headers['x-user-id'] as string;
    const { week_start, week_end } = req.body;

    if (!userId) {
      return res.status(401).json({
        success: false,
        error: '未授权'
      });
    }

    if (!week_start || !week_end) {
      return res.status(400).json({
        success: false,
        error: '请提供周起始和结束日期'
      });
    }

    // 获取该周的所有记录
    const { data: records, error: recordsError } = await supabase
      .from('work_records')
      .select('*')
      .eq('user_id', userId)
      .gte('created_at', week_start)
      .lt('created_at', week_end)
      .order('created_at', { ascending: true });

    if (recordsError) throw recordsError;

    if (!records || records.length === 0) {
      return res.status(404).json({
        success: false,
        error: '该周暂无工作记录'
      });
    }

    // 调用 AI 生成周总结
    const recordsContext = records.map(r => {
      const structured = r.structured_data ? JSON.stringify(r.structured_data) : '无结构化数据';
      const content = r.optimized_text || r.original_text;
      return `- [${new Date(r.created_at).toLocaleDateString('zh-CN')}] ${content}\n  结构化：${structured}`;
    }).join('\n');

    const message = await anthropic.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 2048,
      system: `你是一个专业的效率分析助手。请根据用户本周的工作记录生成周总结报告。

请分析以下维度并生成 Markdown 格式报告：

1. **时间分布** - 按任务类别统计时间占比
2. **高价值工作** - 识别价值等级为 high 的工作
3. **深度工作状态** - 统计深度工作次数和占比
4. **被打断情况** - 分析打断频率
5. **工具使用情况** - 列出常用工具
6. **问题分析** - 识别效率低下的模式
7. **优化建议** - 给出 2-3 条具体可执行的改进建议

报告格式：
\`\`\`markdown
# 本周工作分析 (${week_start} ~ ${week_end})

## 📊 时间分布
[按类别统计时间占比]

## ✨ 高价值工作
[列出高价值工作及其成果]

## 🎯 深度工作状态
[深度工作统计]

## ⚠️ 被打断情况
[打断分析]

## 🛠️ 工具使用
[工具使用情况]

## 🔍 问题分析
[识别的效率问题]

## 💡 优化建议
[具体可执行的改进建议]
\`\`\`

请直接返回 Markdown 内容，不要解释。`,
      messages: [
        {
          role: 'user',
          content: `请根据以下本周工作记录生成周总结报告：\n\n${recordsContext}`
        }
      ]
    });

    const markdownContent = message.content[0].type === 'text' ? message.content[0].text : '';

    // 抽取结构化数据（用于后续分析）
    const summaryData = {
      week_start,
      week_end,
      total_records: records.length,
      generated_at: new Date().toISOString(),
      records_with_structured_data: records.filter(r => r.structured_data).length
    };

    // 保存到数据库（如果已存在则更新）
    const { data: existingSummary } = await supabase
      .from('weekly_summaries')
      .select('id')
      .eq('user_id', userId)
      .eq('week_start', week_start)
      .single();

    let savedSummary;

    if (existingSummary) {
      const { data, error } = await supabase
        .from('weekly_summaries')
        .update({
          summary_data: summaryData,
          markdown_content: markdownContent
        })
        .eq('id', existingSummary.id)
        .select()
        .single();

      if (error) throw error;
      savedSummary = data;
    } else {
      const { data, error } = await supabase
        .from('weekly_summaries')
        .insert([{
          user_id: userId,
          week_start,
          week_end,
          summary_data: summaryData,
          markdown_content: markdownContent
        }])
        .select()
        .single();

      if (error) throw error;
      savedSummary = data;
    }

    res.json({
      success: true,
      data: savedSummary
    });
  } catch (error) {
    console.error('Generate weekly summary error:', error);
    res.status(500).json({
      success: false,
      error: '生成周总结失败'
    });
  }
});
