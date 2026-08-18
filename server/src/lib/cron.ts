import cron from 'node-cron';
import { getDatabase } from './database-new';
import { isJiraConfigured, syncJiraForUser } from './jira';
import {
  generateWeeklySummaryForUser,
  generateMonthlyTrendForUser,
  getLastWeekRange,
  getLastMonth
} from './report-generator';

/**
 * 定时任务服务
 * 针对 1G 1Core 5GB SSD 环境优化：
 * - 只在低峰期运行
 * - 逐用户串行处理，单个用户失败不中断
 * - 失败不重试避免资源消耗
 */

// 每周一早上 8:00 生成上周（周一 ~ 周日）总结
export const weeklySummaryJob = cron.schedule('0 8 * * 1', async () => {
  console.log('[Cron] 运行周总结生成任务...');

  try {
    const db = getDatabase();
    const { data: users } = await db.select('users', {});

    if (!users || users.length === 0) {
      console.log('[Cron] 无用户，跳过');
      return;
    }

    const { weekStart, weekEnd } = getLastWeekRange();
    let generated = 0;
    let skipped = 0;
    let empty = 0;

    for (const user of users) {
      try {
        const result = await generateWeeklySummaryForUser(user.id, weekStart, weekEnd, {
          skipIfExists: true
        });
        if (result.status === 'generated') generated++;
        else if (result.status === 'skipped_existing') skipped++;
        else empty++;
      } catch (error) {
        console.error(`[Cron] 处理用户 ${user.id} 失败:`, error);
        // 继续处理下一个用户，不中断
      }
    }

    console.log(
      `[Cron] 周总结任务完成 (${weekStart} ~ ${weekEnd})：生成 ${generated}，已存在跳过 ${skipped}，无记录 ${empty}`
    );
  } catch (error) {
    console.error('[Cron] 周总结任务失败:', error);
  }
}, {
  scheduled: true,
  timezone: 'Asia/Shanghai'
});

// 每月 1 号早上 9:00 生成上月趋势
export const monthlyTrendJob = cron.schedule('0 9 1 * *', async () => {
  console.log('[Cron] 运行月趋势生成任务...');

  try {
    const db = getDatabase();
    const { data: users } = await db.select('users', {});

    if (!users || users.length === 0) {
      console.log('[Cron] 无用户，跳过');
      return;
    }

    const { year, month } = getLastMonth();
    let generated = 0;
    let skipped = 0;
    let empty = 0;

    for (const user of users) {
      try {
        const result = await generateMonthlyTrendForUser(user.id, year, month, {
          skipIfExists: true
        });
        if (result.status === 'generated') generated++;
        else if (result.status === 'skipped_existing') skipped++;
        else empty++;
      } catch (error) {
        console.error(`[Cron] 处理用户 ${user.id} 失败:`, error);
      }
    }

    console.log(
      `[Cron] 月趋势任务完成 (${year}-${month})：生成 ${generated}，已存在跳过 ${skipped}，无记录 ${empty}`
    );
  } catch (error) {
    console.error('[Cron] 月趋势任务失败:', error);
  }
}, {
  scheduled: true,
  timezone: 'Asia/Shanghai'
});

// 每日 9:30 同步 Jira 任务（未配置时自动跳过）
export const jiraSyncJob = cron.schedule('30 9 * * *', async () => {
  console.log('[Cron] 运行 Jira 任务同步...');

  try {
    if (!isJiraConfigured()) {
      console.log('[Cron] Jira 未配置，跳过同步');
      return;
    }

    const db = getDatabase();
    const { data: users } = await db.select('users', {});

    if (!users || users.length === 0) {
      console.log('[Cron] 无用户，跳过');
      return;
    }

    for (const user of users) {
      try {
        const result = await syncJiraForUser(user.id);
        console.log(`[Cron] 用户 ${user.id} Jira 同步完成：${result.total} 个任务`);
      } catch (error) {
        console.error(`[Cron] 用户 ${user.id} Jira 同步失败:`, error);
      }
    }
  } catch (error) {
    console.error('[Cron] Jira 同步任务失败:', error);
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
  console.log('[Cron] Jira 同步任务：每天 9:30 (Asia/Shanghai)');
}

// 停止所有定时任务
export function stopCronJobs() {
  console.log('[Cron] 停止所有定时任务...');
  weeklySummaryJob.stop();
  monthlyTrendJob.stop();
  jiraSyncJob.stop();
}
