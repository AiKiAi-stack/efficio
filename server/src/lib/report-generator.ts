/**
 * 报告生成服务
 *
 * 周总结 / 月趋势的生成逻辑，供路由（手动触发）与 cron（自动触发）共用。
 * - 周范围按「含首尾日期」查询（周一至周日全部计入）
 * - 月范围正确处理 12 月 → 次年 1 月的边界
 * - AI 不可用时降级为规则生成，保证报告始终有内容
 */

import { getDatabase } from './database-new';
import {
  isAiAvailable,
  generateAIResponse,
  generateWeeklySummaryWithoutAI
} from './ai';

export type GenerateStatus = 'generated' | 'skipped_existing' | 'no_records';

export interface GenerateResult {
  status: GenerateStatus;
  data?: any;
}

export interface WeeklyRange {
  weekStart: string; // YYYY-MM-DD（周一）
  weekEnd: string;   // YYYY-MM-DD（周日）
}

function toDateStr(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/**
 * 计算上一个完整自然周（周一 ~ 周日）的本地日期范围。
 * 对任意星期几调用都正确（周日属于「本周」而非上周）。
 */
export function getLastWeekRange(from: Date = new Date()): WeeklyRange {
  const day = from.getDay(); // 0 = 周日
  const diffToMonday = day === 0 ? 6 : day - 1;
  const thisMonday = new Date(from);
  thisMonday.setDate(from.getDate() - diffToMonday);

  const lastMonday = new Date(thisMonday);
  lastMonday.setDate(thisMonday.getDate() - 7);
  const lastSunday = new Date(thisMonday);
  lastSunday.setDate(thisMonday.getDate() - 1);

  return { weekStart: toDateStr(lastMonday), weekEnd: toDateStr(lastSunday) };
}

/**
 * 计算上一个自然月（1-12）
 */
export function getLastMonth(from: Date = new Date()): { year: number; month: number } {
  const m = from.getMonth(); // 0-11
  return m === 0
    ? { year: from.getFullYear() - 1, month: 12 }
    : { year: from.getFullYear(), month: m };
}

/**
 * 为指定用户生成周总结并落库（按 user_id + week_start 幂等 upsert）。
 * weekStart/weekEnd 均为 YYYY-MM-DD，含首尾两天。
 */
export async function generateWeeklySummaryForUser(
  userId: string,
  weekStart: string,
  weekEnd: string,
  options?: { skipIfExists?: boolean }
): Promise<GenerateResult> {
  const db = getDatabase();

  if (options?.skipIfExists) {
    const { data: existing } = await db.selectSingle('weekly_summaries', {
      where: { user_id: userId, week_start: weekStart }
    });
    if (existing) {
      return { status: 'skipped_existing', data: existing };
    }
  }

  // 含周日：weekEnd 当天 23:59:59.999 作为上界
  const { data: records, error: recordsError } = await db.select('work_records', {
    where: {
      user_id: userId,
      created_at: { gte: weekStart, lte: `${weekEnd}T23:59:59.999Z` }
    },
    orderBy: { column: 'created_at', direction: 'ASC' }
  });

  if (recordsError) throw recordsError;

  if (!records || records.length === 0) {
    return { status: 'no_records' };
  }

  let markdownContent = '';

  if (isAiAvailable()) {
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
# 本周工作分析 (${weekStart} ~ ${weekEnd})

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

  const summaryData = {
    week_start: weekStart,
    week_end: weekEnd,
    total_records: records.length,
    generated_at: new Date().toISOString(),
    records_with_structured_data: records.filter(r => r.structured_data).length
  };

  const { data: existingSummary } = await db.selectSingle('weekly_summaries', {
    where: { user_id: userId, week_start: weekStart }
  });

  let savedSummary;

  if (existingSummary) {
    const { data, error } = await db.update('weekly_summaries', existingSummary.id, {
      summary_data: summaryData,
      markdown_content: markdownContent
    });
    if (error) throw error;
    savedSummary = data;
  } else {
    const { data, error } = await db.insert('weekly_summaries', {
      user_id: userId,
      week_start: weekStart,
      week_end: weekEnd,
      summary_data: summaryData,
      markdown_content: markdownContent
    });
    if (error) throw error;
    savedSummary = data;
  }

  return { status: 'generated', data: savedSummary };
}

/**
 * 为指定用户生成月趋势并落库（按 user_id + year + month 幂等 upsert）。
 */
export async function generateMonthlyTrendForUser(
  userId: string,
  year: number,
  month: number,
  options?: { skipIfExists?: boolean }
): Promise<GenerateResult> {
  const db = getDatabase();

  if (options?.skipIfExists) {
    const { data: existing } = await db.selectSingle('monthly_trends', {
      where: { user_id: userId, year, month }
    });
    if (existing) {
      return { status: 'skipped_existing', data: existing };
    }
  }

  // 月边界：12 月的下一个月是次年 1 月（原实现 Math.min(month+1, 12) 导致 12 月区间为空）
  const startDate = `${year}-${String(month).padStart(2, '0')}-01`;
  const next = month === 12 ? { year: year + 1, month: 1 } : { year, month: month + 1 };
  const endDate = `${next.year}-${String(next.month).padStart(2, '0')}-01`;

  const { data: records, error: recordsError } = await db.select('work_records', {
    where: {
      user_id: userId,
      created_at: { gte: startDate, lt: endDate }
    },
    orderBy: { column: 'created_at', direction: 'ASC' }
  });

  if (recordsError) throw recordsError;

  if (!records || records.length === 0) {
    return { status: 'no_records' };
  }

  const stats = calculateMonthlyStats(records);

  let markdownContent = '';

  if (isAiAvailable()) {
    markdownContent = await generateAIResponse({
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
      userMessage: `请根据以下本月数据生成月趋势分析报告：

记录总数：${records.length}
统计数据：${JSON.stringify(stats, null, 2)}

工作记录详情：
${records.map(r => `- [${new Date(r.created_at).toLocaleDateString('zh-CN')}] ${r.optimized_text || r.original_text}`).join('\n')}`,
      maxTokens: 2048
    });
  } else {
    markdownContent = generateMonthlyTrendWithoutAI(year, month, records, stats);
    console.log('使用降级模式生成月趋势');
  }

  const trendData = {
    year,
    month,
    total_records: records.length,
    stats,
    generated_at: new Date().toISOString()
  };

  const { data: existingTrend } = await db.selectSingle('monthly_trends', {
    where: { user_id: userId, year, month }
  });

  let savedTrend;

  if (existingTrend) {
    const { data, error } = await db.update('monthly_trends', existingTrend.id, {
      trend_data: trendData,
      insights: markdownContent
    });
    if (error) throw error;
    savedTrend = data;
  } else {
    const { data, error } = await db.insert('monthly_trends', {
      user_id: userId,
      year,
      month,
      trend_data: trendData,
      insights: markdownContent
    });
    if (error) throw error;
    savedTrend = data;
  }

  return { status: 'generated', data: savedTrend };
}

// ==================== 统计与降级生成 ====================

export interface MonthlyStats {
  totalRecords: number;
  totalHours: number;
  categoryBreakdown: Record<string, number>;
  deepWorkCount: number;
  avgInterruptions: number;
  valueLevelBreakdown: Record<string, number>;
  toolsUsed: string[];
  tagsUsed: Record<string, number>;
}

export function calculateMonthlyStats(records: any[]): MonthlyStats {
  const stats: MonthlyStats = {
    totalRecords: records.length,
    totalHours: 0,
    categoryBreakdown: {},
    deepWorkCount: 0,
    avgInterruptions: 0,
    valueLevelBreakdown: {},
    toolsUsed: [],
    tagsUsed: {}
  };

  records.forEach(record => {
    const data = record.structured_data;
    if (data) {
      if (data.time_spent) {
        stats.totalHours += parseTimeToHours(data.time_spent);
      }

      if (data.task_category) {
        stats.categoryBreakdown[data.task_category] = (stats.categoryBreakdown[data.task_category] || 0) + 1;
      }

      if (data.is_deep_work) {
        stats.deepWorkCount++;
      }

      stats.avgInterruptions += data.interruptions || 0;

      if (data.value_level) {
        stats.valueLevelBreakdown[data.value_level] = (stats.valueLevelBreakdown[data.value_level] || 0) + 1;
      }

      if (data.tools_used) {
        data.tools_used.forEach((tool: string) => {
          if (!stats.toolsUsed.includes(tool)) {
            stats.toolsUsed.push(tool);
          }
        });
      }

      if (data.tags) {
        data.tags.forEach((tag: string) => {
          stats.tagsUsed[tag] = (stats.tagsUsed[tag] || 0) + 1;
        });
      }
    }
  });

  stats.avgInterruptions = records.length > 0 ? Math.round(stats.avgInterruptions / records.length * 10) / 10 : 0;
  stats.totalHours = Math.round(stats.totalHours * 10) / 10;

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

const CATEGORY_LABELS: Record<string, string> = {
  development: '开发',
  meeting: '会议',
  communication: '沟通',
  documentation: '文档',
  review: '评审',
  learning: '学习',
  other: '其他'
};

/**
 * AI 不可用时的月趋势降级报告（基于统计数据直接生成）
 */
function generateMonthlyTrendWithoutAI(
  year: number,
  month: number,
  records: any[],
  stats: MonthlyStats
): string {
  const lines: string[] = [];

  lines.push(`# 月度趋势分析 (${year}年${month}月)`);
  lines.push('');
  lines.push('> ⚠️ AI 未配置，本报告由规则引擎生成（降级模式）。');
  lines.push('');

  lines.push('## 📈 月度概览');
  lines.push('');
  lines.push(`- 工作记录总数：${stats.totalRecords}`);
  lines.push(`- 累计工时：${stats.totalHours} 小时`);
  lines.push(`- 深度工作次数：${stats.deepWorkCount}`);
  lines.push(`- 平均每条记录打断次数：${stats.avgInterruptions}`);
  lines.push('');

  lines.push('## 📊 任务结构分析');
  lines.push('');
  const categories = Object.entries(stats.categoryBreakdown)
    .sort((a, b) => b[1] - a[1]);
  if (categories.length === 0) {
    lines.push('- 暂无结构化数据');
  } else {
    for (const [cat, count] of categories) {
      const pct = Math.round((count / stats.totalRecords) * 100);
      lines.push(`- ${CATEGORY_LABELS[cat] || cat}：${count} 条（${pct}%）`);
    }
  }
  lines.push('');

  lines.push('## 🛠️ 工具使用');
  lines.push('');
  lines.push(stats.toolsUsed.length > 0 ? stats.toolsUsed.map(t => `- ${t}`).join('\n') : '- 暂无数据');
  lines.push('');

  lines.push('## 🏷️ 热门标签');
  lines.push('');
  const tags = Object.entries(stats.tagsUsed).sort((a, b) => b[1] - a[1]).slice(0, 10);
  lines.push(tags.length > 0 ? tags.map(([tag, count]) => `- ${tag}（${count} 次）`).join('\n') : '- 暂无数据');
  lines.push('');

  lines.push('## 💡 月度洞察');
  lines.push('');
  const insights: string[] = [];
  if (stats.deepWorkCount > 0) {
    const deepPct = Math.round((stats.deepWorkCount / stats.totalRecords) * 100);
    insights.push(`深度工作占比 ${deepPct}%${deepPct >= 50 ? '，保持了良好的专注度' : '，可以尝试安排更多整块专注时间'}`);
  }
  const highValue = stats.valueLevelBreakdown['high'] || 0;
  if (highValue > 0) {
    insights.push(`高价值工作 ${highValue} 条，占比 ${Math.round((highValue / stats.totalRecords) * 100)}%`);
  }
  if (stats.avgInterruptions >= 2) {
    insights.push(`平均打断次数偏高（${stats.avgInterruptions}），建议设置免打扰时段`);
  }
  lines.push(insights.length > 0 ? insights.map(i => `- ${i}`).join('\n') : '- 数据不足，暂无洞察');
  lines.push('');

  lines.push(`## 📝 记录明细（共 ${records.length} 条）`);
  lines.push('');
  for (const r of records) {
    lines.push(`- [${new Date(r.created_at).toLocaleDateString('zh-CN')}] ${r.optimized_text || r.original_text}`);
  }

  return lines.join('\n');
}
