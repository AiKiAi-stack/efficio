import { useState, useEffect } from 'react';
import { getUserId } from '../api';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001/api';

interface JiraSettings {
  url: string;
  email: string;
  authType: 'basic' | 'pat' | 'cookie';
  jql: string;
  maxResults: number;
  enabled: boolean;
  configured: boolean;
  hasApiToken: boolean;
  hasUsername: boolean;
  hasPassword: boolean;
}

interface JiraTask {
  id: string;
  jira_key: string;
  summary: string;
  status: string;
  priority: string | null;
  url: string;
  synced_at: string;
}

export default function JiraPage() {
  const [settings, setSettings] = useState<JiraSettings | null>(null);
  const [form, setForm] = useState({
    url: '',
    email: '',
    apiToken: '',
    username: '',
    password: '',
    authType: 'cookie' as 'basic' | 'pat' | 'cookie',
    jql: 'assignee = currentUser() AND resolution = Unresolved ORDER BY updated DESC',
    maxResults: 50
  });
  const [tasks, setTasks] = useState<JiraTask[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [testing, setTesting] = useState(false);
  const [notice, setNotice] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  const showNotice = (type: 'success' | 'error', message: string) => {
    setNotice({ type, message });
    setTimeout(() => setNotice(null), 6000);
  };

  const load = async () => {
    try {
      const userId = getUserId();
      const [sRes, tRes] = await Promise.all([
        fetch(`${API_URL}/jira/settings`),
        fetch(`${API_URL}/jira/tasks`, {
          headers: userId ? { 'X-User-Id': userId } : {}
        })
      ]);
      const sData = await sRes.json();
      const tData = await tRes.json();
      if (sData.success && sData.data) {
        setSettings(sData.data);
        setForm({
          url: sData.data.url || '',
          email: sData.data.email || '',
          apiToken: '',
          username: '',
          password: '',
          authType: sData.data.authType || 'cookie',
          jql: sData.data.jql || 'assignee = currentUser() AND resolution = Unresolved ORDER BY updated DESC',
          maxResults: sData.data.maxResults || 50
        });
      }
      if (tData.success) setTasks(tData.data || []);
    } catch (e) {
      showNotice('error', '无法加载 Jira 设置，请检查服务器连接');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const save = async () => {
    if (!form.url.trim()) {
      showNotice('error', '请填写 Jira 地址');
      return;
    }
    try {
      const res = await fetch(`${API_URL}/jira/settings`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form)
      });
      const data = await res.json();
      showNotice(data.success ? 'success' : 'error', data.message || data.error || '保存失败');
      if (data.success) load();
    } catch (e: any) {
      showNotice('error', '保存失败：' + e.message);
    }
  };

  const test = async () => {
    setTesting(true);
    try {
      const res = await fetch(`${API_URL}/jira/test`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form)
      });
      const data = await res.json();
      showNotice(data.success ? 'success' : 'error', data.message || '测试完成');
    } catch (e: any) {
      showNotice('error', '测试失败：' + e.message);
    } finally {
      setTesting(false);
    }
  };

  const sync = async () => {
    const userId = getUserId();
    if (!userId) {
      showNotice('error', '会话已过期，请重新登录');
      return;
    }
    setSyncing(true);
    try {
      const res = await fetch(`${API_URL}/jira/sync`, {
        method: 'POST',
        headers: { 'X-User-Id': userId }
      });
      const data = await res.json();
      if (data.success) {
        showNotice('success', `同步完成：${data.data.total} 个任务`);
        load();
      } else {
        showNotice('error', data.error || '同步失败');
      }
    } catch (e: any) {
      showNotice('error', '同步失败：' + e.message);
    } finally {
      setSyncing(false);
    }
  };

  const statusBadge = (status: string) => {
    const s = status.toLowerCase();
    if (s.includes('done') || s.includes('完成') || s.includes('closed') || s.includes('已关闭')) {
      return <span className="px-1.5 py-0.5 text-xs bg-green-100 text-green-700 rounded">✓ {status}</span>;
    }
    if (s.includes('in progress') || s.includes('进行') || s.includes('open')) {
      return <span className="px-1.5 py-0.5 text-xs bg-blue-100 text-blue-700 rounded">● {status}</span>;
    }
    return <span className="px-1.5 py-0.5 text-xs bg-gray-100 text-gray-600 rounded">{status}</span>;
  };

  return (
    <div className="space-y-6">
      {notice && (
        <div className={`px-4 py-3 rounded-lg text-sm border ${
          notice.type === 'success'
            ? 'bg-green-50 border-green-200 text-green-800'
            : 'bg-red-50 border-red-200 text-red-700'
        }`}>
          {notice.type === 'success' ? '✅' : '⚠️'} {notice.message}
        </div>
      )}

      <div className="bg-white rounded-lg shadow p-6">
        <div className="flex items-center justify-between mb-2">
          <h2 className="text-lg font-semibold text-gray-800">🔗 Jira 集成</h2>
          {settings && (
            <span className={`px-2 py-1 text-xs rounded ${
              settings.configured ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'
            }`}>
              {settings.configured ? '已配置' : '未配置'}
            </span>
          )}
        </div>
        <p className="text-sm text-gray-600 mb-4">
          单向拉取：把 Jira 任务同步到本地，工作记录可关联 issue key，总结按任务维度分析。
          <span className="text-gray-400">（可选功能 —— 不配置 Jira 不影响任务与记录的使用）</span>
        </p>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Jira 地址 *</label>
            <input
              type="text"
              value={form.url}
              onChange={(e) => setForm({ ...form, url: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500"
              placeholder="https://jira.company.com"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">认证方式</label>
            <select
              value={form.authType}
              onChange={(e) => setForm({ ...form, authType: e.target.value as 'basic' | 'pat' | 'cookie' })}
              className="w-full px-3 py-2 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 bg-white"
            >
              <option value="cookie">账号 + 密码（自建 Jira Server，Cookie 会话）</option>
              <option value="pat">PAT 令牌（自建 Jira Server/Data Center）</option>
              <option value="basic">邮箱 + API Token（Jira Cloud）</option>
            </select>
          </div>

          {form.authType === 'cookie' ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">用户名 *</label>
                <input
                  type="text"
                  value={form.username}
                  onChange={(e) => setForm({ ...form, username: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500"
                  placeholder="your.jira.username"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">密码 *</label>
                <input
                  type="password"
                  value={form.password}
                  onChange={(e) => setForm({ ...form, password: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500"
                  placeholder={settings?.hasPassword ? '已保存（重新输入可更新）' : '你的 Jira 登录密码'}
                />
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  {form.authType === 'basic' ? '邮箱（Jira Cloud）' : '无需邮箱'}
                </label>
                <input
                  type="text"
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500"
                  placeholder={form.authType === 'basic' ? 'you@company.com' : ''}
                  disabled={form.authType === 'pat'}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">API Token / PAT *</label>
                <input
                  type="password"
                  value={form.apiToken}
                  onChange={(e) => setForm({ ...form, apiToken: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500"
                  placeholder={settings?.hasApiToken ? '已保存（重新输入可更新）' : '自建 Jira: PAT；Cloud: API Token'}
                />
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">最大拉取数量</label>
              <input
                type="number"
                value={form.maxResults}
                onChange={(e) => setForm({ ...form, maxResults: parseInt(e.target.value) || 50 })}
                className="w-full px-3 py-2 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500"
                min="1"
                max="500"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">JQL 过滤条件</label>
            <input
              type="text"
              value={form.jql}
              onChange={(e) => setForm({ ...form, jql: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 font-mono text-sm"
            />
            <p className="text-xs text-gray-400 mt-1">默认：assignee = currentUser() 的未解决任务</p>
          </div>

          <div className="flex gap-3">
            <button onClick={save} className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700">
              保存设置
            </button>
            <button
              onClick={test}
              disabled={testing}
              className="px-4 py-2 bg-gray-100 text-gray-700 rounded hover:bg-gray-200 disabled:opacity-50"
            >
              {testing ? '测试中...' : '测试连接'}
            </button>
            <button
              onClick={sync}
              disabled={syncing || !settings?.configured}
              className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 disabled:opacity-50"
            >
              {syncing ? '同步中...' : '立即同步'}
            </button>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow">
        <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
          <h3 className="text-sm font-medium text-gray-700">已同步任务（{tasks.length}）</h3>
          <span className="text-xs text-gray-400">每天 9:30 自动同步</span>
        </div>
        {tasks.length === 0 ? (
          <div className="p-6 text-center text-sm text-gray-400">
            {loading ? '加载中...' : '暂无同步任务，配置后点击「立即同步」'}
          </div>
        ) : (
          <div className="divide-y divide-gray-50 max-h-96 overflow-auto">
            {tasks.map((t) => (
              <div key={t.id} className="px-4 py-3 flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <a
                      href={t.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-sm font-mono text-blue-600 hover:text-blue-800"
                    >
                      {t.jira_key}
                    </a>
                    {t.priority && (
                      <span className="text-xs text-gray-400">[{t.priority}]</span>
                    )}
                    <span className="text-xs text-gray-400">
                      同步于 {new Date(t.synced_at).toLocaleString('zh-CN')}
                    </span>
                  </div>
                  <div className="text-sm text-gray-700 mt-0.5">{t.summary}</div>
                </div>
                <div className="shrink-0">{statusBadge(t.status)}</div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
