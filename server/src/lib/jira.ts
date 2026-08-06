/**
 * Jira REST API 客户端（单向拉取）
 *
 * 支持自建 Jira（Data Center / Server）与 Jira Cloud，三种认证方式：
 * - basic：邮箱 + API Token（Jira Cloud）
 * - pat：Personal Access Token（自建 Jira）
 * - cookie：账号 + 密码，通过 /rest/auth/1/session 获取 JSESSIONID 会话（自建 Jira）
 *
 * 配置通过 configManager 存储（JIRA_* 前缀），也可用环境变量
 */

import { configManager } from './config-manager';

export type JiraAuthType = 'basic' | 'pat' | 'cookie';

export interface JiraConfig {
  url: string;
  email?: string;
  apiToken?: string;
  authType: JiraAuthType;
  jql?: string;
  maxResults: number;
  enabled: boolean;
  /** Cookie 认证的临时凭据（测试连接时使用，不持久化） */
  username?: string;
  password?: string;
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
    authType: (config.JIRA_AUTH_TYPE || process.env.JIRA_AUTH_TYPE || 'basic') as JiraAuthType,
    jql: config.JIRA_JQL || process.env.JIRA_JQL || 'assignee = currentUser() AND resolution = Unresolved ORDER BY updated DESC',
    maxResults: parseInt(config.JIRA_MAX_RESULTS || process.env.JIRA_MAX_RESULTS || '50', 10),
    enabled: config.JIRA_ENABLED !== 'false' && process.env.JIRA_ENABLED !== 'false'
  };
}

/**
 * 获取 Jira 凭据（用户名/密码，Cookie 认证用）
 * 密码不回显：仅从配置读取
 */
function getCredentials(cfg: JiraConfig): { username: string; password: string } {
  const config = configManager.read();
  return {
    username: cfg.username || config.JIRA_USERNAME || process.env.JIRA_USERNAME || cfg.email || '',
    password: cfg.password || config.JIRA_PASSWORD || process.env.JIRA_PASSWORD || ''
  };
}

export function isJiraConfigured(): boolean {
  const cfg = getJiraConfig();
  if (!cfg.enabled || !cfg.url) return false;
  if (cfg.authType === 'cookie') {
    const creds = getCredentials(cfg);
    return !!creds.username && !!creds.password;
  }
  return !!cfg.apiToken;
}

// ============ Cookie 会话认证 ============

let sessionCookie: string | null = null;

/**
 * 通过账号密码登录 Jira Server，获取 JSESSIONID 会话
 * POST /rest/auth/1/session（Jira Server 专有接口，Cloud 不支持）
 */
async function jiraSessionLogin(cfg: JiraConfig): Promise<string> {
  const creds = getCredentials(cfg);
  if (!creds.username || !creds.password) {
    throw new Error('Jira 未配置：Cookie 认证需要填写用户名与密码');
  }

  const baseUrl = cfg.url.replace(/\/+$/, '');
  const res = await fetch(`${baseUrl}/rest/auth/1/session`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({ username: creds.username, password: creds.password })
  });

  if (!res.ok) {
    if (res.status === 401 || res.status === 403) {
      throw new Error('Jira 登录失败（HTTP ' + res.status + '）：用户名或密码错误，或该接口未开放');
    }
    if (res.status === 404) {
      throw new Error('Jira 登录接口不存在（HTTP 404）：/rest/auth/1/session 仅自建 Jira Server 支持，Cloud 请改用 邮箱+API Token');
    }
    throw new Error(`Jira 登录失败（HTTP ${res.status}）`);
  }

  const data: any = await res.json().catch(() => null);
  // 优先从响应体取 session，其次从 Set-Cookie 头
  const fromBody = data?.session?.name && data?.session?.value
    ? `${data.session.name}=${data.session.value}`
    : null;
  const fromHeader = res.headers?.get?.('set-cookie') || '';

  const cookie = fromBody || fromHeader.split(';')[0] || null;
  if (!cookie) {
    throw new Error('Jira 登录成功但未获取到会话 Cookie');
  }

  sessionCookie = cookie;
  return cookie;
}

function clearSession(): void {
  sessionCookie = null;
}

/** 导出以便测试清理会话缓存 */
export { clearSession };

/**
 * 从 Jira 拉取当前用户的 issue 列表（REST API v2 /search）
 */
export async function fetchJiraIssues(cfg?: JiraConfig): Promise<JiraIssue[]> {
  const config = cfg || getJiraConfig();

  if (!config.url) {
    throw new Error('Jira 未配置：请在设置页填写 Jira 地址与认证信息');
  }
  if (config.authType !== 'cookie' && !config.apiToken) {
    throw new Error('Jira 未配置：请在设置页填写认证凭据');
  }

  const baseUrl = config.url.replace(/\/+$/, '');
  const jql = config.jql || 'assignee = currentUser()';

  const doSearch = async (): Promise<Response> => {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      Accept: 'application/json'
    };

    if (config.authType === 'cookie') {
      if (!sessionCookie) {
        await jiraSessionLogin(config);
      }
      headers.Cookie = sessionCookie as string;
    } else if (config.authType === 'pat') {
      headers.Authorization = `Bearer ${config.apiToken}`;
    } else {
      headers.Authorization = `Basic ${Buffer.from(`${config.email || ''}:${config.apiToken}`).toString('base64')}`;
    }

    return fetch(`${baseUrl}/rest/api/2/search`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        jql,
        maxResults: config.maxResults,
        fields: ['summary', 'status', 'priority', 'assignee', 'updated']
      })
    });
  };

  let res = await doSearch();

  // Cookie 会话过期：清除会话重登一次
  if (config.authType === 'cookie' && (res.status === 401 || res.status === 403)) {
    clearSession();
    res = await doSearch();
  }

  if (!res.ok) {
    const body = await res.text().catch(() => '');
    if (res.status === 401 || res.status === 403) {
      throw new Error(
        `Jira 认证失败（HTTP ${res.status}）：请检查认证方式与凭据。自建 Jira 可用 账号密码 或 PAT，Jira Cloud 用 邮箱+API Token。`
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
