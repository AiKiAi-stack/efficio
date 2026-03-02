import { useState, useEffect } from 'react';

interface Provider {
  key: string;
  name: string;
  description: string;
  docs: string;
  isConfigured: boolean;
  isCurrent: boolean;
  currentModel?: string;
  currentEndpoint?: string;
  currentMaxToken?: number;
}

interface ProviderConfig {
  apiKey: string;
  apiEndpoint: string;
  model: string;
  maxToken: number;
}

interface ProviderTemplate {
  defaultEndpoint: string;
  defaultModel: string;
  defaultMaxToken: number;
}

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001/api';

export default function Settings() {
  const [providers, setProviders] = useState<Provider[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedProvider, setSelectedProvider] = useState<string | null>(null);
  const [testingProvider, setTestingProvider] = useState<string | null>(null);
  const [testResults, setTestResults] = useState<Record<string, { success: boolean; message: string }>>({});
  const [providerTemplate, setProviderTemplate] = useState<ProviderTemplate | null>(null);
  const [config, setConfig] = useState<ProviderConfig>({
    apiKey: '',
    apiEndpoint: '',
    model: '',
    maxToken: 4096
  });
  const [saving, setSaving] = useState(false);
  const [activatingProvider, setActivatingProvider] = useState<string | null>(null);

  useEffect(() => {
    loadProviders();
  }, []);

  const loadProviders = async () => {
    try {
      const res = await fetch(`${API_URL}/settings/ai-providers`);
      const data = await res.json();
      if (data.data) {
        setProviders(data.data.providers);
        const current = data.data.providers.find((p: Provider) => p.isCurrent);
        const first = data.data.providers[0];
        setSelectedProvider(current?.key || first?.key);
      }
    } catch (error) {
      console.error('Failed to load providers:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadSelectedProviderDetails = async (providerKey: string) => {
    try {
      const res = await fetch(`${API_URL}/settings/ai-providers/${providerKey}`);
      const data = await res.json();
      if (data.success && data.data) {
        setProviderTemplate(data.data);
        setConfig({
          apiKey: data.data.apiKey || '',
          apiEndpoint: data.data.apiEndpoint || data.data.defaultEndpoint,
          model: data.data.model || data.data.defaultModel,
          maxToken: data.data.maxToken || data.data.defaultMaxToken || 4096
        });
      }
    } catch (error) {
      console.error('Failed to load provider details:', error);
    }
  };

  useEffect(() => {
    if (selectedProvider) {
      loadSelectedProviderDetails(selectedProvider);
    }
  }, [selectedProvider]);

  const handleTestConnection = async (providerKey: string, useFormConfig = false) => {
    const provider = providers.find(p => p.key === providerKey);
    setTestingProvider(providerKey);

    try {
      // 决定使用哪个 endpoint
      const testEndpoint = useFormConfig && config.apiEndpoint?.trim()
        ? config.apiEndpoint.trim()
        : (provider?.currentEndpoint || '');

      // 决定是否发送 apiKey
      // 如果使用表单配置且有输入 apiKey，则发送；否则让后端从保存的配置读取
      const testApiKey = useFormConfig && config.apiKey?.trim()
        ? config.apiKey.trim()
        : undefined;

      const res = await fetch(`${API_URL}/settings/ai-providers/${providerKey}/test`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          apiKey: testApiKey,
          apiEndpoint: testEndpoint || undefined
        })
      });

      const data = await res.json();
      setTestResults(prev => ({
        ...prev,
        [providerKey]: {
          success: data.success,
          message: data.message
        }
      }));
    } catch (error: any) {
      setTestResults(prev => ({
        ...prev,
        [providerKey]: {
          success: false,
          message: '测试失败: ' + error.message
        }
      }));
    } finally {
      setTestingProvider(null);
    }
  };

  const handleSaveConfig = async () => {
    if (!selectedProvider) return;

    if (!config.apiKey.trim()) {
      alert('请输入 API Key');
      return;
    }

    setSaving(true);
    try {
      const res = await fetch(`${API_URL}/settings/ai-providers/${selectedProvider}/config`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(config)
      });

      const data = await res.json();

      if (data.success) {
        alert('配置已保存');
        loadProviders();
      } else {
        alert('错误: ' + data.error);
      }
    } catch (error: any) {
      alert('保存失败: ' + error.message);
    } finally {
      setSaving(false);
    }
  };

  const handleActivateProvider = async (providerKey: string) => {
    setActivatingProvider(providerKey);
    try {
      const res = await fetch(`${API_URL}/settings/ai-providers/${providerKey}/activate`, {
        method: 'POST'
      });

      const data = await res.json();

      if (data.success) {
        alert(data.message);
        loadProviders();
      } else {
        alert('错误: ' + data.error);
      }
    } catch (error: any) {
      alert('激活失败: ' + error.message);
    } finally {
      setActivatingProvider(null);
    }
  };

  const selected = providers.find(p => p.key === selectedProvider);

  const getBorderClass = (provider: Provider) => {
    if (selectedProvider === provider.key) return 'border-blue-500 bg-blue-50';
    if (provider.isCurrent) return 'border-green-500 bg-green-50';
    if (provider.isConfigured) return 'border-gray-200 hover:border-gray-300';
    return 'border-gray-100 hover:border-gray-200';
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
        <h2 className="text-lg font-semibold text-gray-800 mb-4">AI Provider 设置</h2>
        <p className="text-sm text-gray-600 mb-6">
          配置 AI Provider 以启用 AI 总结、AI 优化等功能。
        </p>

        <div className="flex gap-6">
          {/* Left: Provider List */}
          <div className="w-1/3 border-r pr-4">
            <div className="space-y-2">
              {providers.map((provider) => (
                <div
                  key={provider.key}
                  onClick={() => setSelectedProvider(provider.key)}
                  className={'p-3 rounded-lg cursor-pointer transition border-2 ' + getBorderClass(provider)}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-gray-800">{provider.name}</span>
                      {provider.isCurrent && (
                        <span className="px-1.5 py-0.5 text-xs bg-green-600 text-white rounded">当前</span>
                      )}
                    </div>
                    {provider.isConfigured && testResults[provider.key] && (
                      <span
                        className={testResults[provider.key].success ? 'text-green-600' : 'text-red-600'}
                        title={testResults[provider.key].message}
                      >
                        {testResults[provider.key].success ? '✓' : '✗'}
                      </span>
                    )}
                  </div>
                  {provider.isConfigured && provider.currentModel && (
                    <p className="text-xs text-gray-500 mt-1">{provider.currentModel}</p>
                  )}
                </div>
              ))}
            </div>

            <div className="mt-6 p-3 bg-blue-50 rounded-lg">
              <p className="text-xs text-blue-700">点击左侧 Provider 详情进行配置</p>
            </div>
          </div>

          {/* Right: Config Panel */}
          <div className="w-2/3 pl-4">
            {selected ? (
              <div>
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h3 className="text-lg font-semibold text-gray-800">{selected.name}</h3>
                    {selected.description && (
                      <p className="text-sm text-gray-500">{selected.description}</p>
                    )}
                  </div>
                  <a
                    href={selected.docs}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm text-blue-600 hover:text-blue-800"
                  >
                    查看文档
                  </a>
                </div>

                {selected.isConfigured && (
                  <div className="mb-4 p-3 bg-green-50 rounded-lg">
                    <p className="text-sm text-green-800">
                      已配置 | 模型: {selected.currentModel}
                    </p>
                  </div>
                )}

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
                    />
                    <p className="text-xs text-gray-400 mt-1">
                      默认: {providerTemplate?.defaultEndpoint}
                    </p>
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
                    />
                    <p className="text-xs text-gray-400 mt-1">
                      默认: {providerTemplate?.defaultModel}
                    </p>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Max Token
                    </label>
                    <input
                      type="number"
                      value={config.maxToken}
                      onChange={(e) => setConfig({ ...config, maxToken: parseInt(e.target.value) || 4096 })}
                      className="w-full px-3 py-2 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500"
                      min="1"
                      max="128000"
                    />
                    <p className="text-xs text-gray-400 mt-1">
                      默认: {providerTemplate?.defaultMaxToken || 4096}
                    </p>
                  </div>
                </div>

                <div className="flex gap-3 mt-6">
                  <button
                    onClick={handleSaveConfig}
                    disabled={saving}
                    className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
                  >
                    {saving ? '保存中...' : '保存配置'}
                  </button>
                  <button
                    onClick={() => selectedProvider && handleTestConnection(selectedProvider, true)}
                    disabled={testingProvider === selectedProvider || !config.apiKey}
                    className="px-4 py-2 bg-gray-100 text-gray-700 rounded hover:bg-gray-200 disabled:opacity-50"
                  >
                    {testingProvider === selectedProvider ? '测试中...' : '测试连接'}
                  </button>
                  {!selected.isCurrent && selected.isConfigured && (
                    <button
                      onClick={() => selectedProvider && handleActivateProvider(selectedProvider)}
                      disabled={activatingProvider === selectedProvider}
                      className="px-4 py-2 bg-green-100 text-green-700 rounded hover:bg-green-200 disabled:opacity-50"
                    >
                      {activatingProvider === selectedProvider ? '激活中...' : '设为当前'}
                    </button>
                  )}
                </div>

                {selectedProvider && testResults[selectedProvider] && (
                  <div className={testResults[selectedProvider].success ? 'mt-4 p-3 rounded-lg bg-green-50 text-green-800' : 'mt-4 p-3 rounded-lg bg-red-50 text-red-800'}>
                    {testResults[selectedProvider].success ? '✓' : '✗'} {testResults[selectedProvider].message}
                  </div>
                )}
              </div>
            ) : (
              <div className="text-center text-gray-500 py-12">
                请选择左侧的 Provider 进行配置
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}