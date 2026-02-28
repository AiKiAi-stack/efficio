import cron from 'node-cron';
import { supabase } from './database';

/**
 * 定时任务服务
 * 针对 1G 1Core 5GB SSD 环境优化：
 * - 只在低峰期运行
 * - 限制并发任务数
 * - 失败不重试避免资源消耗
 */

// 每周一早上 8:00 生成上周总结
export const weeklySummaryJob = cron.schedule('0 8 * * 1', async () => {
  console.log('[Cron] 运行周总结生成任务...');

  try {
    // 获取所有用户
    const { data: users } = await supabase
      .from('users')
      .select('id');

    if (!users || users.length === 0) {
      console.log('[Cron] 无用户，跳过');
      return;
    }

    // 计算上周一和周日
    const now = new Date();
    const lastWeekMonday = new Date(now);
    lastWeekMonday.setDate(now.getDate() - now.getDay() - 6);
    const lastWeekSunday = new Date(now);
    lastWeekSunday.setDate(now.getDate() - now.getDay());

    const weekStart = lastWeekMonday.toISOString().split('T')[0];
    const weekEnd = lastWeekSunday.toISOString().split('T')[0];

    for (const user of users) {
      try {
        // 检查是否已存在该周总结
        const { data: existing } = await supabase
          .from('weekly_summaries')
          .select('id')
          .eq('user_id', user.id)
          .eq('week_start', weekStart)
          .single();

        if (existing) {
          console.log(`[Cron] 用户 ${user.id} 本周总结已存在，跳过`);
          continue;
        }

        // 检查该周是否有记录
        const { data: records } = await supabase
          .from('work_records')
          .select('id')
          .eq('user_id', user.id)
          .gte('created_at', weekStart)
          .lt('created_at', weekEnd)
          .limit(1);

        if (!records || records.length === 0) {
          console.log(`[Cron] 用户 ${user.id} 该周无记录，跳过`);
          continue;
        }

        // 调用 API 生成总结（通过内部 HTTP 调用）
        // 注意：这里简化处理，实际应该调用 HTTP 接口
        console.log(`[Cron] 用户 ${user.id} 有待生成的周总结`);

      } catch (error) {
        console.error(`[Cron] 处理用户 ${user.id} 失败:`, error);
        // 继续处理下一个用户，不中断
      }
    }

    console.log('[Cron] 周总结任务完成');
  } catch (error) {
    console.error('[Cron] 周总结任务失败:', error);
  }
}, {
  scheduled: true,
  timezone: 'Asia/Shanghai' // 使用时区
});

// 每月 1 号早上 9:00 生成上月趋势
export const monthlyTrendJob = cron.schedule('0 9 1 * *', async () => {
  console.log('[Cron] 运行月趋势生成任务...');

  try {
    const { data: users } = await supabase
      .from('users')
      .select('id');

    if (!users || users.length === 0) {
      console.log('[Cron] 无用户，跳过');
      return;
    }

    // 计算上月
    const now = new Date();
    const lastMonth = now.getMonth() === 0 ? 11 : now.getMonth() - 1;
    const year = now.getMonth() === 0 ? now.getFullYear() - 1 : now.getFullYear();

    for (const user of users) {
      try {
        const { data: existing } = await supabase
          .from('monthly_trends')
          .select('id')
          .eq('user_id', user.id)
          .eq('year', year)
          .eq('month', lastMonth + 1) // 数据库存储 1-12
          .single();

        if (existing) {
          console.log(`[Cron] 用户 ${user.id} 该月趋势已存在，跳过`);
          continue;
        }

        console.log(`[Cron] 用户 ${user.id} 有待生成的月趋势 (${year}-${lastMonth + 1})`);

      } catch (error) {
        console.error(`[Cron] 处理用户 ${user.id} 失败:`, error);
      }
    }

    console.log('[Cron] 月趋势任务完成');
  } catch (error) {
    console.error('[Cron] 月趋势任务失败:', error);
  }
}, {
  scheduled: true,
  timezone: 'Asia/Shanghai'
});

// 初始化定时任务
export function initCronJobs() {
  console.log('[Cron] 初始化定时任务...');
  console.log('[Cron] 周总结任务：每周一 8:00 (Asia/Shanghai)');
  console.log('[Cron] 月趋势任务：每月 1 号 9:00 (Asia/Shanghai)');
}

// 停止所有定时任务
export function stopCronJobs() {
  console.log('[Cron] 停止所有定时任务...');
  weeklySummaryJob.stop();
  monthlyTrendJob.stop();
}
