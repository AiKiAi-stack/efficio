/**
 * report-generator 测试
 *
 * 覆盖周总结/月趋势生成的核心正确性：
 * - 周范围含周日（原实现 lt: week_end 会漏掉周日记录）
 * - 12 月边界（原实现 endDate = 12-01 导致区间为空）
 * - skipIfExists 幂等、无记录返回 no_records
 * - 日期范围辅助函数对各种星期几的正确性
 *
 * 测试环境无 AI 配置，走降级（规则）生成路径。
 */

import {
  generateWeeklySummaryForUser,
  generateMonthlyTrendForUser,
  getLastWeekRange,
  getLastMonth,
  calculateMonthlyStats
} from '../lib/report-generator';
import { getDatabase, resetInMemoryStore } from '../lib/database-new';

// 强制 AI 不可用，测试走确定性的降级（规则）生成路径，
// 避免依赖外部环境变量（如开发机导出的 DEEPSEEK_API_KEY）发起真实请求
jest.mock('../lib/ai', () => {
  const actual = jest.requireActual('../lib/ai');
  return {
    ...actual,
    isAiAvailable: () => false
  };
});

const USER = 'report-user';

async function seedRecord(created_at: string, originalText = '测试记录') {
  const { data, error } = await getDatabase().insert('work_records', {
    user_id: USER,
    original_text: originalText,
    structured_data: {
      task_category: 'development',
      time_spent: '2h',
      tools_used: ['VSCode'],
      tags: ['dev'],
      is_deep_work: true,
      interruptions: 1,
      value_level: 'high'
    },
    created_at
  });
  if (error) throw error;
  return data;
}

describe('report-generator', () => {
  beforeEach(() => {
    resetInMemoryStore();
  });

  describe('getLastWeekRange', () => {
    it('周三调用应返回上一个完整周（周一 ~ 周日）', () => {
      // 2026-08-19 是周三
      const range = getLastWeekRange(new Date(2026, 7, 19, 12, 0, 0));
      expect(range.weekStart).toBe('2026-08-10');
      expect(range.weekEnd).toBe('2026-08-16');
    });

    it('周一调用应返回上一周而非本周', () => {
      const range = getLastWeekRange(new Date(2026, 7, 17, 8, 0, 0));
      expect(range.weekStart).toBe('2026-08-10');
      expect(range.weekEnd).toBe('2026-08-16');
    });

    it('周日调用时周日属于本周，返回的仍是上一周', () => {
      const range = getLastWeekRange(new Date(2026, 7, 16, 23, 0, 0));
      expect(range.weekStart).toBe('2026-08-03');
      expect(range.weekEnd).toBe('2026-08-09');
    });
  });

  describe('getLastMonth', () => {
    it('年中返回同年上月', () => {
      expect(getLastMonth(new Date(2026, 7, 19))).toEqual({ year: 2026, month: 7 });
    });

    it('1 月返回上一年 12 月', () => {
      expect(getLastMonth(new Date(2026, 0, 15))).toEqual({ year: 2025, month: 12 });
    });
  });

  describe('generateWeeklySummaryForUser', () => {
    it('应包含周日的记录（含首尾日期）', async () => {
      // 上周一 2026-08-10 ~ 上周日 2026-08-16
      await seedRecord('2026-08-10T02:00:00.000Z', '周一工作');
      await seedRecord('2026-08-12T06:00:00.000Z', '周三工作');
      await seedRecord('2026-08-16T14:00:00.000Z', '周日工作');
      // 范围外的记录
      await seedRecord('2026-08-17T02:00:00.000Z', '下周一，不应计入');

      const result = await generateWeeklySummaryForUser(USER, '2026-08-10', '2026-08-16');

      expect(result.status).toBe('generated');
      expect(result.data.summary_data.total_records).toBe(3);
      expect(result.data.markdown_content).toBeTruthy();
      expect(result.data.week_start).toBe('2026-08-10');
      expect(result.data.week_end).toBe('2026-08-16');
    });

    it('空周应返回 no_records 且不落库', async () => {
      const result = await generateWeeklySummaryForUser(USER, '2026-08-03', '2026-08-09');

      expect(result.status).toBe('no_records');

      const { data } = await getDatabase().select('weekly_summaries', {
        where: { user_id: USER }
      });
      expect(data).toEqual([]);
    });

    it('skipIfExists 时已有总结应跳过', async () => {
      await seedRecord('2026-08-11T02:00:00.000Z');

      const first = await generateWeeklySummaryForUser(USER, '2026-08-10', '2026-08-16');
      expect(first.status).toBe('generated');

      const second = await generateWeeklySummaryForUser(USER, '2026-08-10', '2026-08-16', {
        skipIfExists: true
      });
      expect(second.status).toBe('skipped_existing');

      const { data } = await getDatabase().select('weekly_summaries', {
        where: { user_id: USER }
      });
      expect(data).toHaveLength(1);
    });

    it('不带 skipIfExists 重复生成应更新而非新增', async () => {
      await seedRecord('2026-08-11T02:00:00.000Z', '第一条');

      await generateWeeklySummaryForUser(USER, '2026-08-10', '2026-08-16');

      await seedRecord('2026-08-12T02:00:00.000Z', '第二条');
      const again = await generateWeeklySummaryForUser(USER, '2026-08-10', '2026-08-16');

      expect(again.status).toBe('generated');
      expect(again.data.summary_data.total_records).toBe(2);

      const { data } = await getDatabase().select('weekly_summaries', {
        where: { user_id: USER }
      });
      expect(data).toHaveLength(1);
    });
  });

  describe('generateMonthlyTrendForUser', () => {
    it('12 月应能正确统计（回归：原实现 12 月区间为空）', async () => {
      await seedRecord('2025-12-15T10:00:00.000Z', '12 月的工作');

      const result = await generateMonthlyTrendForUser(USER, 2025, 12);

      expect(result.status).toBe('generated');
      expect(result.data.trend_data.total_records).toBe(1);
      expect(result.data.trend_data.year).toBe(2025);
      expect(result.data.trend_data.month).toBe(12);
      expect(result.data.insights).toContain('月度趋势分析');
    });

    it('应排除相邻月份的记录', async () => {
      await seedRecord('2026-07-31T23:00:00.000Z', '7 月末，不应计入');
      await seedRecord('2026-08-01T01:00:00.000Z', '8 月工作');
      await seedRecord('2026-08-31T12:00:00.000Z', '8 月末工作');
      await seedRecord('2026-09-01T00:30:00.000Z', '9 月初，不应计入');

      const result = await generateMonthlyTrendForUser(USER, 2026, 8);

      expect(result.status).toBe('generated');
      expect(result.data.trend_data.total_records).toBe(2);
    });

    it('空月应返回 no_records', async () => {
      const result = await generateMonthlyTrendForUser(USER, 2026, 1);
      expect(result.status).toBe('no_records');
    });

    it('skipIfExists 时已有趋势应跳过', async () => {
      await seedRecord('2026-08-10T02:00:00.000Z');

      const first = await generateMonthlyTrendForUser(USER, 2026, 8);
      expect(first.status).toBe('generated');

      const second = await generateMonthlyTrendForUser(USER, 2026, 8, { skipIfExists: true });
      expect(second.status).toBe('skipped_existing');
    });
  });

  describe('calculateMonthlyStats', () => {
    it('应正确聚合结构化数据', async () => {
      await seedRecord('2026-08-10T02:00:00.000Z');
      const { data } = await getDatabase().select('work_records', { where: { user_id: USER } });

      const stats = calculateMonthlyStats(data || []);

      expect(stats.totalRecords).toBe(1);
      expect(stats.totalHours).toBe(2);
      expect(stats.categoryBreakdown['development']).toBe(1);
      expect(stats.deepWorkCount).toBe(1);
      expect(stats.toolsUsed).toContain('VSCode');
      expect(stats.valueLevelBreakdown['high']).toBe(1);
    });

    it('无结构化数据的记录不应导致异常', () => {
      const stats = calculateMonthlyStats([{ original_text: 'x', structured_data: null }]);
      expect(stats.totalRecords).toBe(1);
      expect(stats.totalHours).toBe(0);
    });
  });
});
