import Anthropic from '@anthropic-ai/sdk';
import { EnvHttpProxyAgent, fetch as undiciFetch } from 'undici';
import { configManager } from './config-manager';
import { getCustomProviderByKey } from './ai-providers';

// ============================================
// AI 错误分类与用户可读提示
// ============================================

export type AIErrorType =
  | 'not_configured'
  | 'network'
  | 'timeout'
  | 'auth'
  | 'rate_limit'
  | 'model'
  | 'invalid_response'
  | 'unknown';

export interface AIErrorInfo {
  type: AIErrorType;
  message: string;
  hint: string;
}

export class AIProviderError extends Error {
  info: AIErrorInfo;

  constructor(info: AIErrorInfo) {
    super(info.message);
    this.name = 'AIProviderError';
    this.info = info;
  }
}

export function getProviderDisplayName(provider: string): string {
  const names: Record<string, string> = {
    anthropic: 'Anthropic Claude',
    openai: 'OpenAI',
    deepseek: 'DeepSeek',
    zhipu: '智谱 AI',
    kimi: 'Kimi',
    nvidia: 'NVIDIA NIM',
    vllm: 'vLLM',
    aliyun: '阿里云百炼',
    volcengine: '火山引擎',
    minimax: 'MiniMax',
    openrouter: 'OpenRouter'
  };
  return names[provider] || provider;
}

/**
 * 将任意错误分类为可读的 AI 错误信息（网络/认证/超时/模型/限流等）
 */
export function classifyAIError(error: unknown, provider: string = 'anthropic'): AIErrorInfo {
  const msg = error instanceof Error ? error.message : String(error);
  const lower = msg.toLowerCase();
  const providerName = getProviderDisplayName(provider);

  if (msg.includes('AI Provider 未配置') || lower.includes('missing api key')) {
    return {
      type: 'not_configured',
      message: msg,
      hint: '尚未配置 API Key：打开「设置」页选择 Provider 并填入 API Key（或编辑 server/.env 后重启服务器）。'
    };
  }
  if (lower.includes('timeout') || lower.includes('timed out') || lower.includes('aborted')
    || lower.includes('socket hang up') || lower.includes('read econnreset') || lower.includes('deadline exceeded')) {
    return {
      type: 'timeout',
      message: msg,
      hint: '请求超时：模型响应过慢或网络不稳定，可重试，或在「设置」页更换更快的模型。'
    };
  }
  if (lower.includes('401') || lower.includes('403') || lower.includes('authentication')
    || lower.includes('invalid api key') || lower.includes('unauthorized') || lower.includes('permission')
    || lower.includes('forbidden') || lower.includes('api key')) {
    return {
      type: 'auth',
      message: msg,
      hint: '认证失败：API Key 无效或已过期，请到「设置」页更新。'
    };
  }
  if (lower.includes('429') || lower.includes('rate limit') || lower.includes('too many requests')
    || lower.includes('quota') || lower.includes('insufficient_quota') || lower.includes('余额')) {
    return {
      type: 'rate_limit',
      message: msg,
      hint: '限流或额度不足：调用频率过高或账户余额不足，请稍后重试或检查账户额度。'
    };
  }
  if (lower.includes('404') || lower.includes('model not found') || lower.includes('does not exist')
    || lower.includes('unknown model') || lower.includes('模型不存在')) {
    return {
      type: 'model',
      message: msg,
      hint: '模型名错误或不可用：请检查「设置」页的模型名称（如 deepseek-chat / qwen-plus / glm-4）。'
    };
  }
  if (lower.includes('fetch failed') || lower.includes('econnrefused') || lower.includes('enotfound')
    || lower.includes('econnreset') || lower.includes('getaddrinfo') || lower.includes('network')
    || lower.includes('und_err') || lower.includes('connect') || lower.includes('tls')
    || lower.includes('certificate') || lower.includes('self signed') || lower.includes('unable to verify')) {
    return {
      type: 'network',
      message: msg,
      hint: `无法连接到 ${providerName} 的 API：国内网络可能直连不通。可设置 HTTPS_PROXY 环境变量走代理，或在「设置」页切换到国内 Provider（DeepSeek / 智谱 / Kimi / 通义 / 火山引擎）。`
    };
  }
  if (lower.includes('parse') || lower.includes('json')) {
    return {
      type: 'invalid_response',
      message: msg,
      hint: 'AI 返回内容格式异常，请重试。'
    };
  }
  return {
    type: 'unknown',
    message: msg,
    hint: '未知错误：请查看服务器日志（运行目录 logs/efficio.log）获取详情，或在 GitHub Issues 提交反馈。'
  };
}

function toAIError(error: unknown, provider: string): AIProviderError {
  if (error instanceof AIProviderError) {
    return error;
  }
  return new AIProviderError(classifyAIError(error, provider));
}

// HTTPS_PROXY / HTTP_PROXY / ALL_PROXY 代理支持（undici EnvHttpProxyAgent 自动读取环境变量）
function getProxyFetch(): typeof fetch | undefined {
  const proxy = process.env.HTTPS_PROXY || process.env.HTTP_PROXY || process.env.ALL_PROXY;
  if (!proxy) return undefined;
  try {
    const agent = new EnvHttpProxyAgent();
    return ((url: any, init?: any) => undiciFetch(url, { ...(init || {}), dispatcher: agent })) as typeof fetch;
  } catch {
    return undefined;
  }
}

// AI 请求超时：60 秒（SDK 默认 10 分钟太长，出错时用户等不起）
const AI_TIMEOUT_MS = 60000;

// 支持多 AI Provider 配置
interface AIProviderConfig {
  provider: 'anthropic' | 'openai' | 'deepseek' | 'zhipu' | 'kimi' | 'nvidia' | 'vllm' | 'aliyun' | 'volcengine' | 'minimax' | 'openrouter' | string;
  apiKey?: string;
  apiEndpoint?: string;
  model?: string;
  isCustom?: boolean;
}

// 动态获取 Provider 配置（从 configManager 读取最新配置）
const getProviderConfig = (): AIProviderConfig => {
  const config = configManager.read();

  // 优先使用配置的 provider，其次使用环境变量
  const providerKey = config.AI_PROVIDER || process.env.AI_PROVIDER || 'anthropic';

  // 先检查是否是自定义 Provider
  const customProvider = getCustomProviderByKey(providerKey);
  if (customProvider) {
    const upperKey = customProvider.key.toUpperCase();
    return {
      provider: customProvider.key,
      apiKey: config[`${upperKey}_API_KEY`] || process.env[`${upperKey}_API_KEY`],
      apiEndpoint: config[`${upperKey}_ENDPOINT`] || customProvider.defaultEndpoint,
      model: config[`${upperKey}_MODEL`] || customProvider.defaultModel,
      isCustom: true
    };
  }

  const getEnv = (key: string, fallback?: string) => {
    return config[key] || process.env[key as keyof typeof process.env] || fallback;
  };

  const configs: Record<string, Partial<AIProviderConfig>> = {
    anthropic: {
      apiKey: getEnv('ANTHROPIC_API_KEY'),
      apiEndpoint: getEnv('ANTHROPIC_ENDPOINT', 'https://api.anthropic.com'),
      model: getEnv('ANTHROPIC_MODEL', 'claude-sonnet-4-6')
    },
    openai: {
      apiKey: getEnv('OPENAI_API_KEY'),
      apiEndpoint: getEnv('OPENAI_ENDPOINT', 'https://api.openai.com/v1'),
      model: getEnv('OPENAI_MODEL', 'gpt-4o')
    },
    deepseek: {
      apiKey: getEnv('DEEPSEEK_API_KEY'),
      apiEndpoint: getEnv('DEEPSEEK_ENDPOINT', 'https://api.deepseek.com/v1'),
      model: getEnv('DEEPSEEK_MODEL', 'deepseek-chat')
    },
    zhipu: {
      apiKey: getEnv('ZHIPU_API_KEY'),
      apiEndpoint: getEnv('ZHIPU_ENDPOINT', 'https://open.bigmodel.cn/api/paas/v4'),
      model: getEnv('ZHIPU_MODEL', 'glm-4')
    },
    kimi: {
      apiKey: getEnv('KIMI_API_KEY'),
      apiEndpoint: getEnv('KIMI_ENDPOINT', 'https://api.moonshot.cn/v1'),
      model: getEnv('KIMI_MODEL', 'moonshot-v1-8k')
    },
    nvidia: {
      apiKey: getEnv('NVIDIA_API_KEY'),
      apiEndpoint: getEnv('NVIDIA_ENDPOINT', 'https://integrate.api.nvidia.com/v1'),
      model: getEnv('NVIDIA_MODEL', 'meta/llama3-70b-instruct')
    },
    vllm: {
      apiKey: getEnv('VLLM_API_KEY', 'vllm'),
      apiEndpoint: getEnv('VLLM_ENDPOINT', 'http://localhost:8000/v1'),
      model: getEnv('VLLM_MODEL', 'default')
    },
    aliyun: {
      apiKey: getEnv('ALIYUN_API_KEY'),
      apiEndpoint: getEnv('ALIYUN_ENDPOINT', 'https://dashscope.aliyuncs.com/compatible-mode/v1'),
      model: getEnv('ALIYUN_MODEL', 'qwen-plus')
    },
    volcengine: {
      apiKey: getEnv('VOLCENGINE_API_KEY'),
      apiEndpoint: getEnv('VOLCENGINE_ENDPOINT', 'https://ark.cn-beijing.volces.com/api/v3'),
      model: getEnv('VOLCENGINE_MODEL', 'doubao-pro-4k')
    },
    minimax: {
      apiKey: getEnv('MINIMAX_API_KEY'),
      apiEndpoint: getEnv('MINIMAX_ENDPOINT', 'https://api.minimaxi.com/v1'),
      model: getEnv('MINIMAX_MODEL', 'MiniMax2.5')
    },
    openrouter: {
      apiKey: getEnv('OPENROUTER_API_KEY'),
      apiEndpoint: getEnv('OPENROUTER_ENDPOINT', 'https://openrouter.ai/api/v1'),
      model: getEnv('OPENROUTER_MODEL', 'openai/gpt-4o')
    }
  };

  return { provider: providerKey, ...configs[providerKey] } as AIProviderConfig;
};

// 延迟初始化，在首次使用时才读取配置
let _anthropic: Anthropic | null = null;
let _isAiAvailable = false;
let _currentProvider: AIProviderConfig | null = null;
let _initialized = false;

// 初始化 AI 配置
const initAI = () => {
  if (_initialized) return;
  _initialized = true;

  const config = getProviderConfig();
  const fullConfig = configManager.read();

  // 根据 provider 获取对应的 API Key
  const providerKey = config.provider.toUpperCase();
  const apiKey = fullConfig[`${providerKey}_API_KEY`] || process.env[`${providerKey}_API_KEY` as keyof typeof process.env];

  // 初始化 Anthropic 客户端（如果是 anthropic provider）
  if (config.provider === 'anthropic' && apiKey) {
    const proxyFetch = getProxyFetch();
    _anthropic = new Anthropic({
      apiKey,
      timeout: AI_TIMEOUT_MS,
      ...(proxyFetch ? { fetch: proxyFetch } : {})
    });
    _currentProvider = config;
    _isAiAvailable = true;
    console.log(`✅ AI Provider 已配置：${config.provider} (${config.model})`);
  } else if (apiKey) {
    // 其他 Provider，只要有 API Key 就认为 AI 可用
    _currentProvider = config;
    _isAiAvailable = true;
    console.log(`✅ AI Provider 已配置：${config.provider} (${config.model})`);
  } else {
    console.log('⚠️  AI Provider 未配置，AI 功能将降级运行');
  }
};

/**
 * 重置 AI 模块状态
 * 配置变更（Settings 保存/激活）后调用，确保下次读取最新配置
 */
export function resetAIState(): void {
  _anthropic = null;
  _isAiAvailable = false;
  _currentProvider = null;
  _initialized = false;
}

// 懒加载 getter
export const anthropic: Anthropic | null = null;
export function getAnthropicClient(): Anthropic | null {
  initAI();
  const config = getProviderConfig();
  const fullConfig = configManager.read();
  const providerKey = config.provider.toUpperCase();
  const apiKey = fullConfig[`${providerKey}_API_KEY`] || process.env[`${providerKey}_API_KEY` as keyof typeof process.env];

  if (config.provider === 'anthropic' && apiKey) {
    if (!_anthropic) {
      const proxyFetch = getProxyFetch();
      _anthropic = new Anthropic({
        apiKey,
        timeout: AI_TIMEOUT_MS,
        ...(proxyFetch ? { fetch: proxyFetch } : {})
      });
    }
    return _anthropic;
  }
  return null;
}

// 通用 AI 消息生成函数（支持多 Provider）
export async function generateAIResponse(options: {
  system: string;
  userMessage: string;
  maxTokens?: number;
}): Promise<string> {
  initAI();
  const config = getProviderConfig();
  const fullConfig = configManager.read();
  const providerKey = config.provider.toUpperCase();
  const apiKey = fullConfig[`${providerKey}_API_KEY`] || process.env[`${providerKey}_API_KEY` as keyof typeof process.env];

  if (!apiKey) {
    throw new Error('AI Provider 未配置');
  }

  const provider = config.provider;
  const model = config.model || 'claude-sonnet-4-6';
  const maxTokens = options.maxTokens || 2048;

  const proxyFetch = getProxyFetch();

  try {
    // Anthropic Provider
    if (provider === 'anthropic') {
      const client = new Anthropic({
        apiKey,
        timeout: AI_TIMEOUT_MS,
        ...(proxyFetch ? { fetch: proxyFetch } : {})
      });
      const message = await client.messages.create({
        model,
        max_tokens: maxTokens,
        system: options.system,
        messages: [{ role: 'user', content: options.userMessage }]
      });
      return message.content[0].type === 'text' ? message.content[0].text : '';
    }

    // OpenAI 兼容 Provider（包括 OpenAI、DeepSeek、Zhipu、Kimi、Nvidia、Aliyun、Volcengine、Minimax、OpenRouter、vLLM）
    const { OpenAI } = await import('openai');
    const endpoint = config.apiEndpoint;

    const client = new OpenAI({
      apiKey,
      baseURL: endpoint,
      timeout: AI_TIMEOUT_MS,
      ...(proxyFetch ? { fetch: proxyFetch } : {})
    });

    const completion = await client.chat.completions.create({
      model,
      messages: [
        { role: 'system', content: options.system },
        { role: 'user', content: options.userMessage }
      ],
      max_tokens: maxTokens
    });

    return completion.choices[0]?.message?.content || '';
  } catch (error) {
    throw toAIError(error, provider);
  }
}

export function isAiAvailable(): boolean {
  initAI();
  const config = getProviderConfig();
  const fullConfig = configManager.read();
  const providerKey = config.provider.toUpperCase();
  const apiKey = fullConfig[`${providerKey}_API_KEY`] || process.env[`${providerKey}_API_KEY` as keyof typeof process.env];
  return !!apiKey;
}

// 获取当前配置的 provider 信息
export function getCurrentProvider(): AIProviderConfig | null {
  initAI();
  return getProviderConfig();
}

// 获取所有可用的 provider 配置模板
export function getProviderTemplates(): Record<string, { name: string; envKey: string; defaultEndpoint: string; defaultModel: string; docs?: string; description?: string }> {
  return {
    anthropic: {
      name: 'Anthropic Claude',
      envKey: 'ANTHROPIC_API_KEY',
      defaultEndpoint: 'https://api.anthropic.com',
      defaultModel: 'claude-sonnet-4-6',
      docs: 'https://docs.anthropic.com/claude/reference/getting-started-with-the-api',
      description: '美国 AI 公司，Claude 系列模型'
    },
    openai: {
      name: 'OpenAI GPT',
      envKey: 'OPENAI_API_KEY',
      defaultEndpoint: 'https://api.openai.com/v1',
      defaultModel: 'gpt-4o',
      docs: 'https://platform.openai.com/docs/quickstart',
      description: '美国 AI 公司，GPT-4/ChatGPT'
    },
    deepseek: {
      name: 'DeepSeek (深度求索)',
      envKey: 'DEEPSEEK_API_KEY',
      defaultEndpoint: 'https://api.deepseek.com/v1',
      defaultModel: 'deepseek-chat',
      docs: 'https://platform.deepseek.com/api-docs/',
      description: '国产大模型，性价比高'
    },
    zhipu: {
      name: 'Zhipu AI (智谱 AI)',
      envKey: 'ZHIPU_API_KEY',
      defaultEndpoint: 'https://open.bigmodel.cn/api/paas/v4',
      defaultModel: 'glm-4',
      docs: 'https://open.bigmodel.cn/dev/api',
      description: '国产 GLM 系列大模型'
    },
    kimi: {
      name: 'Kimi (月之暗面)',
      envKey: 'KIMI_API_KEY',
      defaultEndpoint: 'https://api.moonshot.cn/v1',
      defaultModel: 'moonshot-v1-8k',
      docs: 'https://platform.moonshot.cn/docs/',
      description: '国产大模型，长文本处理'
    },
    // 新增 Provider
    nvidia: {
      name: 'NVIDIA NIM',
      envKey: 'NVIDIA_API_KEY',
      defaultEndpoint: 'https://integrate.api.nvidia.com/v1',
      defaultModel: 'meta/llama3-70b-instruct',
      docs: 'https://docs.api.nvidia.com/nim/',
      description: 'NVIDIA GPU 云，提供 Llama 等模型'
    },
    vllm: {
      name: 'vLLM (自部署)',
      envKey: 'VLLM_API_KEY',
      defaultEndpoint: 'http://localhost:8000/v1',
      defaultModel: 'default',
      docs: 'https://docs.vllm.ai/en/stable/',
      description: '开源模型推理框架，需自部署'
    },
    aliyun: {
      name: '阿里云百炼 (通义千问)',
      envKey: 'ALIYUN_API_KEY',
      defaultEndpoint: 'https://dashscope.aliyuncs.com/compatible-mode/v1',
      defaultModel: 'qwen-plus',
      docs: 'https://help.aliyun.com/zh/dashscope/',
      description: '阿里云通义千问 Qwen 系列'
    },
    volcengine: {
      name: '火山引擎 (豆包)',
      envKey: 'VOLCENGINE_API_KEY',
      defaultEndpoint: 'https://ark.cn-beijing.volces.com/api/v3',
      defaultModel: 'doubao-pro-4k',
      docs: 'https://www.volcengine.com/docs/82379',
      description: '火山引擎豆包/方舟大模型'
    },
    minimax: {
      name: 'MiniMax',
      envKey: 'MINIMAX_API_KEY',
      defaultEndpoint: 'https://api.minimaxi.com/v1',
      defaultModel: 'MiniMax2.5',
      docs: 'https://platform.minimaxi.com/document/guides',
      description: '国产 MiniMax 大模型，最新 MiniMax2.5'
    },
    openrouter: {
      name: 'OpenRouter',
      envKey: 'OPENROUTER_API_KEY',
      defaultEndpoint: 'https://openrouter.ai/api/v1',
      defaultModel: 'openai/gpt-4o',
      docs: 'https://openrouter.ai/docs',
      description: '聚合多个 AI 提供商的 API 服务'
    }
  };
}

// 降级模式的 AI 分析（基于规则）
export function analyzeWithoutAI(text: string): any {
  const lowerText = text.toLowerCase();

  // 简单的关键词匹配
  const categoryKeywords: Record<string, string[]> = {
    development: ['开发', '代码', '编程', '实现', '修复 bug', '功能', '模块', '系统', 'api', '数据库'],
    meeting: ['会议', '讨论', '同步', '周会', '评审', 'standup'],
    communication: ['沟通', '协调', '邮件', '消息', '回复', '联系'],
    documentation: ['文档', '说明', 'readme', '注释', 'wiki'],
    review: ['审查', '审核', 'code review', 'pr', 'mr'],
    learning: ['学习', '研究', '调研', '阅读', '培训'],
  };

  // 工具识别
  const toolKeywords: Record<string, string> = {
    'vscode': 'VSCode',
    'git': 'Git',
    'slack': 'Slack',
    'jira': 'Jira',
    'notion': 'Notion',
    'figma': 'Figma',
    'docker': 'Docker',
    'k8s': 'K8s',
    'kubernetes': 'K8s',
    'excel': 'Excel',
    'word': 'Word',
  };

  // 标签生成（简单提取名词）
  const tags: string[] = [];
  if (lowerText.includes('bug') || lowerText.includes('修复')) tags.push('bugfix');
  if (lowerText.includes('功能') || lowerText.includes('feature')) tags.push('feature');
  if (lowerText.includes('会议')) tags.push('meeting');
  if (lowerText.includes('文档')) tags.push('documentation');

  // 判断任务类别
  let category = 'other';
  let maxMatches = 0;
  for (const [cat, keywords] of Object.entries(categoryKeywords)) {
    const matches = keywords.filter(k => lowerText.includes(k)).length;
    if (matches > maxMatches) {
      maxMatches = matches;
      category = cat;
    }
  }

  // 判断是否深度工作
  const isDeepWork = category === 'development' || category === 'documentation';

  // 价值等级（简单判断）
  let valueLevel = 'medium';
  if (category === 'development' && tags.includes('feature')) valueLevel = 'high';
  if (category === 'meeting' || category === 'communication') valueLevel = 'low';

  // 工具提取
  const tools: string[] = [];
  for (const [keyword, tool] of Object.entries(toolKeywords)) {
    if (lowerText.includes(keyword)) {
      tools.push(tool);
    }
  }

  // 时间估算（根据内容长度简单估算）
  const timeSpent = text.length > 100 ? '1h' : '30m';

  return {
    task_category: category,
    time_spent: timeSpent,
    tools_used: tools.length > 0 ? tools : ['通用工具'],
    tags: tags.length > 0 ? tags : ['work'],
    is_deep_work: isDeepWork,
    interruptions: 0, // 未知打断次数（需 AI 分析），不再随机生成假数据
    value_level: valueLevel,
    analysis_source: 'rule' // 规则分析结果，非 AI 生成
  };
}

// 降级模式的文本优化
export function optimizeWithoutAI(text: string): string {
  // 简单的文本清理和格式化
  return text
    .trim()
    .replace(/\s+/g, ' ')
    .replace(/([.,!?])/g, '$1 ')
    .split('')
    .join('')
    .replace(/\s+([.,!?])/g, '$1');
}

// 降级模式的周总结生成
export function generateWeeklySummaryWithoutAI(records: any[]): string {
  const total = records.length;
  const categories = records.reduce((acc, r) => {
    const cat = r.structured_data?.task_category || 'other';
    acc[cat] = (acc[cat] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  const deepWorkCount = records.filter(r => r.structured_data?.is_deep_work).length;
  const highValueCount = records.filter(r => r.structured_data?.value_level === 'high').length;

  return `# 本周工作分析

## 📊 时间分布
${Object.entries(categories).map(([cat, count]) => `- ${cat}: ${count}条记录 (${Math.round((count as number) / total * 100)}%)`).join('\n')}

## ✨ 高价值工作
共 ${highValueCount} 项高价值工作

## 🎯 深度工作状态
深度工作：${deepWorkCount} 次，占比 ${Math.round(deepWorkCount / total * 100)}%

## 💡 优化建议
- 继续保持深度工作时间
- 减少低价值会议
- 合理安排任务优先级

---
*注：这是降级模式生成的总结，配置 AI 后可获得更详细的分析*`;
}

// 降级模式的优化建议
export function generateSuggestionsWithoutAI(records: any[]): any {
  const suggestions = [];

  const meetingCount = records.filter(r => r.structured_data?.task_category === 'meeting').length;
  if (meetingCount > records.length * 0.3) {
    suggestions.push({
      title: '减少会议时间',
      category: '时间管理',
      priority: 'high',
      why: '会议占比超过 30%，可能影响深度工作',
      how: '1. 合并同类会议\n2. 设置无会议日\n3. 优先使用异步沟通',
      expected_impact: '预计可增加 20% 深度工作时间'
    });
  }

  const deepWorkCount = records.filter(r => r.structured_data?.is_deep_work).length;
  if (deepWorkCount < records.length * 0.2) {
    suggestions.push({
      title: '增加深度工作时间',
      category: '深度工作',
      priority: 'high',
      why: '深度工作占比低于 20%，影响产出质量',
      how: '1. 每天上午固定 2 小时深度工作\n2. 关闭通知和打扰\n3. 使用番茄工作法',
      expected_impact: '提升工作效率和产出质量'
    });
  }

  if (suggestions.length === 0) {
    suggestions.push({
      title: '保持当前工作状态',
      category: '工作模式',
      priority: 'low',
      why: '当前工作模式较为健康',
      how: '1. 继续保持工作记录习惯\n2. 定期回顾效率数据\n3. 根据情况微调',
      expected_impact: '维持良好的工作效率'
    });
  }

  return { suggestions };
}

// ============================================
// 增强的 AI 总结功能
// ============================================

/**
 * 时间分布分析结果接口
 */
export interface TimeDistributionAnalysis {
  hourlyDistribution: { hour: number; count: number }[];
  peakHours: number[];
  deepWorkWindows: { start: number; end: number; score: number }[];
  interruptionPatterns: { time: string; frequency: number }[];
  workDayPattern: 'morning' | 'afternoon' | 'evening' | 'balanced';
}

/**
 * 工作洞察结果接口
 */
export interface WorkInsights {
  productivityScore: number;
  deepWorkRatio: number;
  focusQuality: 'excellent' | 'good' | 'needs_improvement' | 'poor';
  topCategories: { category: string; percentage: number; trend: 'up' | 'down' | 'stable' }[];
  valueContribution: { high: number; medium: number; low: number };
  weeklyTrend: { date: string; score: number }[];
  identifiedPatterns: string[];
  improvementAreas: string[];
}

/**
 * 增强的总结请求接口
 */
export interface EnhancedSummaryRequest {
  records: any[];
  taskLogs: any[];
  startDate: string;
  endDate: string;
  includeTimeAnalysis?: boolean;
  includeInsights?: boolean;
  includeRecommendations?: boolean;
}

/**
 * 增强的总结结果接口
 */
export interface EnhancedSummaryResult {
  markdown_content: string;
  time_distribution?: TimeDistributionAnalysis;
  insights?: WorkInsights;
  recommendations?: {
    title: string;
    category: string;
    priority: 'high' | 'medium' | 'low';
    action: string;
    expected_impact: string;
  }[];
  metrics: {
    totalRecords: number;
    totalTasks: number;
    completedTasks: number;
    totalDeepWorkHours: number;
    averageInterruptionScore: number;
    highValueWorkPercentage: number;
  };
}

/**
 * 分析时间分布
 */
export function analyzeTimeDistribution(records: any[]): TimeDistributionAnalysis {
  const hourlyDistribution: { hour: number; count: number }[] = [];
  const hourCounts: Record<number, number> = {};

  // 统计每小时的记录数
  records.forEach(record => {
    const date = new Date(record.created_at);
    const hour = date.getHours();
    hourCounts[hour] = (hourCounts[hour] || 0) + 1;
  });

  // 构建小时分布
  for (let i = 0; i < 24; i++) {
    hourlyDistribution.push({ hour: i, count: hourCounts[i] || 0 });
  }

  // 找出高峰时段（记录数最多的3个小时）
  const sortedHours = Object.entries(hourCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([hour]) => parseInt(hour));

  // 识别深度工作窗口（连续的高价值工作时段）
  const deepWorkWindows: { start: number; end: number; score: number }[] = [];
  let windowStart: number | null = null;
  let windowScore = 0;

  for (let i = 0; i < 24; i++) {
    const recordsInHour = records.filter(r => new Date(r.created_at).getHours() === i);
    const deepWorkInHour = recordsInHour.filter(r => r.structured_data?.is_deep_work).length;
    const highValueInHour = recordsInHour.filter(r => r.structured_data?.value_level === 'high').length;
    const score = deepWorkInHour * 2 + highValueInHour;

    if (score > 0) {
      if (windowStart === null) {
        windowStart = i;
        windowScore = score;
      } else {
        windowScore += score;
      }
    } else if (windowStart !== null) {
      if (i - windowStart >= 2) { // 至少2小时的窗口
        deepWorkWindows.push({ start: windowStart, end: i - 1, score: windowScore });
      }
      windowStart = null;
      windowScore = 0;
    }
  }

  // 判断工作日模式
  const morningCount = [6, 7, 8, 9, 10, 11].reduce((sum, h) => sum + (hourCounts[h] || 0), 0);
  const afternoonCount = [12, 13, 14, 15, 16, 17].reduce((sum, h) => sum + (hourCounts[h] || 0), 0);
  const eveningCount = [18, 19, 20, 21, 22, 23].reduce((sum, h) => sum + (hourCounts[h] || 0), 0);
  const total = morningCount + afternoonCount + eveningCount;

  let workDayPattern: 'morning' | 'afternoon' | 'evening' | 'balanced';
  if (total === 0) {
    workDayPattern = 'balanced';
  } else if (morningCount / total > 0.5) {
    workDayPattern = 'morning';
  } else if (afternoonCount / total > 0.5) {
    workDayPattern = 'afternoon';
  } else if (eveningCount / total > 0.3) {
    workDayPattern = 'evening';
  } else {
    workDayPattern = 'balanced';
  }

  // 打断模式分析
  const interruptionPatterns = records
    .filter(r => r.structured_data?.interruptions && r.structured_data.interruptions > 2)
    .map(r => ({
      time: new Date(r.created_at).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' }),
      frequency: r.structured_data.interruptions
    }))
    .slice(0, 5);

  return {
    hourlyDistribution,
    peakHours: sortedHours,
    deepWorkWindows: deepWorkWindows.sort((a, b) => b.score - a.score).slice(0, 3),
    interruptionPatterns,
    workDayPattern
  };
}

/**
 * 生成工作洞察
 */
export function generateWorkInsights(records: any[], taskLogs: any[]): WorkInsights {
  const totalRecords = records.length;
  if (totalRecords === 0) {
    return {
      productivityScore: 0,
      deepWorkRatio: 0,
      focusQuality: 'needs_improvement',
      topCategories: [],
      valueContribution: { high: 0, medium: 0, low: 0 },
      weeklyTrend: [],
      identifiedPatterns: ['暂无足够数据进行分析'],
      improvementAreas: ['开始记录工作以获取洞察']
    };
  }

  // 计算深度工作比例
  const deepWorkCount = records.filter(r => r.structured_data?.is_deep_work).length;
  const deepWorkRatio = deepWorkCount / totalRecords;

  // 计算价值贡献
  const highValueCount = records.filter(r => r.structured_data?.value_level === 'high').length;
  const mediumValueCount = records.filter(r => r.structured_data?.value_level === 'medium').length;
  const lowValueCount = totalRecords - highValueCount - mediumValueCount;
  const valueContribution = {
    high: Math.round((highValueCount / totalRecords) * 100),
    medium: Math.round((mediumValueCount / totalRecords) * 100),
    low: Math.round((lowValueCount / totalRecords) * 100)
  };

  // 计算生产力分数（基于多个因素）
  const avgInterruption = records.reduce((sum, r) => sum + (r.structured_data?.interruptions || 0), 0) / totalRecords;
  const focusScore = Math.max(0, 100 - avgInterruption * 10);
  const valueScore = valueContribution.high * 1.5 + valueContribution.medium * 0.5;
  const productivityScore = Math.min(100, Math.round((focusScore * 0.4 + valueScore * 0.4 + deepWorkRatio * 100 * 0.2)));

  // 判断专注质量
  let focusQuality: 'excellent' | 'good' | 'needs_improvement' | 'poor';
  if (productivityScore >= 80) focusQuality = 'excellent';
  else if (productivityScore >= 60) focusQuality = 'good';
  else if (productivityScore >= 40) focusQuality = 'needs_improvement';
  else focusQuality = 'poor';

  // 分析类别分布
  const categoryCounts: Record<string, number> = {};
  records.forEach(r => {
    const cat = r.structured_data?.task_category || 'other';
    categoryCounts[cat] = (categoryCounts[cat] || 0) + 1;
  });

  const topCategories = Object.entries(categoryCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([category, count]) => ({
      category,
      percentage: Math.round((count / totalRecords) * 100),
      trend: 'stable' as const // 实际应用中可以对比历史数据
    }));

  // 识别模式
  const identifiedPatterns: string[] = [];

  if (deepWorkRatio > 0.5) {
    identifiedPatterns.push('深度工作时间充足，保持了良好的专注状态');
  } else if (deepWorkRatio < 0.2) {
    identifiedPatterns.push('深度工作时间不足，建议增加不被打扰的专注时段');
  }

  if (valueContribution.high > 40) {
    identifiedPatterns.push('高价值工作占比较高，工作产出质量良好');
  } else if (valueContribution.high < 20) {
    identifiedPatterns.push('高价值工作占比较低，可以重新评估任务优先级');
  }

  if (avgInterruption > 3) {
    identifiedPatterns.push('工作中断较多，建议设置免打扰时段');
  }

  const meetingRatio = (categoryCounts['meeting'] || 0) / totalRecords;
  if (meetingRatio > 0.3) {
    identifiedPatterns.push('会议时间占比较高，可考虑合并或精简会议');
  }

  // 改进领域
  const improvementAreas: string[] = [];

  if (deepWorkRatio < 0.3) {
    improvementAreas.push('增加深度工作时段');
  }
  if (valueContribution.high < 30) {
    improvementAreas.push('聚焦高价值任务');
  }
  if (avgInterruption > 2) {
    improvementAreas.push('减少工作打断');
  }
  if (improvementAreas.length === 0) {
    improvementAreas.push('保持当前良好状态');
  }

  // 周趋势：按天聚合真实记录量，归一化为活跃度得分（0-100），不再使用随机数
  const dailyCounts: Record<string, number> = {};
  records.forEach(r => {
    const date = new Date(r.created_at).toLocaleDateString('zh-CN');
    dailyCounts[date] = (dailyCounts[date] || 0) + 1;
  });
  const maxDaily = Math.max(1, ...Object.values(dailyCounts));
  const weeklyTrend = Object.entries(dailyCounts)
    .slice(0, 7)
    .map(([date, count]) => ({
      date,
      score: Math.min(100, Math.round((count / maxDaily) * 100))
    }));

  return {
    productivityScore,
    deepWorkRatio: Math.round(deepWorkRatio * 100) / 100,
    focusQuality,
    topCategories,
    valueContribution,
    weeklyTrend,
    identifiedPatterns,
    improvementAreas
  };
}

/**
 * 生成个性化建议
 */
export function generatePersonalizedRecommendations(
  insights: WorkInsights,
  timeDistribution: TimeDistributionAnalysis,
  records: any[]
): { title: string; category: string; priority: 'high' | 'medium' | 'low'; action: string; expected_impact: string }[] {
  const recommendations: { title: string; category: string; priority: 'high' | 'medium' | 'low'; action: string; expected_impact: string }[] = [];

  // 基于专注质量的建议
  if (insights.focusQuality === 'poor' || insights.focusQuality === 'needs_improvement') {
    recommendations.push({
      title: '建立深度工作习惯',
      category: '专注力',
      priority: 'high',
      action: '每天选择一段 90 分钟的时间段，关闭所有通知，专注于最重要的任务',
      expected_impact: '预计可提升工作效率 25-40%'
    });
  }

  // 基于时间分布的建议
  if (timeDistribution.peakHours.length > 0) {
    const peakHour = timeDistribution.peakHours[0];
    recommendations.push({
      title: '利用高峰时段',
      category: '时间管理',
      priority: 'medium',
      action: `你的高效时段是 ${peakHour}:00 左右，建议将重要任务安排在这个时段`,
      expected_impact: '提升任务完成质量和速度'
    });
  }

  // 基于深度工作窗口的建议
  if (timeDistribution.deepWorkWindows.length > 0) {
    const bestWindow = timeDistribution.deepWorkWindows[0];
    recommendations.push({
      title: '优化深度工作窗口',
      category: '深度工作',
      priority: 'high',
      action: `${bestWindow.start}:00-${bestWindow.end}:00 是你的黄金工作时段，请保护这段时间免受打扰`,
      expected_impact: '显著提升深度工作产出'
    });
  }

  // 基于价值贡献的建议
  if (insights.valueContribution.high < 30) {
    recommendations.push({
      title: '提升高价值工作占比',
      category: '优先级管理',
      priority: 'high',
      action: '每天开始工作前列出 3 件高价值任务，优先完成它们',
      expected_impact: '提升工作成就感和产出价值'
    });
  }

  // 基于打断模式的建议
  if (timeDistribution.interruptionPatterns.length > 2) {
    recommendations.push({
      title: '减少工作中断',
      category: '专注力',
      priority: 'medium',
      action: '设置固定的消息处理时间（如每小时 5 分钟），避免频繁切换注意力',
      expected_impact: '减少上下文切换成本，提升连续工作效率'
    });
  }

  // 如果建议较少，添加一些通用建议
  if (recommendations.length < 2) {
    recommendations.push({
      title: '保持工作记录习惯',
      category: '自我管理',
      priority: 'low',
      action: '持续记录每日工作，定期回顾和分析',
      expected_impact: '长期积累数据，获得更精准的个性化建议'
    });
  }

  return recommendations;
}

/**
 * 生成增强的 AI 总结（降级模式）
 */
export function generateEnhancedSummaryWithoutAI(request: EnhancedSummaryRequest): EnhancedSummaryResult {
  const { records, taskLogs, startDate, endDate } = request;

  // 计算基础指标
  const totalRecords = records.length;
  const totalTasks = taskLogs.length;
  const completedTasks = taskLogs.filter(t => t.status === 'completed').length;

  // 计算深度工作小时数（估算）
  const deepWorkRecords = records.filter(r => r.structured_data?.is_deep_work);
  const totalDeepWorkHours = deepWorkRecords.reduce((sum, r) => {
    const timeSpent = r.structured_data?.time_spent || '1h';
    const hours = parseFloat(timeSpent.replace(/[^0-9.]/g, '')) || 1;
    return sum + hours;
  }, 0);

  // 计算平均打断分数
  const avgInterruption = totalRecords > 0
    ? records.reduce((sum, r) => sum + (r.structured_data?.interruptions || 0), 0) / totalRecords
    : 0;

  // 计算高价值工作占比
  const highValueCount = records.filter(r => r.structured_data?.value_level === 'high').length;
  const highValuePercentage = totalRecords > 0 ? Math.round((highValueCount / totalRecords) * 100) : 0;

  // 分析时间分布
  const timeDistribution = analyzeTimeDistribution(records);

  // 生成洞察
  const insights = generateWorkInsights(records, taskLogs);

  // 生成建议
  const recommendations = generatePersonalizedRecommendations(insights, timeDistribution, records);

  // 生成 Markdown 内容
  const periodLabel = startDate === endDate ? `单日总结 (${startDate})` : `时间段总结 (${startDate} 至 ${endDate})`;

  const markdownContent = `# ${periodLabel}

## 📊 总体概览

| 指标 | 数值 |
|------|------|
| 工作记录数 | ${totalRecords} |
| 任务总数 | ${totalTasks} |
| 已完成任务 | ${completedTasks} (${totalTasks > 0 ? Math.round(completedTasks / totalTasks * 100) : 0}%) |
| 深度工作时长 | ${totalDeepWorkHours.toFixed(1)} 小时 |
| 高价值工作占比 | ${highValuePercentage}% |
| 生产力评分 | ${insights.productivityScore}/100 |

## ⏱️ 时间分布分析

### 工作时段模式
您的工作模式：**${timeDistribution.workDayPattern === 'morning' ? '晨间高效型' : timeDistribution.workDayPattern === 'afternoon' ? '下午高效型' : timeDistribution.workDayPattern === 'evening' ? '夜间工作型' : '均衡分布型'}**

### 高峰工作时段
${timeDistribution.peakHours.length > 0 ? timeDistribution.peakHours.map(h => `- ${h}:00`).join('\n') : '- 暂无明显高峰时段'}

### 最佳深度工作窗口
${timeDistribution.deepWorkWindows.length > 0 ? timeDistribution.deepWorkWindows.map(w => `- ${w.start}:00 - ${w.end}:00 (评分: ${w.score})`).join('\n') : '- 建议创建固定的深度工作时段'}

## 🎯 工作洞察

### 生产力分析
- **专注质量**: ${insights.focusQuality === 'excellent' ? '优秀' : insights.focusQuality === 'good' ? '良好' : insights.focusQuality === 'needs_improvement' ? '待改进' : '需要关注'}
- **深度工作比例**: ${(insights.deepWorkRatio * 100).toFixed(1)}%

### 任务类别分布
${insights.topCategories.map(c => `- ${c.category}: ${c.percentage}%`).join('\n')}

### 价值贡献
- 高价值工作: ${insights.valueContribution.high}%
- 中价值工作: ${insights.valueContribution.medium}%
- 常规工作: ${insights.valueContribution.low}%

### 已识别的模式
${insights.identifiedPatterns.map(p => `- ${p}`).join('\n')}

## 💡 个性化建议

${recommendations.map((r, i) => `### ${i + 1}. ${r.title}
- **类别**: ${r.category}
- **优先级**: ${r.priority === 'high' ? '高' : r.priority === 'medium' ? '中' : '低'}
- **行动**: ${r.action}
- **预期效果**: ${r.expected_impact}`).join('\n\n')}

---
*本报告由系统自动生成，配置 AI 后可获得更详细的分析*
`;

  return {
    markdown_content: markdownContent,
    time_distribution: request.includeTimeAnalysis ? timeDistribution : undefined,
    insights: request.includeInsights ? insights : undefined,
    recommendations: request.includeRecommendations ? recommendations : undefined,
    metrics: {
      totalRecords,
      totalTasks,
      completedTasks,
      totalDeepWorkHours,
      averageInterruptionScore: Math.round(avgInterruption * 10) / 10,
      highValueWorkPercentage: highValuePercentage
    }
  };
}
