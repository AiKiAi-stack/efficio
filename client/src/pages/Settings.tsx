import { useState, useEffect } from 'react';

interface Provider {
  key: string;
  name: string;
  docs: string;
  isConfigured: boolean;
  isCurrent: boolean;
  currentModel?: string;
}

interface ProviderConfig {
  apiKey: string;
  apiEndpoint: string;
  model: string;
}

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001/api';

export default function Settings() {
  const [providers, setProviders] = useState<Provider[]>([]);
  const [currentProvider, setCurrentProvider] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [testingProvider, setTestingProvider] = useState<string | null>(null);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);

  // 编辑状态
  const [editingProvider, setEditingProvider] = useState<string | null>(null);
  const [config, setConfig] = useState<ProviderConfig>({
    apiKey: '',
    apiEndpoint: '',
    model: ''
  });

  useEffect(() => {
    loadProviders();
  }, []);

  const loadProviders = async () => {
    try {
      const res = await fetch(`${API_URL}/settings/ai-providers`);
      const data = await res.json();
      if (data.data) {
        setProviders(data.data.providers);
        setCurrentProvider(data.data.currentProvider);
      }
    } catch (error) {
      console.error('Failed to load providers:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleTestConnection = async (providerKey: string) => {
    setTestingProvider(providerKey);
    setTestResult(null);

    try {
      const provider = providers.find(p => p.key === providerKey);
      const res = await fetch(`${API_URL}/settings/ai-providers/${providerKey}/test`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          apiKey: process.env[provider?.key === 'anthropic' ? 'ANTHROPIC_API_KEY' :
                              provider?.key === 'openai' ? 'OPENAI_API_KEY' :
                              provider?.key === 'deepseek' ? 'DEEPSEEK_API_KEY' :
                              provider?.key === 'zhipu' ? 'ZHIPU_API_KEY' :
                              'KIMI_API_KEY'] || '',
          apiEndpoint: provider?.key === 'deepseek' ? 'https://api.deepseek.com/v1' :
                       provider?.key === 'zhipu' ? 'https://open.bigmodel.cn/api/paas/v4' :
                       provider?.key === 'kimi' ? 'https://api.moonshot.cn/v1' : undefined
        })
      });

      const data = await res.json();
      setTestResult({
        success: data.success,
        message: data.message
      });
    } catch (error: any) {
      setTestResult({
        success: false,
        message: `测试失败：${error.message}`
      });
    } finally {
      setTestingProvider(null);
    }
  };

  const handleSaveConfig = () => {
    // 提示用户需要在服务器端配置环境变量
    alert(`配置保存提示：

由于安全原因，API Key 需要在服务器端配置。

请编辑服务器端的 .env 文件，添加以下配置：

${editingProvider === 'anthropic' ? 'ANTHROPIC_API_KEY=your_api_key_here' :
  editingProvider === 'openai' ? 'OPENAI_API_KEY=your_api_key_here' :
  editingProvider === 'deepseek' ? 'DEEPSEEK_API_KEY=your_api_key_here' :
  editingProvider === 'zhipu' ? 'ZHIPU_API_KEY=your_api_key_here' :
  'KIMI_API_KEY=your_api_key_here'}

然后重启服务器使配置生效。`);
    setEditingProvider(null);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-gray-500">加载设置中...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-lg font-semibold text-gray-800 mb-4">⚙️ AI Provider 设置</h2>
        <p className="text-sm text-gray-600 mb-6">
          配置 AI Provider 以启用 AI 总结、AI 优化等功能。当前仅支持配置一个 Provider。
        </p>

        {/* Provider 列表 */}
        <div className="space-y-4">
          {providers.map((provider) => (
            <div
              key={provider.key}
              className={`border rounded-lg p-4 transition ${
                provider.isCurrent ? 'border-green-500 bg-green-50' :
                provider.isConfigured ? 'border-blue-200 bg-blue-50' :
                'border-gray-200'
              }`}
            >
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-3">
                  <h3 className="font-medium text-gray-800">{provider.name}</h3>
                  {provider.isCurrent && (
                    <span className="px-2 py-0.5 text-xs bg-green-600 text-white rounded">
                      当前使用
                    </span>
                  )}
                  {provider.isConfigured && !provider.isCurrent && (
                    <span className="px-2 py-0.5 text-xs bg-blue-600 text-white rounded">
                      已配置
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  {!provider.isConfigured && (
                    <button
                      onClick={() => setEditingProvider(provider.key)}
                      className="px-3 py-1 text-sm bg-blue-600 text-white rounded hover:bg-blue-700"
                    >
                      配置
                    </button>
                  )}
                  <a
                    href={provider.docs}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="px-3 py-1 text-sm text-blue-600 hover:text-blue-800"
                  >
                    📄 文档
                  </a>
                </div>
              </div>

              {provider.isConfigured && provider.currentModel && (
                <p className="text-xs text-gray-500 mt-1">
                  当前模型：{provider.currentModel}
                </p>
              )}

              {/* 测试连接按钮 */}
              {provider.isConfigured && (
                <div className="mt-3">
                  <button
                    onClick={() => handleTestConnection(provider.key)}
                    disabled={testingProvider === provider.key}
                    className="px-3 py-1 text-sm bg-gray-100 text-gray-700 rounded hover:bg-gray-200 disabled:opacity-50"
                  >
                    {testingProvider === provider.key ? '测试中...' : '🔌 测试连接'}
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>

        {/* 测试结果显示 */}
        {testResult && (
          <div className={`mt-4 p-3 rounded-lg ${
            testResult.success ? 'bg-green-50 text-green-800' : 'bg-red-50 text-red-800'
          }`}>
            {testResult.success ? '✅' : '❌'} {testResult.message}
          </div>
        )}

        {/* 配置说明 */}
        <div className="mt-6 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
          <h4 className="text-sm font-medium text-yellow-800 mb-2">📝 配置说明</h4>
          <ul className="text-xs text-yellow-700 space-y-1">
            <li>• 编辑服务器根目录的 <code>.env</code> 文件</li>
            <li>• 添加对应的 API Key 环境变量</li>
            <li>• 重启服务器使配置生效</li>
            <li>• 国内用户建议使用 DeepSeek、智谱 AI 或 Kimi</li>
          </ul>
        </div>
      </div>

      {/* 配置表单（弹窗） */}
      {editingProvider && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg shadow-xl p-6 max-w-md w-full">
            <h3 className="text-lg font-semibold mb-4">
              配置 {providers.find(p => p.key === editingProvider)?.name}
            </h3>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  API Key *
                </label>
                <input
                  type="password"
                  value={config.apiKey}
                  onChange={(e) => setConfig({ ...config, apiKey: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500"
                  placeholder="sk-..."
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  API Endpoint
                </label>
                <input
                  type="text"
                  value={config.apiEndpoint}
                  onChange={(e) => setConfig({ ...config, apiEndpoint: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500"
                  placeholder="https://api.xxx.com"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  模型名称
                </label>
                <input
                  type="text"
                  value={config.model}
                  onChange={(e) => setConfig({ ...config, model: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500"
                  placeholder="例如：gpt-4o"
                />
              </div>
            </div>

            <div className="flex gap-3 mt-6">
              <button
                onClick={handleSaveConfig}
                className="flex-1 bg-blue-600 text-white py-2 rounded hover:bg-blue-700"
              >
                查看配置方法
              </button>
              <button
                onClick={() => setEditingProvider(null)}
                className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded"
              >
                取消
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
