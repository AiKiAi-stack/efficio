/**
 * DailyLogs 路由测试
 *
 * 覆盖当日日志保存/读取与时间字段继承
 * （补丁保存不回传 start_time/end_time 时不应重置/清空）。
 */

import request from 'supertest';
import express from 'express';
import { dailyLogsRouter } from '../routes/dailyLogs';
import { resetInMemoryStore } from '../lib/database-new';
import { localDateStr } from '../lib/date';

const app = express();
app.use(express.json());
app.use('/api/daily-logs', dailyLogsRouter);

const USER = 'daily-log-user';

describe('DailyLogs Routes', () => {
  beforeEach(() => {
    resetInMemoryStore();
  });

  it('缺少 X-User-Id 时应返回 401', async () => {
    const get = await request(app).get('/api/daily-logs/today');
    expect(get.status).toBe(401);

    const post = await request(app).post('/api/daily-logs').send({ goals: 'x' });
    expect(post.status).toBe(401);

    const history = await request(app).get('/api/daily-logs/history');
    expect(history.status).toBe(401);
  });

  it('开始今天应创建当日日志并设置 start_time', async () => {
    const res = await request(app)
      .post('/api/daily-logs')
      .set('x-user-id', USER)
      .send({ goals: '完成功能开发', start_time: '2026-08-19T00:30:00.000Z', mood_score: 4 });

    expect(res.status).toBe(200);
    expect(res.body.data.goals).toBe('完成功能开发');
    expect(res.body.data.start_time).toBe('2026-08-19T00:30:00.000Z');
    expect(res.body.data.end_time).toBeNull();

    const today = await request(app)
      .get('/api/daily-logs/today')
      .set('x-user-id', USER);

    expect(today.status).toBe(200);
    expect(today.body.data.goals).toBe('完成功能开发');
  });

  it('完成后再保存反思：省略时间字段应继承原值，不重置开始时间', async () => {
    const startTime = '2026-08-19T00:30:00.000Z';
    const endTime = '2026-08-19T10:00:00.000Z';

    await request(app)
      .post('/api/daily-logs')
      .set('x-user-id', USER)
      .send({ goals: '目标', start_time: startTime });

    await request(app)
      .post('/api/daily-logs')
      .set('x-user-id', USER)
      .send({ goals: '目标', accomplishments: '完成', start_time: startTime, end_time: endTime });

    // 模拟反思保存：不回传任何时间字段
    const res = await request(app)
      .post('/api/daily-logs')
      .set('x-user-id', USER)
      .send({ goals: '目标', accomplishments: '完成', reflection: '效率不错' });

    expect(res.status).toBe(200);
    expect(res.body.data.reflection).toBe('效率不错');
    expect(res.body.data.start_time).toBe(startTime);
    expect(res.body.data.end_time).toBe(endTime);
  });

  it('显式传入 end_time 应覆盖旧值', async () => {
    await request(app)
      .post('/api/daily-logs')
      .set('x-user-id', USER)
      .send({ goals: '目标', start_time: '2026-08-19T00:30:00.000Z' });

    const res = await request(app)
      .post('/api/daily-logs')
      .set('x-user-id', USER)
      .send({
        goals: '目标',
        accomplishments: '完成',
        start_time: '2026-08-19T00:30:00.000Z',
        end_time: '2026-08-19T12:00:00.000Z'
      });

    expect(res.body.data.end_time).toBe('2026-08-19T12:00:00.000Z');
  });

  it('历史日志按日期倒序返回', async () => {
    await request(app)
      .post('/api/daily-logs')
      .set('x-user-id', USER)
      .send({ goals: '今天的目标' });

    const history = await request(app)
      .get('/api/daily-logs/history')
      .set('x-user-id', USER);

    expect(history.status).toBe(200);
    expect(history.body.data.length).toBe(1);
    expect(history.body.data[0].goals).toBe('今天的目标');
  });

  it('log_date 按本地日历划分（接线 localDateStr，而非 UTC 日期）', async () => {
    const res = await request(app)
      .post('/api/daily-logs')
      .set('x-user-id', USER)
      .send({ goals: '日界接线验证' });

    expect(res.status).toBe(200);
    expect(res.body.data.log_date).toBe(localDateStr());

    const today = await request(app)
      .get('/api/daily-logs/today')
      .set('x-user-id', USER);
    expect(today.status).toBe(200);
    expect(today.body.data).not.toBeNull();
  });
});
