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
});
