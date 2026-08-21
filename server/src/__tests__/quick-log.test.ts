/**
 * QuickLog（CLI 快速打卡）领域逻辑测试
 *
 * 覆盖：payload 映射与校验、邮箱→用户 id 解析、
 * 向 /api/daily-logs 推送（注入 fetchImpl，不依赖真实服务）。
 */

import { toDailyLogPayload, resolveUserId, pushDailyLog } from '../lib/quick-log';

const fetchMock = jest.fn();

beforeEach(() => {
  fetchMock.mockReset();
});

describe('toDailyLogPayload', () => {
  it('camelCase 入参映射为 API 的 snake_case 字段', () => {
    const payload = toDailyLogPayload({
      goals: '目标',
      accomplishments: '完成',
      reflection: '反思',
      moodScore: 4,
      energyLevel: 3
    });

    expect(payload).toEqual({
      goals: '目标',
      accomplishments: '完成',
      reflection: '反思',
      mood_score: 4,
      energy_level: 3
    });
  });

  it('未提供的字段不出现在 payload 中', () => {
    expect(toDailyLogPayload({ moodScore: 5 })).toEqual({ mood_score: 5 });
    expect(toDailyLogPayload({})).toEqual({});
  });

  it('mood/energy 超出 1-5 应拒绝', () => {
    expect(() => toDailyLogPayload({ moodScore: 0 })).toThrow(/1-5/);
    expect(() => toDailyLogPayload({ energyLevel: 6 })).toThrow(/1-5/);
    expect(() => toDailyLogPayload({ moodScore: 3.5 })).toThrow(/整数/);
  });
});

describe('resolveUserId', () => {
  it('纯 id 直接透传，不发起请求', async () => {
    const id = await resolveUserId('user-abc', 'http://x', fetchMock);
    expect(id).toBe('user-abc');
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('邮箱走登录接口换取真实 id', async () => {
    fetchMock.mockResolvedValue(new Response(JSON.stringify({
      success: true,
      data: { user: { id: 'real-id', email: 'me@test.com' } }
    }), { status: 200 }));

    const id = await resolveUserId('me@test.com', 'http://x', fetchMock);

    expect(id).toBe('real-id');
    expect(fetchMock).toHaveBeenCalledWith('http://x/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'me@test.com' })
    });
  });

  it('登录失败时抛出服务端错误信息', async () => {
    fetchMock.mockResolvedValue(new Response(JSON.stringify({
      success: false,
      error: '登录失败'
    }), { status: 500 }));

    await expect(resolveUserId('me@test.com', 'http://x', fetchMock))
      .rejects.toThrow('登录失败');
  });
});

describe('pushDailyLog', () => {
  it('带 x-user-id 头 POST 到 daily-logs 并返回数据', async () => {
    fetchMock.mockResolvedValue(new Response(JSON.stringify({
      success: true,
      data: { id: 'log-1', log_date: '2026-08-22', goals: '目标' }
    }), { status: 200 }));

    const result = await pushDailyLog(
      { goals: '目标' },
      { baseUrl: 'http://x', userId: 'u1' },
      fetchMock
    );

    expect(result.success).toBe(true);
    expect(result.data?.log_date).toBe('2026-08-22');
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('http://x/api/daily-logs');
    expect((init.headers as Record<string, string>)['x-user-id']).toBe('u1');
  });

  it('success=false 时抛出错误信息', async () => {
    fetchMock.mockResolvedValue(new Response(JSON.stringify({
      success: false,
      error: '未授权'
    }), { status: 401 }));

    await expect(pushDailyLog({}, { baseUrl: 'http://x', userId: 'u1' }, fetchMock))
      .rejects.toThrow('未授权');
  });
});
