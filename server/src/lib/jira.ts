/**
 * Jira REST API 客户端（单向拉取）
 *
 * 支持自建 Jira（Data Center / Server）与 Jira Cloud：
 * - Basic 认证（邮箱 + API Token，Jira Cloud）
 * - PAT 认证（Bearer Token，自建 Jira）
 *
 * 配置通过 configManager 存储（JIRA_* 前缀），也可用环境变量
 */

import { configManager } from './config-manager';

export interface JiraConfig {
  url: string;
  email?: string;
  apiToken?: string;
  authType: 'basic' | 'pat';
  jql?: string;
  maxResults: number;
  enabled: boolean;
}

export interface JiraIssue {
  key: string;
  summary: string;
  status: string;
  priority: string | null;
  assignee: string | null;
  updated: string | null;
  url: string;
}

export function getJiraConfig(): JiraConfig {
  const config = configManager.read();
  return {
    url: config.JIRA_URL || process.env.JIRA_URL || '',
    email: config.JIRA_EMAIL || process.env.JIRA_EMAIL || '',
    apiToken: config.JIRA_API_TOKEN || process.env.JIRA_API_TOKEN || '',
    authType: (config.JIRA_AUTH_TYPE || process.env.JIRA_AUTH_TYPE || 'basic') as 'basic' | 'pat',
    jql: config.JIRA_JQL || process.env.JIRA_JQL || 'assignee = currentUser() AND resolution = Unresolved ORDER BY updated DESC',
    maxResults: parseInt(config.JIRA_MAX_RESULTS || process.env.JIRA_MAX_RESULTS || '50', 10),
    enabled: config.JIRA_ENABLED !== 'false' && process.env.JIRA_ENABLED !== 'false'
  };
}

export function isJiraConfigured(): boolean {
  const cfg = getJiraConfig();
  return cfg.enabled && !!cfg.url && !!cfg.apiToken;
}

function authHeader(cfg: JiraConfig): string {
  if (cfg.authType === 'pat') {
    return `Bearer ${cfg.apiToken}`;
  }
  return `Basic ${Buffer.from(`${cfg.email || ''}:${cfg.apiToken}`).toString('base64')}`;
}

/**
 * 从 Jira 拉取当前用户的 issue 列表（REST API v2 /search）
 */
export async function fetchJiraIssues(cfg?: JiraConfig): Promise<JiraIssue[]> {
  const config = cfg || getJiraConfig();

  if (!config.url || !config.apiToken) {
    throw new Error('Jira 未配置：请在设置页填写 Jira 地址与 API Token');
  }

  const baseUrl = config.url.replace(/\/+$/, '');
  const jql = config.jql || 'assignee = currentUser()';

  const res = await fetch(`${baseUrl}/rest/api/2/search`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: authHeader(config),
      Accept: 'application/json'
    },
    body: JSON.stringify({
      jql,
      maxResults: config.maxResults,
      fields: ['summary', 'status', 'priority', 'assignee', 'updated']
    })
  });

  if (!res.ok) {
    const body = await res.text().catch(() => '');
    if (res.status === 401 || res.status === 403) {
      throw new Error(
        `Jira 认证失败（HTTP ${res.status}）：请检查认证方式与凭据。自建 Jira 用 PAT（Bearer），Jira Cloud 用 邮箱+API Token。`
      );
    }
    throw new Error(`Jira 请求失败（HTTP ${res.status}）：${body.slice(0, 300)}`);
  }

  const data: any = await res.json();
  const issues = data.issues || [];

  return issues.map((issue: any) => {
    const fields = issue.fields || {};
    return {
      key: issue.key,
      summary: fields.summary || '',
      status: fields.status?.name || '未知',
      priority: fields.priority?.name || null,
      assignee: fields.assignee?.displayName || null,
      updated: fields.updated || null,
      url: `${baseUrl}/browse/${issue.key}`
    };
  });
}

/**
 * 同步某个用户的 Jira 任务到本地（upsert）
 */
export async function syncJiraForUser(userId: string): Promise<{ total: number; upserted: number }> {
  const { getDatabase } = await import('./database-new');
  const issues = await fetchJiraIssues();
  const db = getDatabase();

  let upserted = 0;
  for (const issue of issues) {
    const { data: existing } = await db.selectSingle('jira_tasks', {
      where: { user_id: userId, jira_key: issue.key }
    });

    if (existing) {
      await db.update('jira_tasks', existing.id, {
        summary: issue.summary,
        status: issue.status,
        priority: issue.priority,
        assignee: issue.assignee,
        url: issue.url,
        synced_at: new Date().toISOString()
      });
    } else {
      await db.insert('jira_tasks', {
        user_id: userId,
        jira_key: issue.key,
        summary: issue.summary,
        status: issue.status,
        priority: issue.priority,
        assignee: issue.assignee,
        url: issue.url,
        synced_at: new Date().toISOString()
      });
    }
    upserted++;
  }

  return { total: issues.length, upserted };
}
