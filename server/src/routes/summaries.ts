import { Router } from 'express';
import { supabase, isMemoryMode } from '../lib/database';
import { anthropic, isAiAvailable, generateWeeklySummaryWithoutAI } from '../lib/ai';

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

    let markdownContent = '';

    if (anthropic && isAiAvailable) {
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

      markdownContent = message.content[0].type === 'text' ? message.content[0].text : '';
    } else {
      // 降级模式
      markdownContent = generateWeeklySummaryWithoutAI(records);
      console.log('使用降级模式生成周总结');
    }

    // 抽取结构化数据（用于后续分析）
    const summaryData = {
      week_start,
      week_end,
      total_records: records.length,
      generated_at: new Date().toISOString(),
      records_with_structured_data: records.filter(r => r.structured_data).length
    };

    // 保存到数据库
    let savedSummary;

    if (isMemoryMode) {
      // 内存模式：简化处理，直接返回
      savedSummary = {
        id: Math.random().toString(36).substring(2),
        user_id: userId,
        week_start,
        week_end,
        summary_data: summaryData,
        markdown_content: markdownContent,
        created_at: new Date().toISOString()
      };
    } else {
      const { data: existingSummary } = await supabase
        .from('weekly_summaries')
        .select('id')
        .eq('user_id', userId)
        .eq('week_start', week_start)
        .single();

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

// 生成任意时间段的总结（支持单日或多日范围）
summariesRouter.post('/range', async (req, res) => {
  try {
    const userId = req.headers['x-user-id'] as string;
    const { date, start_date, end_date } = req.body;

    if (!userId) {
      return res.status(401).json({
        success: false,
        error: '未授权'
      });
    }

    // 确定日期范围
    let startDate: string;
    let endDate: string;

    if (date) {
      // 单日模式
      startDate = date;
      endDate = date + 'T23:59:59.999Z';
    } else if (start_date && end_date) {
      // 范围模式
      startDate = start_date;
      endDate = end_date + 'T23:59:59.999Z';
    } else {
      return res.status(400).json({
        success: false,
        error: '请提供日期 (date) 或日期范围 (start_date, end_date)'
      });
    }

    // 获取该时间段的所有记录
    const [recordsRes, taskLogsRes] = await Promise.all([
      supabase
        .from('work_records')
        .select('*')
        .eq('user_id', userId)
        .gte('created_at', startDate)
        .lte('created_at', endDate)
        .order('created_at', { ascending: true }),
      supabase
        .from('task_logs')
        .select('*')
        .eq('user_id', userId)
        .gte('created_at', startDate)
        .lte('created_at', endDate)
        .order('created_at', { ascending: true })
    ]);

    const records = recordsRes.data || [];
    const taskLogs = taskLogsRes.data || [];

    if (recordsRes.error) throw recordsRes.error;
    if (taskLogsRes.error) throw taskLogsRes.error;

    if (!date && !start_date) {
      return res.status(404).json({
        success: false,
        error: '该时间段暂无记录'
      });
    }

    let markdownContent = '';

    if (anthropic && isAiAvailable) {
      // 构建上下文
      const recordsContext = records.map(r => {
        const structured = r.structured_data ? JSON.stringify(r.structured_data) : '无';
        const content = r.optimized_text || r.original_text;
        return `- [工作] [${new Date(r.created_at).toLocaleDateString('zh-CN')}] ${content}\n  结构化：${structured}`;
      }).join('\n');

      const taskLogsContext = taskLogs.map(t => {
        const outcome = t.outcome || '无结果';
        const reflection = t.reflection ? `\n    反思：${t.reflection}` : '';
        const timeInfo = t.time_spent_minutes ? ` (${t.time_spent_minutes}分钟)` : '';
        return `- [任务] ${t.task_title}${timeInfo}\n  结果：${outcome}${reflection}`;
      }).join('\n');

      const periodLabel = date ? `单日总结 (${date})` : `时间段总结 (${start_date} 至 ${end_date})`;

      const message = await anthropic.messages.create({
        model: 'claude-sonnet-4-6',
        max_tokens: 2048,
        system: `你是一个专业的效率分析助手。请根据用户的工作记录生成${periodLabel}。

请分析以下维度并生成 Markdown 格式报告：

1. **完成的任务** - 列出完成的主要任务
2. **工作记录分析** - 总结工作内容和类别
3. **时间分配** - 时间是如何使用的
4. **亮点与成就** - 值得肯定的成果
5. **改进空间** - 可以优化的地方

报告格式：
\`\`\`markdown
# ${periodLabel}

## ✅ 完成的任务
[任务完成情况]

## 📝 工作记录
[工作内容总结]

## ⏱️ 时间分配
[时间使用情况]

## ⭐ 亮点与成就
[值得肯定的地方]

## 🔄 改进空间
[可以优化的地方]
\`\`\`

请直接返回 Markdown 内容，不要解释。`,
        messages: [
          {
            role: 'user',
            content: `请根据以下记录生成总结报告：\n\n工作记录:\n${recordsContext}\n\n任务记录:\n${taskLogsContext}`
          }
        ]
      });

      markdownContent = message.content[0].type === 'text' ? message.content[0].text : '';
    } else {
      // 降级模式：生成简单的文字总结
      const periodLabel = date ? `单日 (${date})` : `时间段 (${start_date} 至 ${end_date})`;
      markdownContent = `# ${periodLabel} 总结

## ✅ 完成的任务
- 完成任务数量：${taskLogs.filter(t => t.status === 'completed').length}
- 工作记录数量：${records.length}

## 📝 概览
${records.length > 0 ? '- 有 ' + records.length + ' 条工作记录' : '- 暂无工作记录'}
${taskLogs.length > 0 ? '- 有 ' + taskLogs.length + ' 条任务记录' : '- 暂无任务记录'}

> 注：AI 功能未配置，以上为简单统计。配置 AI 后可获得详细分析。`;
      console.log('使用降级模式生成时间段总结');
    }

    // 返回总结
    const summaryData = {
      period: date ? 'daily' : 'range',
      date: date || null,
      start_date: start_date || null,
      end_date: end_date || null,
      total_records: records.length,
      total_tasks: taskLogs.length,
      generated_at: new Date().toISOString()
    };

    const result = {
      id: Math.random().toString(36).substring(2),
      user_id: userId,
      summary_data: summaryData,
      markdown_content: markdownContent,
      created_at: new Date().toISOString()
    };

    res.json({
      success: true,
      data: result
    });
  } catch (error) {
    console.error('Generate range summary error:', error);
    res.status(500).json({
      success: false,
      error: '生成总结失败'
    });
  }
});
