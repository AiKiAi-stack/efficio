import Anthropic from '@anthropic-ai/sdk';

// 支持多 AI Provider 配置
interface AIProviderConfig {
  provider: 'anthropic' | 'openai' | 'deepseek' | 'zhipu' | 'kimi';
  apiKey?: string;
  apiEndpoint?: string;
  model?: string;
}

// 从环境变量读取配置
const getProviderConfig = (): AIProviderConfig => {
  // 优先使用配置的 provider
  const provider = (process.env.AI_PROVIDER || 'anthropic') as AIProviderConfig['provider'];

  const configs: Record<string, Partial<AIProviderConfig>> = {
    anthropic: {
      apiKey: process.env.ANTHROPIC_API_KEY,
      apiEndpoint: 'https://api.anthropic.com',
      model: 'claude-sonnet-4-6'
    },
    openai: {
      apiKey: process.env.OPENAI_API_KEY,
      apiEndpoint: 'https://api.openai.com/v1',
      model: 'gpt-4o'
    },
    deepseek: {
      apiKey: process.env.DEEPSEEK_API_KEY,
      apiEndpoint: 'https://api.deepseek.com/v1',
      model: 'deepseek-chat'
    },
    zhipu: {
      apiKey: process.env.ZHIPU_API_KEY,
      apiEndpoint: 'https://open.bigmodel.cn/api/paas/v4',
      model: 'glm-4'
    },
    kimi: {
      apiKey: process.env.KIMI_API_KEY,
      apiEndpoint: 'https://api.moonshot.cn/v1',
      model: 'moonshot-v1-8k'
    }
  };

  return { provider, ...configs[provider] } as AIProviderConfig;
};

const config = getProviderConfig();

// Anthropic 客户端
const anthropicApiKey = process.env.ANTHROPIC_API_KEY;
export let anthropic: Anthropic | null = null;

if (anthropicApiKey) {
  anthropic = new Anthropic({ apiKey: anthropicApiKey });
}

// 通用 AI 客户端（支持多 provider）
let currentProvider: AIProviderConfig | null = null;
let isAiAvailable = false;

if (config.apiKey) {
  currentProvider = config;
  isAiAvailable = true;
  console.log(`✅ AI Provider 已配置：${config.provider} (${config.model})`);
} else if (anthropicApiKey) {
  isAiAvailable = true;
  console.log('✅ Anthropic AI 已配置');
} else {
  console.log('⚠️  AI Provider 未配置，AI 功能将降级运行');
}

export { isAiAvailable };

// 获取当前配置的 provider 信息
export function getCurrentProvider(): AIProviderConfig | null {
  return currentProvider;
}

// 获取所有可用的 provider 配置模板
export function getProviderTemplates(): Record<string, { name: string; envKey: string; defaultEndpoint: string; defaultModel: string; docs?: string }> {
  return {
    anthropic: {
      name: 'Anthropic Claude',
      envKey: 'ANTHROPIC_API_KEY',
      defaultEndpoint: 'https://api.anthropic.com',
      defaultModel: 'claude-sonnet-4-6',
      docs: 'https://docs.anthropic.com/claude/reference/getting-started-with-the-api'
    },
    openai: {
      name: 'OpenAI GPT',
      envKey: 'OPENAI_API_KEY',
      defaultEndpoint: 'https://api.openai.com/v1',
      defaultModel: 'gpt-4o',
      docs: 'https://platform.openai.com/docs/quickstart'
    },
    deepseek: {
      name: 'DeepSeek (深度求索)',
      envKey: 'DEEPSEEK_API_KEY',
      defaultEndpoint: 'https://api.deepseek.com/v1',
      defaultModel: 'deepseek-chat',
      docs: 'https://platform.deepseek.com/api-docs/'
    },
    zhipu: {
      name: 'Zhipu AI (智谱 AI)',
      envKey: 'ZHIPU_API_KEY',
      defaultEndpoint: 'https://open.bigmodel.cn/api/paas/v4',
      defaultModel: 'glm-4',
      docs: 'https://open.bigmodel.cn/dev/api'
    },
    kimi: {
      name: 'Kimi (月之暗面)',
      envKey: 'KIMI_API_KEY',
      defaultEndpoint: 'https://api.moonshot.cn/v1',
      defaultModel: 'moonshot-v1-8k',
      docs: 'https://platform.moonshot.cn/docs/'
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
    interruptions: Math.floor(Math.random() * 3), // 0-2
    value_level: valueLevel
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
${Object.entries(categories).map(([cat, count]) => `- ${cat}: ${count}条记录 (${Math.round(count / total * 100)}%)`).join('\n')}

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
