import { useState, useEffect } from 'react';
import { login, getRecords, createRecord, optimizeText, WorkRecord } from './api';

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
      <main className="max-w-5xl mx-auto px-4 py-8 space-y-8">
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
                  <div className="text-sm text-gray-500 mb-2">
                    {new Date(record.created_at).toLocaleString('zh-CN')}
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
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}

export default App;
