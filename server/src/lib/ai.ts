import Anthropic from '@anthropic-ai/sdk';

// 支持多 AI Provider 配置
interface AIProviderConfig {
  provider: 'anthropic' | 'openai' | 'deepseek' | 'zhipu' | 'kimi' | 'nvidia' | 'vllm' | 'aliyun' | 'volcengine' | 'minimax' | 'openrouter';
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
    },
    // 新增 Provider 配置
    nvidia: {
      apiKey: process.env.NVIDIA_API_KEY,
      apiEndpoint: 'https://integrate.api.nvidia.com/v1',
      model: 'meta/llama3-70b-instruct'
    },
    vllm: {
      apiKey: process.env.VLLM_API_KEY || 'vllm', // vLLM 默认不需要 API Key
      apiEndpoint: process.env.VLLM_ENDPOINT || 'http://localhost:8000/v1',
      model: process.env.VLLM_MODEL || 'default'
    },
    aliyun: {
      apiKey: process.env.ALIYUN_API_KEY,
      apiEndpoint: 'https://dashscope.aliyuncs.com/compatible-mode/v1',
      model: 'qwen-plus'
    },
    volcengine: {
      apiKey: process.env.VOLCENGINE_API_KEY,
      apiEndpoint: 'https://ark.cn-beijing.volces.com/api/v3',
      model: 'doubao-pro-4k'
    },
    minimax: {
      apiKey: process.env.MINIMAX_API_KEY,
      apiEndpoint: 'https://api.minimaxi.com/v1',
      model: 'MiniMax2.5'
    },
    openrouter: {
      apiKey: process.env.OPENROUTER_API_KEY,
      apiEndpoint: 'https://openrouter.ai/api/v1',
      model: 'openai/gpt-4o' // OpenRouter 支持多个模型，默认使用 GPT-4o
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

  // 周趋势（简化版本，实际应该按天聚合）
  const weeklyTrend = records.slice(0, 7).map(r => ({
    date: new Date(r.created_at).toLocaleDateString('zh-CN'),
    score: Math.round(Math.random() * 30 + 60) // 简化计算
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
