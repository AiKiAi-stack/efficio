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
  isCustom?: boolean;
  defaultEndpoint?: string;
  defaultModel?: string;
  defaultMaxToken?: number;
  id?: string;
  createdAt?: string;
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

interface CustomProviderForm {
  name: string;
  key: string;
  description: string;
  endpoint: string;
  model: string;
  maxToken: number;
  apiKey: string;
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

  // 自定义 Provider 相关状态
  const [showCustomProviderForm, setShowCustomProviderForm] = useState(false);
  const [customProviderForm, setCustomProviderForm] = useState<CustomProviderForm>({
    name: '',
    key: '',
    description: '',
    endpoint: '',
    model: '',
    maxToken: 4096,
    apiKey: ''
  });
  const [savingCustomProvider, setSavingCustomProvider] = useState(false);
  const [editingCustomProviderId, setEditingCustomProviderId] = useState<string | null>(null);

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

  // 保存自定义 Provider
  const handleSaveCustomProvider = async () => {
    if (!customProviderForm.name || !customProviderForm.key || !customProviderForm.endpoint) {
      alert('请填写必填字段：Provider 名称、标识和 API Endpoint');
      return;
    }

    setSavingCustomProvider(true);
    try {
      const url = editingCustomProviderId
        ? `${API_URL}/settings/custom-providers/${editingCustomProviderId}`
        : `${API_URL}/settings/custom-providers`;

      const method = editingCustomProviderId ? 'PUT' : 'POST';

      const res = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(customProviderForm)
      });

      const data = await res.json();

      if (data.success) {
        alert(editingCustomProviderId ? '自定义 Provider 已更新' : '自定义 Provider 已添加');
        setShowCustomProviderForm(false);
        setCustomProviderForm({
          name: '',
          key: '',
          description: '',
          endpoint: '',
          model: '',
          maxToken: 4096,
          apiKey: ''
        });
        setEditingCustomProviderId(null);
        loadProviders();
      } else {
        alert('错误：' + data.error);
      }
    } catch (error: any) {
      alert('保存失败：' + error.message);
    } finally {
      setSavingCustomProvider(false);
    }
  };

  // 编辑自定义 Provider
  const handleEditCustomProvider = async (provider: Provider) => {
    setCustomProviderForm({
      name: provider.name,
      key: provider.key,
      description: provider.description || '',
      endpoint: provider.currentEndpoint || provider.defaultEndpoint || '',
      model: provider.currentModel || provider.defaultModel || '',
      maxToken: provider.currentMaxToken || provider.defaultMaxToken || 4096,
      apiKey: '' // 不显示已保存的 API Key
    });
    setEditingCustomProviderId(provider.id || null);
    setShowCustomProviderForm(true);
  };

  // 删除自定义 Provider
  const handleDeleteCustomProvider = async (provider: Provider) => {
    if (!confirm(`确定要删除自定义 Provider "${provider.name}" 吗？`)) {
      return;
    }

    try {
      const res = await fetch(`${API_URL}/settings/custom-providers/${provider.id}`, {
        method: 'DELETE'
      });

      const data = await res.json();

      if (data.success) {
        alert('自定义 Provider 已删除');
        loadProviders();
      } else {
        alert('删除失败：' + data.error);
      }
    } catch (error: any) {
      alert('删除失败：' + error.message);
    }
  };

  // 重置自定义 Provider 表单
  const resetCustomProviderForm = () => {
    setCustomProviderForm({
      name: '',
      key: '',
      description: '',
      endpoint: '',
      model: '',
      maxToken: 4096,
      apiKey: ''
    });
    setEditingCustomProviderId(null);
    setShowCustomProviderForm(false);
  };

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
              {/* 添加自定义 Provider 按钮 */}
              <div
                onClick={() => {
                  resetCustomProviderForm();
                  setShowCustomProviderForm(true);
                }}
                className="p-3 rounded-lg cursor-pointer transition border-2 border-dashed border-gray-300 hover:border-blue-400 hover:bg-blue-50"
              >
                <div className="flex items-center justify-center gap-2 text-gray-500 hover:text-blue-600">
                  <span className="text-xl">+</span>
                  <span className="font-medium">添加自定义 Provider</span>
                </div>
              </div>

              {providers.map((provider) => (
                <div
                  key={provider.isCustom ? provider.id : provider.key}
                  onClick={() => setSelectedProvider(provider.key)}
                  className={'p-3 rounded-lg cursor-pointer transition border-2 ' + getBorderClass(provider)}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-gray-800">{provider.name}</span>
                      {provider.isCurrent && (
                        <span className="px-1.5 py-0.5 text-xs bg-green-600 text-white rounded">当前</span>
                      )}
                      {provider.isCustom && (
                        <span className="px-1.5 py-0.5 text-xs bg-purple-100 text-purple-700 rounded">自定义</span>
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
                  {/* 自定义 Provider 的操作按钮 */}
                  {provider.isCustom && (
                    <div className="flex gap-2 mt-2">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleEditCustomProvider(provider);
                        }}
                        className="text-xs text-blue-600 hover:text-blue-800"
                      >
                        编辑
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDeleteCustomProvider(provider);
                        }}
                        className="text-xs text-red-600 hover:text-red-800"
                        disabled={provider.isCurrent}
                      >
                        删除
                      </button>
                    </div>
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
            {/* 自定义 Provider 表单 */}
            {showCustomProviderForm && (
              <div className="mb-6 p-4 border rounded-lg bg-gray-50">
                <h3 className="text-lg font-semibold mb-4">
                  {editingCustomProviderId ? '编辑自定义 Provider' : '添加自定义 Provider'}
                </h3>
                <div className="space-y-3">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Provider 名称 *</label>
                    <input
                      type="text"
                      value={customProviderForm.name}
                      onChange={(e) => setCustomProviderForm({ ...customProviderForm, name: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500"
                      placeholder="例如：我的私有模型"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Provider 标识 *</label>
                    <input
                      type="text"
                      value={customProviderForm.key}
                      onChange={(e) => setCustomProviderForm({ ...customProviderForm, key: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500"
                      placeholder="例如：my-private-model"
                      disabled={!!editingCustomProviderId}
                    />
                    <p className="text-xs text-gray-400 mt-1">只能包含字母、数字、下划线和连字符</p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">描述</label>
                    <input
                      type="text"
                      value={customProviderForm.description}
                      onChange={(e) => setCustomProviderForm({ ...customProviderForm, description: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500"
                      placeholder="例如：公司内部部署的 LLM 服务"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">API Endpoint *</label>
                    <input
                      type="text"
                      value={customProviderForm.endpoint}
                      onChange={(e) => setCustomProviderForm({ ...customProviderForm, endpoint: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500"
                      placeholder="例如：http://localhost:8000/v1"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">模型名称</label>
                      <input
                        type="text"
                        value={customProviderForm.model}
                        onChange={(e) => setCustomProviderForm({ ...customProviderForm, model: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500"
                        placeholder="例如：default"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Max Token</label>
                      <input
                        type="number"
                        value={customProviderForm.maxToken}
                        onChange={(e) => setCustomProviderForm({ ...customProviderForm, maxToken: parseInt(e.target.value) || 4096 })}
                        className="w-full px-3 py-2 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500"
                        min="1"
                        max="128000"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">API Key</label>
                    <input
                      type="password"
                      value={customProviderForm.apiKey}
                      onChange={(e) => setCustomProviderForm({ ...customProviderForm, apiKey: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500"
                      placeholder="sk-..."
                    />
                  </div>
                </div>
                <div className="flex gap-3 mt-4">
                  <button
                    onClick={handleSaveCustomProvider}
                    disabled={savingCustomProvider}
                    className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
                  >
                    {savingCustomProvider ? '保存中...' : (editingCustomProviderId ? '更新' : '添加')}
                  </button>
                  <button
                    onClick={resetCustomProviderForm}
                    className="px-4 py-2 bg-gray-200 text-gray-700 rounded hover:bg-gray-300"
                  >
                    取消
                  </button>
                </div>
              </div>
            )}

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