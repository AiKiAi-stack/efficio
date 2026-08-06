// Jest 测试设置文件
// 用于配置全局的测试环境

// 测试环境强制清理 AI 配置：
// 1. 防止测试触发真实 AI API 调用（慢且不可控）
// 2. 保证降级模式测试（analyzeWithoutAI 等）行为确定
beforeAll(() => {
  const keys = [
    'AI_PROVIDER', 'ANTHROPIC_API_KEY', 'OPENAI_API_KEY', 'DEEPSEEK_API_KEY',
    'ZHIPU_API_KEY', 'KIMI_API_KEY', 'NVIDIA_API_KEY', 'VLLM_API_KEY',
    'ALIYUN_API_KEY', 'VOLCENGINE_API_KEY', 'MINIMAX_API_KEY', 'OPENROUTER_API_KEY'
  ];
  keys.forEach(key => delete process.env[key]);
});

beforeEach(() => {
  jest.clearAllMocks();
});

// 设置测试超时时间
jest.setTimeout(10000);

