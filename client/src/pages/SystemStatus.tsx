import { useState, useEffect } from 'react';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001/api';

interface SystemStatus {
  version: string;
  database: { mode: string; connected: boolean };
  ai: { configured: boolean; provider: string; model: string | null };
  recentErrorCount: number;
}

interface RecentError {
  time: string;
  level: string;
  message: string;
  requestId?: string;
  path?: string;
}

export default function SystemStatus() {
  const [status, setStatus] = useState<SystemStatus | null>(null);
  const [errors, setErrors] = useState<RecentError[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadAll = async () => {
    setLoading(true);
    setError(null);
    try {
      const [statusRes, errorsRes] = await Promise.all([
        fetch(`${API_URL}/system/status`),
        fetch(`${API_URL}/system/recent-errors?limit=30`)
      ]);
      const statusData = await statusRes.json();
      const errorsData = await errorsRes.json();
      if (statusData.success) setStatus(statusData.data);
      if (errorsData.success) setErrors(errorsData.data || []);
    } catch (e) {
      setError('无法获取系统状态，请检查服务器连接');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAll();
  }, []);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-gray-800">🩺 系统状态</h2>
        <button onClick={loadAll} className="text-sm text-blue-600 hover:text-blue-800">
          🔄 刷新
        </button>
      </div>

      {loading && <div className="text-gray-500 text-sm">加载中...</div>}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-700">
          ⚠️ {error}
        </div>
      )}

      {status && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-white rounded-lg shadow p-4">
            <div className="text-sm text-gray-500">版本</div>
            <div className="text-xl font-bold text-gray-800">{status.version}</div>
          </div>
          <div className="bg-white rounded-lg shadow p-4">
            <div className="text-sm text-gray-500">数据库</div>
            <div className="text-xl font-bold text-gray-800">
              {status.database.connected ? '✅' : '❌'} {status.database.mode}
            </div>
            {!status.database.connected && (
              <div className="text-xs text-red-600 mt-1">数据库连接异常，数据可能无法持久化</div>
            )}
          </div>
          <div className="bg-white rounded-lg shadow p-4">
            <div className="text-sm text-gray-500">AI 服务</div>
            <div className="text-xl font-bold text-gray-800">
              {status.ai.configured ? '✅' : '⚠️'} {status.ai.provider}
            </div>
            {status.ai.model && <div className="text-xs text-gray-500 mt-1">模型: {status.ai.model}</div>}
            {!status.ai.configured && (
              <div className="text-xs text-amber-600 mt-1">
                未配置 API Key，AI 功能不可用，请到「设置」页配置
              </div>
            )}
          </div>
        </div>
      )}

      <div className="bg-white rounded-lg shadow">
        <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
          <h3 className="text-sm font-medium text-gray-700">最近错误（{errors.length}）</h3>
          <span className="text-xs text-gray-400">完整日志：~/.config/efficio/logs/efficio.log</span>
        </div>
        {errors.length === 0 ? (
          <div className="p-6 text-center text-sm text-gray-400">
            {!loading && '🎉 暂无错误记录'}
          </div>
        ) : (
          <div className="divide-y divide-gray-50 max-h-96 overflow-auto">
            {errors.map((e, i) => (
              <div key={i} className="px-4 py-3">
                <div className="flex items-center gap-2 text-xs flex-wrap">
                  <span
                    className={`px-1.5 py-0.5 rounded ${
                      e.level === 'error'
                        ? 'bg-red-100 text-red-700'
                        : 'bg-amber-100 text-amber-700'
                    }`}
                  >
                    {e.level.toUpperCase()}
                  </span>
                  <span className="text-gray-400">{new Date(e.time).toLocaleString('zh-CN')}</span>
                  {e.path && <span className="text-gray-400">· {e.path}</span>}
                  {e.requestId && (
                    <span className="text-gray-300 font-mono">req={e.requestId.slice(0, 8)}</span>
                  )}
                </div>
                <div className="text-sm text-gray-700 mt-1 break-all">{e.message}</div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
