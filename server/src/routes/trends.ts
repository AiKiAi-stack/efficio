import { Router } from 'express';
import { supabase } from '../lib/database';
import { anthropic } from '../lib/ai';

export const trendsRouter = Router();

// 获取月趋势
trendsRouter.get('/monthly', async (req, res) => {
  try {
    const userId = req.headers['x-user-id'] as string;
    const { year, month } = req.query;

    if (!userId) {
      return res.status(401).json({
        success: false,
        error: '未授权'
      });
    }

    let query = supabase
      .from('monthly_trends')
      .select('*')
      .eq('user_id', userId)
      .order('year', { ascending: false })
      .order('month', { ascending: false });

    if (year && month) {
      query = query.eq('year', parseInt(year as string)).eq('month', parseInt(month as string));
    }

    const { data, error } = await query;

    if (error) throw error;

    res.json({
      success: true,
      data: data || []
    });
  } catch (error) {
    console.error('Get monthly trends error:', error);
    res.status(500).json({
      success: false,
      error: '获取月趋势失败'
    });
  }
});

// 生成月趋势分析
trendsRouter.post('/monthly/generate', async (req, res) => {
  try {
    const userId = req.headers['x-user-id'] as string;
    const { year, month } = req.body;

    if (!userId) {
      return res.status(401).json({
        success: false,
        error: '未授权'
      });
    }

    if (!year || !month) {
      return res.status(400).json({
        success: false,
        error: '请提供年份和月份'
      });
    }

    // 获取该月的所有记录
    const startDate = `${year}-${String(month).padStart(2, '0')}-01`;
    const endDate = `${year}-${String(Math.min(month + 1, 12)).padStart(2, '0')}-01`;

    const { data: records, error: recordsError } = await supabase
      .from('work_records')
      .select('*')
      .eq('user_id', userId)
      .gte('created_at', startDate)
      .lt('created_at', endDate)
      .order('created_at', { ascending: true });

    if (recordsError) throw recordsError;

    if (!records || records.length === 0) {
      return res.status(404).json({
        success: false,
        error: '该月暂无工作记录'
      });
    }

    // 获取该月的周总结
    const { data: weeklySummaries } = await supabase
      .from('weekly_summaries')
      .select('markdown_content, summary_data')
      .eq('user_id', userId)
      .gte('week_start', startDate)
      .lt('week_start', endDate);

    // 统计分析数据
    const stats = calculateMonthlyStats(records);

    // 调用 AI 生成月趋势分析
    const message = await anthropic.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 2048,
      system: `你是一个专业的效率分析助手。请根据用户本月的工作记录和统计数据生成月趋势分析报告。

请分析以下维度并生成 Markdown 格式报告：

1. **月度概览** - 总记录数、总工时、工作日分布
2. **任务结构分析** - 各类别时间占比及趋势
3. **深度工作分析** - 深度工作频次和質量
4. **效率趋势** - 与上月对比（如有数据）
5. **模式识别** - 发现的工作模式
6. **月度洞察** - 关键发现和洞见
7. **下月建议** - 基于本月数据的具体建议

报告格式：
\`\`\`markdown
# 月度趋势分析 (${year}年${month}月)

## 📈 月度概览
[基本统计数据]

## 📊 任务结构分析
[类别占比和趋势]

## 🎯 深度工作分析
[深度工作情况]

## 📉 效率趋势
[趋势分析]

## 🔍 模式识别
[发现的模式]

## 💡 月度洞察
[关键洞见]

## 🎯 下月建议
[具体建议]
\`\`\`

请直接返回 Markdown 内容，不要解释。`,
      messages: [
        {
          role: 'user',
          content: `请根据以下本月数据生成月趋势分析报告：

记录总数：${records.length}
统计数据：${JSON.stringify(stats, null, 2)}

工作记录详情：
${records.map(r => `- [${new Date(r.created_at).toLocaleDateString('zh-CN')}] ${r.optimized_text || r.original_text}`).join('\n')}`
        }
      ]
    });

    const markdownContent = message.content[0].type === 'text' ? message.content[0].text : '';

    const trendData = {
      year,
      month,
      total_records: records.length,
      stats,
      generated_at: new Date().toISOString()
    };

    // 保存到数据库
    const { data: existingTrend } = await supabase
      .from('monthly_trends')
      .select('id')
      .eq('user_id', userId)
      .eq('year', year)
      .eq('month', month)
      .single();

    let savedTrend;

    if (existingTrend) {
      const { data, error } = await supabase
        .from('monthly_trends')
        .update({
          trend_data: trendData,
          insights: markdownContent
        })
        .eq('id', existingTrend.id)
        .select()
        .single();

      if (error) throw error;
      savedTrend = data;
    } else {
      const { data, error } = await supabase
        .from('monthly_trends')
        .insert([{
          user_id: userId,
          year,
          month,
          trend_data: trendData,
          insights: markdownContent
        }])
        .select()
        .single();

      if (error) throw error;
      savedTrend = data;
    }

    res.json({
      success: true,
      data: savedTrend
    });
  } catch (error) {
    console.error('Generate monthly trend error:', error);
    res.status(500).json({
      success: false,
      error: '生成月趋势失败'
    });
  }
});

// 辅助函数：计算月度统计
function calculateMonthlyStats(records: any[]) {
  const stats = {
    totalRecords: records.length,
    totalHours: 0,
    categoryBreakdown: {} as Record<string, number>,
    deepWorkCount: 0,
    avgInterruptions: 0,
    valueLevelBreakdown: {} as Record<string, number>,
    toolsUsed: [] as string[],
    tagsUsed: {} as Record<string, number>
  };

  records.forEach(record => {
    const data = record.structured_data;
    if (data) {
      // 时间统计
      if (data.time_spent) {
        const hours = parseTimeToHours(data.time_spent);
        stats.totalHours += hours;
      }

      // 类别统计
      if (data.task_category) {
        stats.categoryBreakdown[data.task_category] = (stats.categoryBreakdown[data.task_category] || 0) + 1;
      }

      // 深度工作
      if (data.is_deep_work) {
        stats.deepWorkCount++;
      }

      // 打断统计
      stats.avgInterruptions += data.interruptions || 0;

      // 价值等级
      if (data.value_level) {
        stats.valueLevelBreakdown[data.value_level] = (stats.valueLevelBreakdown[data.value_level] || 0) + 1;
      }

      // 工具
      if (data.tools_used) {
        data.tools_used.forEach((tool: string) => {
          if (!stats.toolsUsed.includes(tool)) {
            stats.toolsUsed.push(tool);
          }
        });
      }

      // 标签
      if (data.tags) {
        data.tags.forEach((tag: string) => {
          stats.tagsUsed[tag] = (stats.tagsUsed[tag] || 0) + 1;
        });
      }
    }
  });

  stats.avgInterruptions = records.length > 0 ? Math.round(stats.avgInterruptions / records.length * 10) / 10 : 0;

  return stats;
}

function parseTimeToHours(timeStr: string): number {
  if (!timeStr) return 0;

  const match = timeStr.match(/([\d.]+)\s*(h|m)/i);
  if (!match) return 0;

  const value = parseFloat(match[1]);
  const unit = match[2].toLowerCase();

  if (unit === 'm') {
    return value / 60;
  }
  return value;
}
