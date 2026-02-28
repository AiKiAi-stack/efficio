import { Router } from 'express';
import { getProviderTemplates, getCurrentProvider } from '../lib/ai';

export const settingsRouter = Router();

// 获取 AI Provider 配置
settingsRouter.get('/ai-providers', (req, res) => {
  try {
    const templates = getProviderTemplates();
    const currentProvider = getCurrentProvider();

    // 返回所有 provider 的配置信息和当前配置状态
    const providers = Object.entries(templates).map(([key, value]) => ({
      key,
      name: value.name,
      docs: value.docs,
      isConfigured: process.env[value.envKey] !== undefined,
      isCurrent: currentProvider?.provider === key,
      currentModel: currentProvider?.provider === key ? currentProvider.model : undefined
    }));

    res.json({
      success: true,
      data: {
        providers,
        currentProvider: currentProvider?.provider || null
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

// 测试 AI Provider 连接
settingsRouter.post('/ai-providers/:provider/test', async (req, res) => {
  try {
    const { provider } = req.params;
    const { apiKey, apiEndpoint } = req.body;

    if (!apiKey && provider !== 'vllm') {
      return res.status(400).json({
        success: false,
        error: 'API Key 不能为空'
      });
    }

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
    const templates = getProviderTemplates();
    const keys: Record<string, string | undefined> = {};

    // 返回已配置的环境变量名称（不返回实际值）
    Object.entries(templates).forEach(([key, value]) => {
      keys[value.envKey] = process.env[value.envKey] ? '***configured***' : undefined;
    });

    res.json({
      success: true,
      data: {
        keys,
        envKeys: Object.keys(templates).map(k => templates[k].envKey)
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
