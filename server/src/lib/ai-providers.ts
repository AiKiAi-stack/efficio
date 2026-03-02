/**
 * AI Provider 配置管理模块
 *
 * 提供 Provider 模板定义、配置管理和环境变量操作
 */

/**
 * Provider 模板接口 - 定义每个 Provider 的元数据
 */
export interface ProviderTemplate {
  key: string;
  name: string;
  description: string;
  docs: string;
  envVarKey: string;
  defaultEndpoint: string;
  defaultModel: string;
  maxTokenKey: string;
  defaultMaxToken: number;
}

/**
 * Provider 配置接口 - 运行时使用的完整配置
 */
export interface ProviderConfig {
  provider: string;
  apiKey: string;
  apiEndpoint: string;
  model: string;
  maxToken: number;
}

/**
 * 所有支持的 AI Provider 模板
 */
export const PROVIDER_TEMPLATES: Record<string, ProviderTemplate> = {
  anthropic: {
    key: 'anthropic',
    name: 'Anthropic Claude',
    description: '美国 AI 公司，Claude 系列模型',
    docs: 'https://docs.anthropic.com/claude/reference/getting-started-with-the-api',
    envVarKey: 'ANTHROPIC_API_KEY',
    defaultEndpoint: 'https://api.anthropic.com',
    defaultModel: 'claude-sonnet-4-6',
    maxTokenKey: 'ANTHROPIC_MAX_TOKENS',
    defaultMaxToken: 4096
  },
  openai: {
    key: 'openai',
    name: 'OpenAI GPT',
    description: '美国 AI 公司，GPT-4/ChatGPT',
    docs: 'https://platform.openai.com/docs/quickstart',
    envVarKey: 'OPENAI_API_KEY',
    defaultEndpoint: 'https://api.openai.com/v1',
    defaultModel: 'gpt-4o',
    maxTokenKey: 'OPENAI_MAX_TOKENS',
    defaultMaxToken: 4096
  },
  deepseek: {
    key: 'deepseek',
    name: 'DeepSeek (深度求索)',
    description: '国产大模型，性价比高',
    docs: 'https://platform.deepseek.com/api-docs/',
    envVarKey: 'DEEPSEEK_API_KEY',
    defaultEndpoint: 'https://api.deepseek.com/v1',
    defaultModel: 'deepseek-chat',
    maxTokenKey: 'DEEPSEEK_MAX_TOKENS',
    defaultMaxToken: 4096
  },
  zhipu: {
    key: 'zhipu',
    name: 'Zhipu AI (智谱 AI)',
    description: '国产 GLM 系列大模型',
    docs: 'https://open.bigmodel.cn/dev/api',
    envVarKey: 'ZHIPU_API_KEY',
    defaultEndpoint: 'https://open.bigmodel.cn/api/paas/v4',
    defaultModel: 'glm-4',
    maxTokenKey: 'ZHIPU_MAX_TOKENS',
    defaultMaxToken: 2048
  },
  kimi: {
    key: 'kimi',
    name: 'Kimi (月之暗面)',
    description: '国产大模型，长文本处理',
    docs: 'https://platform.moonshot.cn/docs/',
    envVarKey: 'KIMI_API_KEY',
    defaultEndpoint: 'https://api.moonshot.cn/v1',
    defaultModel: 'moonshot-v1-8k',
    maxTokenKey: 'KIMI_MAX_TOKENS',
    defaultMaxToken: 4096
  },
  nvidia: {
    key: 'nvidia',
    name: 'NVIDIA NIM',
    description: 'NVIDIA GPU 云，提供 Llama 等模型',
    docs: 'https://docs.api.nvidia.com/nim/',
    envVarKey: 'NVIDIA_API_KEY',
    defaultEndpoint: 'https://integrate.api.nvidia.com/v1',
    defaultModel: 'meta/llama3-70b-instruct',
    maxTokenKey: 'NVIDIA_MAX_TOKENS',
    defaultMaxToken: 2048
  },
  vllm: {
    key: 'vllm',
    name: 'vLLM (自部署)',
    description: '开源模型推理框架，需自部署',
    docs: 'https://docs.vllm.ai/en/stable/',
    envVarKey: 'VLLM_API_KEY',
    defaultEndpoint: 'http://localhost:8000/v1',
    defaultModel: 'default',
    maxTokenKey: 'VLLM_MAX_TOKENS',
    defaultMaxToken: 4096
  },
  aliyun: {
    key: 'aliyun',
    name: '阿里云百炼 (通义千问)',
    description: '阿里云通义千问 Qwen 系列',
    docs: 'https://help.aliyun.com/zh/dashscope/',
    envVarKey: 'ALIYUN_API_KEY',
    defaultEndpoint: 'https://dashscope.aliyuncs.com/compatible-mode/v1',
    defaultModel: 'qwen-plus',
    maxTokenKey: 'ALIYUN_MAX_TOKENS',
    defaultMaxToken: 4096
  },
  volcengine: {
    key: 'volcengine',
    name: '火山引擎 (豆包)',
    description: '火山引擎豆包/方舟大模型',
    docs: 'https://www.volcengine.com/docs/82379',
    envVarKey: 'VOLCENGINE_API_KEY',
    defaultEndpoint: 'https://ark.cn-beijing.volces.com/api/v3',
    defaultModel: 'doubao-pro-4k',
    maxTokenKey: 'VOLCENGINE_MAX_TOKENS',
    defaultMaxToken: 4096
  },
  minimax: {
    key: 'minimax',
    name: 'MiniMax',
    description: '国产 MiniMax 大模型，最新 MiniMax2.5',
    docs: 'https://platform.minimaxi.com/document/guides',
    envVarKey: 'MINIMAX_API_KEY',
    defaultEndpoint: 'https://api.minimaxi.com/v1',
    defaultModel: 'MiniMax2.5',
    maxTokenKey: 'MINIMAX_MAX_TOKENS',
    defaultMaxToken: 4096
  },
  openrouter: {
    key: 'openrouter',
    name: 'OpenRouter',
    description: '聚合多个 AI 提供商的 API 服务',
    docs: 'https://openrouter.ai/docs',
    envVarKey: 'OPENROUTER_API_KEY',
    defaultEndpoint: 'https://openrouter.ai/api/v1',
    defaultModel: 'openai/gpt-4o',
    maxTokenKey: 'OPENROUTER_MAX_TOKENS',
    defaultMaxToken: 4096
  }
};

/**
 * 获取 Provider 模板信息
 */
export function getProviderTemplate(providerKey: string): ProviderTemplate | null {
  return PROVIDER_TEMPLATES[providerKey] || null;
}

/**
 * 获取所有 Provider 模板列表
 */
export function getAllProviderTemplates(): ProviderTemplate[] {
  return Object.values(PROVIDER_TEMPLATES);
}

/**
 * 从环境变量读取 Provider 配置
 */
export function getProviderConfig(providerKey: string): ProviderConfig {
  const template = getProviderTemplate(providerKey);
  if (!template) {
    throw new Error(`Unknown provider: ${providerKey}`);
  }

  const apiKey = process.env[template.envVarKey] || '';
  const apiEndpoint = process.env[`${template.key.toUpperCase()}_ENDPOINT`] || template.defaultEndpoint;
  const model = process.env[`${template.key.toUpperCase()}_MODEL`] || template.defaultModel;
  const maxTokenStr = process.env[template.maxTokenKey];
  const maxToken = maxTokenStr ? parseInt(maxTokenStr, 10) : template.defaultMaxToken;

  return {
    provider: providerKey,
    apiKey,
    apiEndpoint,
    model,
    maxToken
  };
}

/**
 * 验证 Provider 配置是否有效
 */
export function validateProviderConfig(config: ProviderConfig): { valid: boolean; errors: string[] } {
  const errors: string[] = [];
  const template = getProviderTemplate(config.provider);

  if (!template) {
    errors.push(`未知的 Provider: ${config.provider}`);
  }

  if (!config.apiKey || config.apiKey.trim() === '') {
    errors.push('API Key 不能为空');
  }

  if (!config.apiEndpoint || config.apiEndpoint.trim() === '') {
    errors.push('API Endpoint 不能为空');
  } else {
    try {
      new URL(config.apiEndpoint);
    } catch {
      errors.push('API Endpoint 必须是有效的 URL');
    }
  }

  if (!config.model || config.model.trim() === '') {
    errors.push('模型名称不能为空');
  }

  if (config.maxToken < 1 || config.maxToken > 128000) {
    errors.push('Max Token 必须在 1-128000 之间');
  }

  return {
    valid: errors.length === 0,
    errors
  };
}

/**
 * 检查 Provider 是否已配置（有 API Key）
 */
export function isProviderConfigured(providerKey: string): boolean {
  const template = getProviderTemplate(providerKey);
  if (!template) return false;

  const apiKey = process.env[template.envVarKey];
  return !!apiKey && apiKey.trim() !== '';
}

/**
 * 获取当前激活的 Provider 信息
 */
export function getCurrentProvider(): ProviderConfig | null {
  const currentProviderKey = process.env.AI_PROVIDER || 'anthropic';

  if (isProviderConfigured(currentProviderKey)) {
    return getProviderConfig(currentProviderKey);
  }

  // 如果当前 provider 未配置，尝试找第一个已配置的
  for (const [key] of Object.entries(PROVIDER_TEMPLATES)) {
    if (isProviderConfigured(key)) {
      return getProviderConfig(key);
    }
  }

  return null;
}
