import { useState, useEffect } from 'react';
import { login, getRecords, createRecord, optimizeText, WorkRecord } from './api';
import Dashboard from './pages/Dashboard';

const enum Tab {
  RECORDS = 'records',
  DASHBOARD = 'dashboard'
}

function App() {
  const [user, setUser] = useState<{ id: string; email: string } | null>(null);
  const [email, setEmail] = useState('');
  const [inputText, setInputText] = useState('');
  const [optimizedText, setOptimizedText] = useState('');
  const [records, setRecords] = useState<WorkRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [optimizing, setOptimizing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [showAnalysis, setShowAnalysis] = useState(false);
  const [activeTab, setActiveTab] = useState<Tab>(Tab.RECORDS);

  // 检查本地存储的 session
  useEffect(() => {
    const savedUser = localStorage.getItem('user');
    const savedToken = localStorage.getItem('sessionToken');
    if (savedUser && savedToken) {
      setUser(JSON.parse(savedUser));
      loadRecords(savedToken);
    }
  }, []);

  const loadRecords = async (token: string) => {
    const result = await getRecords(token);
    if (result.success && result.data) {
      setRecords(result.data);
    }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    const result = await login(email);
    if (result.success && result.data) {
      const { user, session_token } = result.data;
      setUser(user);
      localStorage.setItem('user', JSON.stringify(user));
      localStorage.setItem('sessionToken', session_token);
      loadRecords(session_token);
    } else {
      setError(result.error || '登录失败');
    }

    setLoading(false);
  };

  const handleOptimize = async () => {
    if (!inputText.trim()) return;

    setOptimizing(true);
    setError('');

    const result = await optimizeText(inputText);
    if (result.success && result.data) {
      setOptimizedText(result.data.optimized);
    } else {
      setError(result.error || '优化失败');
    }

    setOptimizing(false);
  };

  const handleSave = async () => {
    const token = localStorage.getItem('sessionToken');
    if (!token || !inputText.trim()) return;

    setSaving(true);
    setError('');

    const result = await createRecord(token, inputText, optimizedText || undefined);
    if (result.success && result.data) {
      setRecords([result.data, ...records]);
      setInputText('');
      setOptimizedText('');
      setShowAnalysis(false);
    } else {
      setError(result.error || '保存失败');
    }

    setSaving(false);
  };

  const handleLogout = () => {
    localStorage.removeItem('user');
    localStorage.removeItem('sessionToken');
    setUser(null);
    setRecords([]);
    setInputText('');
    setOptimizedText('');
  };

  if (!user) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-white rounded-lg shadow-lg p-8">
          <h1 className="text-2xl font-bold text-center text-gray-800 mb-2">
            效率追踪器
          </h1>
          <p className="text-center text-gray-500 mb-8">
            记录工作 · AI 优化 · 效率分析
          </p>

          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                邮箱
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="your@email.com"
                required
              />
            </div>

            {error && (
              <div className="text-red-500 text-sm text-center">{error}</div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-blue-600 text-white py-2 rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition"
            >
              {loading ? '登录中...' : '登录'}
            </button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow">
        <div className="max-w-5xl mx-auto px-4 py-4 flex justify-between items-center">
          <h1 className="text-xl font-bold text-gray-800">效率追踪器</h1>
          <div className="flex items-center gap-4">
            <nav className="flex gap-2">
              <button
                onClick={() => setActiveTab(Tab.RECORDS)}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition ${
                  activeTab === Tab.RECORDS
                    ? 'bg-blue-100 text-blue-700'
                    : 'text-gray-600 hover:bg-gray-100'
                }`}
              >
                📝 记录
              </button>
              <button
                onClick={() => setActiveTab(Tab.DASHBOARD)}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition ${
                  activeTab === Tab.DASHBOARD
                    ? 'bg-blue-100 text-blue-700'
                    : 'text-gray-600 hover:bg-gray-100'
                }`}
              >
                📊 仪表板
              </button>
            </nav>
            <span className="text-sm text-gray-600">{user.email}</span>
            <button
              onClick={handleLogout}
              className="text-sm text-red-600 hover:text-red-700"
            >
              退出
            </button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-5xl mx-auto px-4 py-8">
        {activeTab === Tab.DASHBOARD ? (
          <Dashboard />
        ) : (
          <>
            {/* Input Section */}
            <div className="bg-white rounded-lg shadow p-6">
              <h2 className="text-lg font-semibold text-gray-800 mb-4">
                记录今日工作
              </h2>

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                工作内容
              </label>
              <textarea
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
                rows={4}
                placeholder="今天做了什么？简单描述即可..."
              />
            </div>

            {optimizedText && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  AI 优化结果
                </label>
                <div className="w-full px-4 py-2 bg-gray-50 border border-gray-200 rounded-lg text-gray-800">
                  {optimizedText}
                </div>
              </div>
            )}

            <div className="flex gap-3">
              <button
                onClick={handleOptimize}
                disabled={optimizing || !inputText.trim()}
                className="px-6 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed transition"
              >
                {optimizing ? '优化中...' : 'AI 优化'}
              </button>
              <button
                onClick={handleSave}
                disabled={saving || !inputText.trim()}
                className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition"
              >
                {saving ? '保存中...' : '保存'}
              </button>
            </div>

            {error && (
              <div className="text-red-500 text-sm">{error}</div>
            )}
          </div>
        </div>

        {/* Records List */}
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-lg font-semibold text-gray-800 mb-4">
            历史记录
          </h2>

          {records.length === 0 ? (
            <p className="text-gray-500 text-center py-8">暂无记录</p>
          ) : (
            <div className="space-y-4">
              {records.map((record) => (
                <div
                  key={record.id}
                  className="border border-gray-200 rounded-lg p-4"
                >
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-sm text-gray-500">
                      {new Date(record.created_at).toLocaleString('zh-CN')}
                    </span>
                    {record.structured_data && (
                      <>
                        <span className={`px-2 py-0.5 text-xs rounded ${
                          record.structured_data.value_level === 'high' ? 'bg-green-100 text-green-700' :
                          record.structured_data.value_level === 'medium' ? 'bg-yellow-100 text-yellow-700' :
                          'bg-gray-100 text-gray-700'
                        }`}>
                          {record.structured_data.value_level === 'high' ? '高价值' :
                           record.structured_data.value_level === 'medium' ? '中价值' : '一般'}
                        </span>
                        <span className="px-2 py-0.5 text-xs rounded bg-blue-100 text-blue-700">
                          {record.structured_data.time_spent}
                        </span>
                        <span className="px-2 py-0.5 text-xs rounded bg-purple-100 text-purple-700">
                          {record.structured_data.task_category === 'development' ? '开发' :
                           record.structured_data.task_category === 'meeting' ? '会议' :
                           record.structured_data.task_category === 'communication' ? '沟通' :
                           record.structured_data.task_category === 'documentation' ? '文档' :
                           record.structured_data.task_category === 'review' ? '评审' :
                           record.structured_data.task_category === 'learning' ? '学习' : '其他'}
                        </span>
                        {record.structured_data.is_deep_work && (
                          <span className="px-2 py-0.5 text-xs rounded bg-indigo-100 text-indigo-700">
                            深度工作
                          </span>
                        )}
                      </>
                    )}
                  </div>
                  <div className="space-y-2">
                    <div>
                      <span className="text-xs font-medium text-gray-500">原始记录：</span>
                      <p className="text-gray-700">{record.original_text}</p>
                    </div>
                    {record.optimized_text && (
                      <div>
                        <span className="text-xs font-medium text-purple-500">优化后：</span>
                        <p className="text-gray-800">{record.optimized_text}</p>
                      </div>
                    )}
                    {record.structured_data && record.structured_data.tags && (
                      <div className="flex flex-wrap gap-1 pt-2">
                        {record.structured_data.tags.map((tag: string, i: number) => (
                          <span
                            key={i}
                            className="px-2 py-0.5 text-xs rounded bg-gray-100 text-gray-600"
                          >
                            #{tag}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
          </>
        )}
      </main>
    </div>
  );
}

export default App;
