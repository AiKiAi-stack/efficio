import { Router } from 'express';
import { supabase, isMemoryMode } from '../lib/database';
import {
  isAiAvailable,
  generateAIResponse,
  generateWeeklySummaryWithoutAI,
  generateEnhancedSummaryWithoutAI,
  analyzeTimeDistribution,
  generateWorkInsights,
  generatePersonalizedRecommendations,
  EnhancedSummaryRequest
} from '../lib/ai';

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

    if (isAiAvailable()) {
      // 调用 AI 生成周总结
      const recordsContext = records.map(r => {
        const structured = r.structured_data ? JSON.stringify(r.structured_data) : '无结构化数据';
        const content = r.optimized_text || r.original_text;
        return `- [${new Date(r.created_at).toLocaleDateString('zh-CN')}] ${content}\n  结构化：${structured}`;
      }).join('\n');

      markdownContent = await generateAIResponse({
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
        userMessage: `请根据以下本周工作记录生成周总结报告：\n\n${recordsContext}`,
        maxTokens: 2048
      });
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
    const { date, start_date, end_date, enhanced } = req.body;

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

    const periodLabel = date ? `单日总结 (${date})` : `时间段总结 (${start_date} 至 ${end_date})`;

    let markdownContent = '';
    let timeDistribution = null;
    let insights = null;
    let recommendations = null;
    let metrics = null;

    if (isAiAvailable()) {
      // 构建上下文
      const recordsContext = records.map(r => {
        const structured = r.structured_data ? JSON.stringify(r.structured_data) : '无';
        const content = r.optimized_text || r.original_text;
        const hour = new Date(r.created_at).getHours();
        return `- [工作] [${new Date(r.created_at).toLocaleDateString('zh-CN')} ${hour}:00] ${content}\n  结构化：${structured}`;
      }).join('\n');

      const taskLogsContext = taskLogs.map(t => {
        const outcome = t.outcome || '无结果';
        const reflection = t.reflection ? `\n    反思：${t.reflection}` : '';
        const timeInfo = t.time_spent_minutes ? ` (${t.time_spent_minutes}分钟)` : '';
        const priority = t.priority ? ` [${t.priority === 'high' ? '高优先级' : t.priority === 'medium' ? '中优先级' : '低优先级'}]` : '';
        return `- [任务]${priority} ${t.task_title}${timeInfo}\n  结果：${outcome}${reflection}`;
      }).join('\n');

      // 先计算基础统计数据
      const totalRecords = records.length;
      const totalTasks = taskLogs.length;
      const completedTasks = taskLogs.filter(t => t.status === 'completed').length;
      const deepWorkCount = records.filter(r => r.structured_data?.is_deep_work).length;
      const highValueCount = records.filter(r => r.structured_data?.value_level === 'high').length;
      const avgInterruption = totalRecords > 0
        ? (records.reduce((sum, r) => sum + (r.structured_data?.interruptions || 0), 0) / totalRecords).toFixed(1)
        : '0';

      // 使用增强的 prompt 生成详细分析
      markdownContent = await generateAIResponse({
        system: `你是一个专业的效率分析助手。请根据用户的工作记录生成${periodLabel}。

请分析以下维度并生成 Markdown 格式报告：

1. **总体概览** - 统计数据摘要（工作记录数、任务数、完成率等）
2. **时间分布分析** - 分析工作时段模式、高峰时段、深度工作窗口
3. **工作洞察** - 生产力评分、专注质量、价值贡献分析
4. **任务完成情况** - 详细分析完成的任务和待办
5. **亮点与成就** - 值得肯定的高价值工作
6. **改进建议** - 基于数据给出 3-5 条具体可执行的改进建议

基础统计数据（可直接使用）：
- 总记录数：${totalRecords}
- 总任务数：${totalTasks}
- 已完成任务：${completedTasks} (${totalTasks > 0 ? Math.round(completedTasks / totalTasks * 100) : 0}%)
- 深度工作次数：${deepWorkCount}
- 高价值工作：${highValueCount}
- 平均打断分数：${avgInterruption}

报告格式：
\`\`\`markdown
# ${periodLabel}

## 📊 总体概览
[统计数据表格]

## ⏱️ 时间分布分析
[工作时段模式、高峰时段、深度工作窗口分析]

## 🎯 工作洞察
[生产力评分、专注质量、价值贡献]

## ✅ 任务完成情况
[任务详情和完成状态]

## ⭐ 亮点与成就
[高价值工作亮点]

## 💡 改进建议
[具体可执行的改进建议]
\`\`\`

要求：
- 分析要有深度，不要泛泛而谈
- 建议必须具体可执行
- 使用数据和证据支撑分析
- 直接返回 Markdown 内容，不要解释`,
        userMessage: `请根据以下记录生成详细的总结报告：

工作记录:
${recordsContext || '暂无工作记录'}

任务记录:
${taskLogsContext || '暂无任务记录'}`,
        maxTokens: 4096
      });

      // 生成额外的结构化分析数据
      if (enhanced) {
        timeDistribution = analyzeTimeDistribution(records);
        insights = generateWorkInsights(records, taskLogs);
        recommendations = generatePersonalizedRecommendations(insights, timeDistribution, records);
      }
    } else {
      // 降级模式：使用增强的本地分析
      const enhancedRequest: EnhancedSummaryRequest = {
        records,
        taskLogs,
        startDate: date || start_date,
        endDate: date || end_date,
        includeTimeAnalysis: true,
        includeInsights: true,
        includeRecommendations: true
      };

      const enhancedResult = generateEnhancedSummaryWithoutAI(enhancedRequest);
      markdownContent = enhancedResult.markdown_content;
      timeDistribution = enhancedResult.time_distribution;
      insights = enhancedResult.insights;
      recommendations = enhancedResult.recommendations;
      metrics = enhancedResult.metrics;
      console.log('使用降级模式生成增强总结');
    }

    // 计算指标
    metrics = metrics || {
      totalRecords: records.length,
      totalTasks: taskLogs.length,
      completedTasks: taskLogs.filter(t => t.status === 'completed').length,
      totalDeepWorkHours: records
        .filter(r => r.structured_data?.is_deep_work)
        .reduce((sum, r) => {
          const timeSpent = r.structured_data?.time_spent || '1h';
          return sum + (parseFloat(timeSpent.replace(/[^0-9.]/g, '')) || 1);
        }, 0),
      averageInterruptionScore: records.length > 0
        ? Math.round(records.reduce((sum, r) => sum + (r.structured_data?.interruptions || 0), 0) / records.length * 10) / 10
        : 0,
      highValueWorkPercentage: records.length > 0
        ? Math.round(records.filter(r => r.structured_data?.value_level === 'high').length / records.length * 100)
        : 0
    };

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
      time_distribution: timeDistribution,
      insights: insights,
      recommendations: recommendations,
      metrics: metrics,
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

// 获取增强的洞察分析
summariesRouter.post('/insights', async (req, res) => {
  try {
    const userId = req.headers['x-user-id'] as string;
    const { start_date, end_date } = req.body;

    if (!userId) {
      return res.status(401).json({
        success: false,
        error: '未授权'
      });
    }

    if (!start_date || !end_date) {
      return res.status(400).json({
        success: false,
        error: '请提供日期范围 (start_date, end_date)'
      });
    }

    // 获取记录
    const [recordsRes, taskLogsRes] = await Promise.all([
      supabase
        .from('work_records')
        .select('*')
        .eq('user_id', userId)
        .gte('created_at', start_date)
        .lte('created_at', end_date + 'T23:59:59.999Z'),
      supabase
        .from('task_logs')
        .select('*')
        .eq('user_id', userId)
        .gte('created_at', start_date)
        .lte('created_at', end_date + 'T23:59:59.999Z')
    ]);

    const records = recordsRes.data || [];
    const taskLogs = taskLogsRes.data || [];

    if (recordsRes.error) throw recordsRes.error;
    if (taskLogsRes.error) throw taskLogsRes.error;

    // 生成洞察
    const timeDistribution = analyzeTimeDistribution(records);
    const insights = generateWorkInsights(records, taskLogs);
    const recommendations = generatePersonalizedRecommendations(insights, timeDistribution, records);

    res.json({
      success: true,
      data: {
        time_distribution: timeDistribution,
        insights,
        recommendations
      }
    });
  } catch (error) {
    console.error('Generate insights error:', error);
    res.status(500).json({
      success: false,
      error: '生成洞察失败'
    });
  }
});
