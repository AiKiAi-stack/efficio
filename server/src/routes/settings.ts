import { Router } from 'express';
import {
  getProviderTemplate,
  getAllProviderTemplates,
  getCustomProviders,
  getCustomProviderById,
  saveCustomProvider,
  deleteCustomProvider,
  getCustomProviderByKey,
  getAllProviders,
  validateProviderConfig
} from '../lib/ai-providers';
import { updateProviderConfig, configManager } from '../lib/config-manager';

export const settingsRouter = Router();

// 获取所有 AI Provider 配置（包括预定义和自定义）
settingsRouter.get('/ai-providers', (req, res) => {
  try {
    const allProviders = getAllProviders();
    const config = configManager.read();
    const aiProvider = config.AI_PROVIDER || process.env.AI_PROVIDER || 'anthropic';

    // 返回所有 provider 的配置信息和当前配置状态
    const providers = allProviders.map((provider) => {
      const upperKey = provider.key.toUpperCase();
      const apiKey = config[`${upperKey}_API_KEY`] || process.env[`${upperKey}_API_KEY`];
      const endpoint = config[`${upperKey}_ENDPOINT`] || provider.defaultEndpoint;
      const model = config[`${upperKey}_MODEL`] || provider.defaultModel;
      const maxToken = config[`${upperKey}_MAX_TOKENS`] || provider.defaultMaxToken.toString();
      const isCustom = 'isCustom' in provider && provider.isCustom;

      return {
        key: provider.key,
        name: provider.name,
        docs: provider.docs,
        description: provider.description,
        isConfigured: !!apiKey && apiKey.trim() !== '',
        isCurrent: aiProvider === provider.key,
        currentModel: model,
        currentEndpoint: endpoint,
        currentMaxToken: parseInt(maxToken, 10),
        isCustom,
        defaultEndpoint: provider.defaultEndpoint,
        defaultModel: provider.defaultModel,
        defaultMaxToken: provider.defaultMaxToken
      };
    });

    res.json({
      success: true,
      data: {
        providers,
        currentProvider: aiProvider
      }
    });
  } catch (error) {
    console.error('Get AI providers error:', error);
    res.status(500).json({
      success: false,
      error: '获取 AI Provider 配置失败'
    });
  }
});

// 获取单个 Provider 模板详情（支持预定义和自定义）
settingsRouter.get('/ai-providers/:provider', (req, res) => {
  try {
    const { provider } = req.params;

    // 先尝试查找预定义 Provider
    let providerData = getProviderTemplate(provider);
    let isCustom = false;

    // 如果预定义中不存在，尝试查找自定义 Provider
    if (!providerData) {
      const customProvider = getCustomProviderByKey(provider);
      if (customProvider) {
        providerData = customProvider;
        isCustom = true;
      }
    }

    if (!providerData) {
      return res.status(404).json({
        success: false,
        error: 'Provider 不存在'
      });
    }

    // 读取当前配置
    const config = configManager.read();
    const upperProvider = provider.toUpperCase();

    res.json({
      success: true,
      data: {
        ...providerData,
        isCustom,
        apiKey: config[`${upperProvider}_API_KEY`] || '',
        apiEndpoint: config[`${upperProvider}_ENDPOINT`] || providerData.defaultEndpoint,
        model: config[`${upperProvider}_MODEL`] || providerData.defaultModel,
        maxToken: parseInt(config[`${upperProvider}_MAX_TOKENS`] || providerData.defaultMaxToken.toString(), 10)
      }
    });
  } catch (error) {
    console.error('Get provider error:', error);
    res.status(500).json({
      success: false,
      error: '获取 Provider 详情失败'
    });
  }
});

// 保存 Provider 配置（支持预定义和自定义）
settingsRouter.post('/ai-providers/:provider/config', async (req, res) => {
  try {
    const { provider } = req.params;
    const { apiKey, apiEndpoint, model, maxToken } = req.body;

    // 验证 provider 是否存在（包括预定义和自定义）
    let template = getProviderTemplate(provider);
    let isCustom = false;

    if (!template) {
      const customProvider = getCustomProviderByKey(provider);
      if (customProvider) {
        template = customProvider;
        isCustom = true;
      }
    }

    if (!template) {
      return res.status(404).json({
        success: false,
        error: 'Provider 不存在'
      });
    }

    // 验证必填字段
    if (!apiKey || apiKey.trim() === '') {
      return res.status(400).json({
        success: false,
        error: 'API Key 不能为空'
      });
    }

    // 验证配置
    const validation = validateProviderConfig({
      provider,
      apiKey: apiKey.trim(),
      apiEndpoint: apiEndpoint?.trim() || template.defaultEndpoint,
      model: model?.trim() || template.defaultModel,
      maxToken: maxToken ? parseInt(maxToken, 10) : template.defaultMaxToken
    }, isCustom);

    if (!validation.valid) {
      return res.status(400).json({
        success: false,
        error: validation.errors.join(', ')
      });
    }

    // 更新配置
    const result = await updateProviderConfig(provider, {
      apiKey: apiKey.trim(),
      apiEndpoint: apiEndpoint?.trim() || undefined,
      model: model?.trim() || undefined,
      maxToken: maxToken ? parseInt(maxToken, 10) : undefined
    });

    if (!result.success) {
      return res.status(500).json({
        success: false,
        error: result.error || '保存配置失败'
      });
    }

    res.json({
      success: true,
      message: '配置已保存。如需启用，请重启服务器或设置为当前 Provider。'
    });
  } catch (error) {
    console.error('Save provider config error:', error);
    res.status(500).json({
      success: false,
      error: '保存配置失败'
    });
  }
});

// 设置当前使用的 Provider
settingsRouter.post('/ai-providers/:provider/activate', async (req, res) => {
  try {
    const { provider } = req.params;

    // 验证 provider 是否存在（包括预定义和自定义）
    const template = getProviderTemplate(provider);
    const customProvider = template ? null : getCustomProviderByKey(provider);

    if (!template && !customProvider) {
      return res.status(404).json({
        success: false,
        error: 'Provider 不存在'
      });
    }

    const effectiveProvider = template || customProvider;
    const isCustom = !!customProvider;

    // 检查是否已配置
    const config = configManager.read();
    const upperProvider = provider.toUpperCase();
    const apiKey = config[`${upperProvider}_API_KEY`];

    if (!apiKey || apiKey.trim() === '') {
      return res.status(400).json({
        success: false,
        error: '该 Provider 尚未配置 API Key'
      });
    }

    // 设置为当前 Provider
    configManager.set('AI_PROVIDER', provider);
    process.env.AI_PROVIDER = provider;

    res.json({
      success: true,
      message: `已将 ${effectiveProvider.name} ${isCustom ? '(自定义)' : ''}设为当前 Provider`
    });
  } catch (error) {
    console.error('Activate provider error:', error);
    res.status(500).json({
      success: false,
      error: '激活 Provider 失败'
    });
  }
});

// 测试 AI Provider 连接（支持自定义 Provider）
settingsRouter.post('/ai-providers/:provider/test', async (req, res) => {
  try {
    const { provider } = req.params;
    let { apiKey, apiEndpoint } = req.body;

    // 检查是否是自定义 Provider
    const customProvider = getCustomProviderByKey(provider);
    const isCustom = !!customProvider;

    // 如果没有提供 apiKey 或 apiKey 为空/空白，从保存的配置中读取
    if (!apiKey || apiKey.trim() === '' || apiKey === '***configured***') {
      const config = configManager.read();
      const upperProvider = provider.toUpperCase();
      const savedApiKey = config[`${upperProvider}_API_KEY`] || process.env[`${upperProvider}_API_KEY`];
      if (savedApiKey && savedApiKey.trim() !== '') {
        apiKey = savedApiKey.trim();
      }
    } else {
      // 使用前端传递的 apiKey，去除首尾空格
      apiKey = apiKey.trim();
    }

    // vLLM 和自定义 Provider 可以不要求 API Key
    if (!apiKey && provider !== 'vllm' && !isCustom) {
      return res.status(400).json({
        success: false,
        error: 'API Key 未配置，请先保存配置'
      });
    }

    // 如果没有提供 endpoint 或 endpoint 为空，从保存的配置或默认值中获取
    if (!apiEndpoint || apiEndpoint.trim() === '') {
      const config = configManager.read();
      const upperProvider = provider.toUpperCase();
      const savedEndpoint = config[`${upperProvider}_ENDPOINT`] || process.env[`${upperProvider}_ENDPOINT`];

      if (savedEndpoint && savedEndpoint.trim() !== '') {
        apiEndpoint = savedEndpoint.trim();
      } else if (customProvider) {
        apiEndpoint = customProvider.defaultEndpoint;
      }
    } else {
      apiEndpoint = apiEndpoint.trim();
    }

    // 清除配置缓存，确保下次读取最新数据
    configManager.clearCache();

    let testResult: { success: boolean; message: string };

    // Anthropic Provider
    if (provider === 'anthropic') {
      const Anthropic = (await import('@anthropic-ai/sdk')).default;
      const client = new Anthropic({ apiKey });
      try {
        await client.messages.create({
          model: 'claude-sonnet-4-6',
          max_tokens: 10,
          messages: [{ role: 'user', content: 'Hello' }]
        });
        testResult = { success: true, message: 'Anthropic API 连接成功' };
      } catch (error: any) {
        testResult = { success: false, message: `连接失败：${error.message}` };
      }
    }
    // 自定义 Provider（使用 OpenAI 兼容格式）
    else if (isCustom) {
      try {
        const { OpenAI } = await import('openai');
        const client = new OpenAI({
          apiKey: apiKey || 'custom',
          baseURL: apiEndpoint
        });
        await client.models.list();
        testResult = {
          success: true,
          message: `${customProvider?.name || '自定义 Provider'} API 连接成功`
        };
      } catch (error: any) {
        if (error.code === 'MODULE_NOT_FOUND') {
          testResult = {
            success: false,
            message: '未安装 openai 包，请运行：npm install openai'
          };
        } else if (error.message?.includes('connect') || error.message?.includes('ECONNREFUSED')) {
          testResult = {
            success: false,
            message: '无法连接到 API 服务，请确认端点 URL 正确且服务已启动'
          };
        } else {
          testResult = { success: false, message: `连接失败：${error.message}` };
        }
      }
    }
    // OpenAI 兼容 Provider（包括 OpenAI、DeepSeek、Zhipu、Kimi、Nvidia、Aliyun、Volcengine、Minimax、OpenRouter、vLLM）
    else {
      try {
        const { OpenAI } = await import('openai');
        const endpoint = apiEndpoint ||
          (provider === 'deepseek' ? 'https://api.deepseek.com/v1' :
           provider === 'zhipu' ? 'https://open.bigmodel.cn/api/paas/v4' :
           provider === 'kimi' ? 'https://api.moonshot.cn/v1' :
           provider === 'nvidia' ? 'https://integrate.api.nvidia.com/v1' :
           provider === 'aliyun' ? 'https://dashscope.aliyuncs.com/compatible-mode/v1' :
           provider === 'volcengine' ? 'https://ark.cn-beijing.volces.com/api/v3' :
           provider === 'minimax' ? 'https://api.minimaxi.com/v1' :
           provider === 'openrouter' ? 'https://openrouter.ai/api/v1' :
           'https://api.openai.com/v1');

        const client = new OpenAI({ apiKey, baseURL: endpoint });
        await client.models.list();
        testResult = { success: true, message: `${getProviderName(provider)} API 连接成功` };
      } catch (error: any) {
        if (error.code === 'MODULE_NOT_FOUND') {
          testResult = { success: false, message: '未安装 openai 包，请运行：npm install openai' };
        } else {
          testResult = { success: false, message: `连接失败：${error.message}` };
        }
      }
    }

    res.json({
      success: testResult.success,
      message: testResult.message
    });
  } catch (error: any) {
    console.error('Test AI provider error:', error);
    res.json({
      success: false,
      message: `测试失败：${error.message}`
    });
  }
});

// 辅助函数：获取 Provider 中文名称
function getProviderName(key: string): string {
  const names: Record<string, string> = {
    openai: 'OpenAI',
    deepseek: 'DeepSeek',
    zhipu: '智谱 AI',
    kimi: 'Kimi',
    nvidia: 'NVIDIA',
    aliyun: '阿里云',
    volcengine: '火山引擎',
    minimax: 'MiniMax',
    openrouter: 'OpenRouter'
  };
  return names[key] || key;
}

// 获取环境变量配置（仅用于前端设置页面）
settingsRouter.get('/env-keys', (req, res) => {
  try {
    const templates = getAllProviderTemplates();
    const keys: Record<string, string | undefined> = {};

    // 返回已配置的环境变量名称（不返回实际值）
    templates.forEach((value) => {
      keys[value.envVarKey] = process.env[value.envVarKey] ? '***configured***' : undefined;
    });

    res.json({
      success: true,
      data: {
        keys,
        envKeys: templates.map(t => t.envVarKey)
      }
    });
  } catch (error) {
    console.error('Get env keys error:', error);
    res.status(500).json({
      success: false,
      error: '获取配置失败'
    });
  }
});

// ============================================
// 自定义 Provider API 路由
// ============================================

// 获取所有自定义 Provider
settingsRouter.get('/custom-providers', (req, res) => {
  try {
    const customProviders = getCustomProviders();
    const config = configManager.read();

    // 返回自定义 Provider 列表及配置状态
    const providers = customProviders.map((provider) => {
      const upperKey = provider.key.toUpperCase();
      const apiKey = config[`${upperKey}_API_KEY`] || process.env[`${upperKey}_API_KEY`];

      return {
        ...provider,
        isConfigured: !!apiKey && apiKey.trim() !== '',
        currentModel: config[`${upperKey}_MODEL`] || provider.defaultModel,
        currentEndpoint: config[`${upperKey}_ENDPOINT`] || provider.defaultEndpoint,
        currentMaxToken: parseInt(config[`${upperKey}_MAX_TOKENS`] || provider.defaultMaxToken.toString(), 10)
      };
    });

    res.json({
      success: true,
      data: providers
    });
  } catch (error) {
    console.error('Get custom providers error:', error);
    res.status(500).json({
      success: false,
      error: '获取自定义 Provider 失败'
    });
  }
});

// 创建自定义 Provider
settingsRouter.post('/custom-providers', async (req, res) => {
  try {
    const { name, key, description, endpoint, model, maxToken, apiKey } = req.body;

    // 验证必填字段
    if (!name || !key || !endpoint) {
      return res.status(400).json({
        success: false,
        error: 'Provider 名称、标识和 API Endpoint 为必填字段'
      });
    }

    // 验证 key 格式（只能是字母、数字、下划线、连字符）
    if (!/^[a-zA-Z0-9_-]+$/.test(key)) {
      return res.status(400).json({
        success: false,
        error: 'Provider 标识只能包含字母、数字、下划线和连字符'
      });
    }

    // 验证是否与现有 Provider key 冲突
    const existingProvider = getProviderTemplate(key) || getCustomProviderByKey(key);
    if (existingProvider) {
      return res.status(400).json({
        success: false,
        error: `Provider 标识 '${key}' 已存在`
      });
    }

    // 验证 URL 格式
    try {
      new URL(endpoint);
    } catch {
      return res.status(400).json({
        success: false,
        error: 'API Endpoint 必须是有效的 URL'
      });
    }

    // 生成唯一 ID
    const id = `custom_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;

    // 创建自定义 Provider
    const customProvider: import('../lib/ai-providers').CustomProvider = {
      id,
      key: key.toLowerCase(),
      name,
      description: description || '用户自定义 OpenAI 兼容 Provider',
      docs: '',
      envVarKey: `${key.toUpperCase()}_API_KEY`,
      defaultEndpoint: endpoint,
      defaultModel: model || 'default',
      maxTokenKey: `${key.toUpperCase()}_MAX_TOKENS`,
      defaultMaxToken: maxToken || 4096,
      isCustom: true,
      createdAt: new Date().toISOString()
    };

    // 保存 Provider
    const result = saveCustomProvider(customProvider);
    if (!result.success) {
      return res.status(500).json({
        success: false,
        error: result.error
      });
    }

    // 如果提供了 API Key，同时保存配置
    if (apiKey && apiKey.trim()) {
      await updateProviderConfig(customProvider.key, {
        apiKey: apiKey.trim(),
        apiEndpoint: endpoint,
        model: model || 'default',
        maxToken: maxToken || 4096
      });
    }

    res.status(201).json({
      success: true,
      data: customProvider,
      message: '自定义 Provider 已添加'
    });
  } catch (error) {
    console.error('Create custom provider error:', error);
    res.status(500).json({
      success: false,
      error: '创建自定义 Provider 失败'
    });
  }
});

// 更新自定义 Provider
settingsRouter.put('/custom-providers/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { name, key, description, endpoint, model, maxToken } = req.body;

    // 检查 Provider 是否存在
    const existingProvider = getCustomProviderById(id);
    if (!existingProvider) {
      return res.status(404).json({
        success: false,
        error: '自定义 Provider 不存在'
      });
    }

    // 验证 key 格式（如果修改了）
    if (key && key !== existingProvider.key) {
      if (!/^[a-zA-Z0-9_-]+$/.test(key)) {
        return res.status(400).json({
          success: false,
          error: 'Provider 标识只能包含字母、数字、下划线和连字符'
        });
      }

      // 检查新 key 是否与现有 Provider 冲突
      const conflict = getProviderTemplate(key) || getCustomProviderByKey(key);
      if (conflict && (conflict as any).id !== id) {
        return res.status(400).json({
          success: false,
          error: `Provider 标识 '${key}' 已存在`
        });
      }
    }

    // 验证 URL 格式（如果修改了）
    if (endpoint) {
      try {
        new URL(endpoint);
      } catch {
        return res.status(400).json({
          success: false,
          error: 'API Endpoint 必须是有效的 URL'
        });
      }
    }

    // 更新 Provider
    const updatedProvider: import('../lib/ai-providers').CustomProvider = {
      ...existingProvider,
      name: name || existingProvider.name,
      key: (key || existingProvider.key).toLowerCase(),
      description: description || existingProvider.description,
      defaultEndpoint: endpoint || existingProvider.defaultEndpoint,
      defaultModel: model || existingProvider.defaultModel,
      defaultMaxToken: maxToken || existingProvider.defaultMaxToken
    };

    const result = saveCustomProvider(updatedProvider);
    if (!result.success) {
      return res.status(500).json({
        success: false,
        error: result.error
      });
    }

    res.json({
      success: true,
      data: updatedProvider,
      message: '自定义 Provider 已更新'
    });
  } catch (error) {
    console.error('Update custom provider error:', error);
    res.status(500).json({
      success: false,
      error: '更新自定义 Provider 失败'
    });
  }
});

// 删除自定义 Provider
settingsRouter.delete('/custom-providers/:id', async (req, res) => {
  try {
    const { id } = req.params;

    // 检查 Provider 是否存在
    const existingProvider = getCustomProviderById(id);
    if (!existingProvider) {
      return res.status(404).json({
        success: false,
        error: '自定义 Provider 不存在'
      });
    }

    // 检查是否是当前使用的 Provider
    const config = configManager.read();
    if (config.AI_PROVIDER === existingProvider.key) {
      return res.status(400).json({
        success: false,
        error: '无法删除当前正在使用的 Provider，请先切换到其他 Provider'
      });
    }

    // 删除 Provider
    const result = deleteCustomProvider(id);
    if (!result.success) {
      return res.status(500).json({
        success: false,
        error: result.error
      });
    }

    res.json({
      success: true,
      message: '自定义 Provider 已删除'
    });
  } catch (error) {
    console.error('Delete custom provider error:', error);
    res.status(500).json({
      success: false,
      error: '删除自定义 Provider 失败'
    });
  }
});
