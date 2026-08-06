/**
 * Jira 客户端测试（mock 全局 fetch，不触发真实网络）
 */

import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { fetchJiraIssues, getJiraConfig, isJiraConfigured } from '../lib/jira';

const mockFetch = jest.fn();

describe('Jira 客户端', () => {
  beforeEach(() => {
    process.env.JIRA_URL = 'https://jira.example.com';
    process.env.JIRA_API_TOKEN = 'test-token';
    process.env.JIRA_EMAIL = 'me@example.com';
    delete process.env.JIRA_AUTH_TYPE;
    delete process.env.JIRA_JQL;
    (global as any).fetch = mockFetch;
    mockFetch.mockReset();
  });

  afterEach(() => {
    delete process.env.JIRA_URL;
    delete process.env.JIRA_API_TOKEN;
    delete process.env.JIRA_EMAIL;
  });

  it('应正确解析 issue 列表', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({
        issues: [
          {
            key: 'PROJ-1',
            fields: {
              summary: 'Fix bug',
              status: { name: 'In Progress' },
              priority: { name: 'High' },
              assignee: { displayName: 'Alice' },
              updated: '2026-08-01T10:00:00Z'
            }
          },
          {
            key: 'PROJ-2',
            fields: { summary: 'Write docs', status: { name: 'Done' } }
          }
        ]
      })
    });

    const issues = await fetchJiraIssues();

    expect(issues).toHaveLength(2);
    expect(issues[0]).toMatchObject({
      key: 'PROJ-1',
      summary: 'Fix bug',
      status: 'In Progress',
      priority: 'High',
      assignee: 'Alice'
    });
    expect(issues[0].url).toBe('https://jira.example.com/browse/PROJ-1');
    expect(issues[1].status).toBe('Done');
    expect(issues[1].priority).toBeNull();
  });

  it('请求应使用 POST /rest/api/2/search 并携带认证头', async () => {
    mockFetch.mockResolvedValue({ ok: true, json: async () => ({ issues: [] }) });

    await fetchJiraIssues();

    const [url, init] = mockFetch.mock.calls[0];
    expect(url).toBe('https://jira.example.com/rest/api/2/search');
    expect(init.method).toBe('POST');
    expect(init.headers.Authorization).toContain('Basic ');
  });

  it('PAT 认证应使用 Bearer 头', async () => {
    process.env.JIRA_AUTH_TYPE = 'pat';
    mockFetch.mockResolvedValue({ ok: true, json: async () => ({ issues: [] }) });

    await fetchJiraIssues();

    const [, init] = mockFetch.mock.calls[0];
    expect(init.headers.Authorization).toBe('Bearer test-token');
  });

  it('401 应返回认证错误提示', async () => {
    mockFetch.mockResolvedValue({ ok: false, status: 401, text: async () => 'Unauthorized' });

    await expect(fetchJiraIssues()).rejects.toThrow('认证失败');
  });

  it('其他 HTTP 错误应返回状态码', async () => {
    mockFetch.mockResolvedValue({ ok: false, status: 500, text: async () => 'boom' });

    await expect(fetchJiraIssues()).rejects.toThrow('HTTP 500');
  });

  it('未配置时应抛错提示去设置页', async () => {
    delete process.env.JIRA_URL;
    delete process.env.JIRA_API_TOKEN;

    await expect(fetchJiraIssues()).rejects.toThrow('Jira 未配置');
  });

  it('isJiraConfigured 应正确反映配置状态', () => {
    expect(isJiraConfigured()).toBe(true);

    delete process.env.JIRA_API_TOKEN;
    expect(isJiraConfigured()).toBe(false);
  });

  it('getJiraConfig 应返回默认 JQL', () => {
    const cfg = getJiraConfig();
    expect(cfg.jql).toContain('currentUser()');
    expect(cfg.authType).toBe('basic');
    expect(cfg.maxResults).toBe(50);
  });

  describe('Cookie 会话认证', () => {
    beforeEach(() => {
      process.env.JIRA_AUTH_TYPE = 'cookie';
      process.env.JIRA_USERNAME = 'jira-user';
      process.env.JIRA_PASSWORD = 'jira-pass';
      delete process.env.JIRA_API_TOKEN;
      // 清空模块级会话缓存
      const mod = require('../lib/jira') as any;
      if (typeof mod.clearSession === 'function') mod.clearSession();
    });

    afterEach(() => {
      delete process.env.JIRA_AUTH_TYPE;
      delete process.env.JIRA_USERNAME;
      delete process.env.JIRA_PASSWORD;
    });

    it('应先用账号密码登录获取 JSESSIONID，再携带 Cookie 请求搜索', async () => {
      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: async () => ({ session: { name: 'JSESSIONID', value: 'abc123' } })
        })
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: async () => ({ issues: [{ key: 'PROJ-9', fields: { summary: 'Cookie task' } }] })
        });

      const issues = await fetchJiraIssues();

      // 第一次调用：登录
      const [loginUrl, loginInit] = mockFetch.mock.calls[0];
      expect(loginUrl).toContain('/rest/auth/1/session');
      expect(loginInit.method).toBe('POST');
      expect(JSON.parse(loginInit.body)).toEqual({ username: 'jira-user', password: 'jira-pass' });

      // 第二次调用：搜索，带 Cookie
      const [, searchInit] = mockFetch.mock.calls[1];
      expect(searchInit.headers.Cookie).toBe('JSESSIONID=abc123');

      expect(issues).toHaveLength(1);
      expect(issues[0].key).toBe('PROJ-9');
    });

    it('会话过期（401）时应自动重新登录并重试一次', async () => {
      mockFetch
        .mockResolvedValueOnce({ ok: true, status: 200, json: async () => ({ session: { name: 'JSESSIONID', value: 'old' } }) })
        .mockResolvedValueOnce({ ok: false, status: 401, text: async () => 'Unauthorized' })
        .mockResolvedValueOnce({ ok: true, status: 200, json: async () => ({ session: { name: 'JSESSIONID', value: 'new' } }) })
        .mockResolvedValueOnce({ ok: true, status: 200, json: async () => ({ issues: [] }) });

      await fetchJiraIssues();

      // 应有 4 次调用：登录1 → 搜索1(401) → 登录2 → 搜索2
      expect(mockFetch.mock.calls.length).toBe(4);
      const [, retrySearch] = mockFetch.mock.calls[3];
      expect(retrySearch.headers.Cookie).toBe('JSESSIONID=new');
    });
  });
});
