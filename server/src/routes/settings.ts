import { Router } from 'express';
import { getProviderTemplate, getAllProviderTemplates } from '../lib/ai-providers';
import { updateProviderConfig, configManager } from '../lib/config-manager';

export const settingsRouter = Router();

// 获取 AI Provider 配置
settingsRouter.get('/ai-providers', (req, res) => {
  try {
    const templates = getAllProviderTemplates();

    // 读取配置文件获取当前配置
    const config = configManager.read();
    const aiProvider = config.AI_PROVIDER || process.env.AI_PROVIDER || 'anthropic';

    // 返回所有 provider 的配置信息和当前配置状态
    const providers = templates.map((value) => {
      const upperKey = value.key.toUpperCase();
      const apiKey = config[`${upperKey}_API_KEY`] || process.env[`${upperKey}_API_KEY`];
      const endpoint = config[`${upperKey}_ENDPOINT`] || value.defaultEndpoint;
      const model = config[`${upperKey}_MODEL`] || value.defaultModel;
      const maxToken = config[`${upperKey}_MAX_TOKENS`] || value.defaultMaxToken.toString();

      return {
        key: value.key,
        name: value.name,
        docs: value.docs,
        description: value.description,
        isConfigured: !!apiKey && apiKey.trim() !== '',
        isCurrent: aiProvider === value.key,
        currentModel: model,
        currentEndpoint: endpoint,
        currentMaxToken: parseInt(maxToken, 10)
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

// 获取单个 Provider 模板详情
settingsRouter.get('/ai-providers/:provider', (req, res) => {
  try {
    const { provider } = req.params;
    const template = getProviderTemplate(provider);

    if (!template) {
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
        ...template,
        apiKey: config[`${upperProvider}_API_KEY`] || '',
        apiEndpoint: config[`${upperProvider}_ENDPOINT`] || template.defaultEndpoint,
        model: config[`${upperProvider}_MODEL`] || template.defaultModel,
        maxToken: parseInt(config[`${upperProvider}_MAX_TOKENS`] || template.defaultMaxToken.toString(), 10)
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

// 保存 Provider 配置
settingsRouter.post('/ai-providers/:provider/config', async (req, res) => {
  try {
    const { provider } = req.params;
    const { apiKey, apiEndpoint, model, maxToken } = req.body;

    // 验证 provider 是否存在
    const template = getProviderTemplate(provider);
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

    // 验证 provider 是否存在
    const template = getProviderTemplate(provider);
    if (!template) {
      return res.status(404).json({
        success: false,
        error: 'Provider 不存在'
      });
    }

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
      message: `已将 ${template.name} 设为当前 Provider`
    });
  } catch (error) {
    console.error('Activate provider error:', error);
    res.status(500).json({
      success: false,
      error: '激活 Provider 失败'
    });
  }
});

// 测试 AI Provider 连接
settingsRouter.post('/ai-providers/:provider/test', async (req, res) => {
  try {
    const { provider } = req.params;
    let { apiKey, apiEndpoint } = req.body;

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

    if (!apiKey && provider !== 'vllm') {
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
      }
    } else {
      apiEndpoint = apiEndpoint.trim();
    }

    // 清除配置缓存，确保下次读取最新数据
    configManager.clearCache();

    let testResult: { success: boolean; message: string };

    // 根据不同 provider 测试连接
    switch (provider) {
      case 'anthropic': {
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
        break;
      }

      case 'openai':
      case 'deepseek':
      case 'zhipu':
      case 'kimi':
      case 'nvidia':
      case 'aliyun':
      case 'volcengine':
      case 'minimax':
      case 'openrouter': {
        // 这些都使用 OpenAI 兼容格式
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
        break;
      }

      case 'vllm': {
        // vLLM 自部署服务，使用 OpenAI 兼容格式
        try {
          const { OpenAI } = await import('openai');
          const endpoint = apiEndpoint || 'http://localhost:8000/v1';
          const client = new OpenAI({ apiKey: apiKey || 'vllm', baseURL: endpoint });
          await client.models.list();
          testResult = { success: true, message: 'vLLM 服务连接成功' };
        } catch (error: any) {
          if (error.code === 'MODULE_NOT_FOUND') {
            testResult = { success: false, message: '未安装 openai 包，请运行：npm install openai' };
          } else if (error.message?.includes('connect') || error.message?.includes('ECONNREFUSED')) {
            testResult = { success: false, message: '无法连接到 vLLM 服务，请确认服务已启动' };
          } else {
            testResult = { success: false, message: `连接失败：${error.message}` };
          }
        }
        break;
      }

      default:
        testResult = { success: false, message: `不支持的 Provider: ${provider}` };
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
