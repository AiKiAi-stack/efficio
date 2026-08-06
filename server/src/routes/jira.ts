import { Router } from 'express';
import { getDatabase } from '../lib/database-new';
import { configManager } from '../lib/config-manager';
import { fetchJiraIssues, getJiraConfig, isJiraConfigured, syncJiraForUser, JiraConfig } from '../lib/jira';

export const jiraRouter = Router();

// 获取 Jira 集成设置与状态
jiraRouter.get('/settings', (req, res) => {
  try {
    const cfg = getJiraConfig();
    res.json({
      success: true,
      data: {
        url: cfg.url,
        email: cfg.email,
        authType: cfg.authType,
        jql: cfg.jql,
        maxResults: cfg.maxResults,
        enabled: cfg.enabled,
        configured: isJiraConfigured(),
        hasApiToken: !!cfg.apiToken
      }
    });
  } catch (error) {
    console.error('Get jira settings error:', error);
    res.status(500).json({ success: false, error: '获取 Jira 设置失败' });
  }
});

// 保存 Jira 设置
jiraRouter.post('/settings', async (req, res) => {
  try {
    const { url, email, apiToken, authType, jql, maxResults, enabled } = req.body;

    if (!url || !url.trim()) {
      return res.status(400).json({ success: false, error: 'Jira 地址不能为空' });
    }
    try {
      new URL(url);
    } catch {
      return res.status(400).json({ success: false, error: 'Jira 地址必须是有效的 URL' });
    }

    const config = configManager.read();
    config.JIRA_URL = url.trim();
    if (apiToken && apiToken.trim()) {
      config.JIRA_API_TOKEN = apiToken.trim();
    }
    if (email && email.trim()) {
      config.JIRA_EMAIL = email.trim();
    }
    if (authType) {
      config.JIRA_AUTH_TYPE = authType === 'pat' ? 'pat' : 'basic';
    }
    if (jql && jql.trim()) {
      config.JIRA_JQL = jql.trim();
    }
    if (maxResults) {
      config.JIRA_MAX_RESULTS = String(maxResults);
    }
    config.JIRA_ENABLED = enabled === false ? 'false' : 'true';

    const success = configManager.write(config);

    if (!success) {
      return res.status(500).json({ success: false, error: '保存 Jira 设置失败' });
    }

    // 同步到当前进程环境变量
    process.env.JIRA_URL = config.JIRA_URL;
    if (config.JIRA_API_TOKEN) process.env.JIRA_API_TOKEN = config.JIRA_API_TOKEN;
    if (config.JIRA_EMAIL) process.env.JIRA_EMAIL = config.JIRA_EMAIL;
    process.env.JIRA_AUTH_TYPE = config.JIRA_AUTH_TYPE;
    process.env.JIRA_ENABLED = config.JIRA_ENABLED;

    res.json({ success: true, message: 'Jira 设置已保存' });
  } catch (error) {
    console.error('Save jira settings error:', error);
    res.status(500).json({ success: false, error: '保存 Jira 设置失败' });
  }
});

// 测试 Jira 连接
jiraRouter.post('/test', async (req, res) => {
  try {
    const { url, email, apiToken, authType } = req.body;

    const cfg: JiraConfig = {
      ...getJiraConfig(),
      url: (url && url.trim()) || getJiraConfig().url,
      email: (email && email.trim()) || getJiraConfig().email,
      apiToken: (apiToken && apiToken.trim()) || getJiraConfig().apiToken,
      authType: authType === 'pat' ? 'pat' : 'basic'
    };

    if (!cfg.url || !cfg.apiToken) {
      return res.status(400).json({ success: false, message: '请填写 Jira 地址与 API Token' });
    }

    const issues = await fetchJiraIssues(cfg);
    res.json({
      success: true,
      message: `连接成功，拉取到 ${issues.length} 个任务`
    });
  } catch (error: any) {
    res.json({
      success: false,
      message: error.message || '连接失败'
    });
  }
});

// 手动同步 Jira 任务
jiraRouter.post('/sync', async (req, res) => {
  try {
    const userId = req.headers['x-user-id'] as string;
    if (!userId) {
      return res.status(401).json({ success: false, error: '未授权' });
    }

    if (!isJiraConfigured()) {
      return res.status(400).json({
        success: false,
        error: 'Jira 未配置：请先在设置页填写 Jira 地址与 API Token'
      });
    }

    const result = await syncJiraForUser(userId);
    res.json({ success: true, data: result });
  } catch (error: any) {
    console.error('Jira sync error:', error);
    res.status(500).json({ success: false, error: error.message || 'Jira 同步失败' });
  }
});

// 获取已同步的 Jira 任务
jiraRouter.get('/tasks', async (req, res) => {
  try {
    const userId = req.headers['x-user-id'] as string;
    if (!userId) {
      return res.status(401).json({ success: false, error: '未授权' });
    }

    const db = getDatabase();
    const { data, error } = await db.select('jira_tasks', {
      where: { user_id: userId },
      orderBy: { column: 'synced_at', direction: 'DESC' }
    });

    if (error) throw error;

    res.json({ success: true, data: data || [] });
  } catch (error) {
    console.error('Get jira tasks error:', error);
    res.status(500).json({ success: false, error: '获取 Jira 任务失败' });
  }
});
