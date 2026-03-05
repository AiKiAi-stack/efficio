/**
 * AI Providers 测试
 *
 * 测试 AI Provider 配置管理功能
 */

import {
  PROVIDER_TEMPLATES,
  getProviderTemplate,
  getAllProviderTemplates,
  getProviderConfig,
  isProviderConfigured,
  validateProviderConfig
} from '../lib/ai-providers';

describe('PROVIDER_TEMPLATES', () => {
  it('应该包含所有预定义的 Provider', () => {
    const expectedProviders = [
      'anthropic',
      'openai',
      'deepseek',
      'zhipu',
      'kimi',
      'nvidia',
      'vllm',
      'aliyun',
      'volcengine',
      'minimax',
      'openrouter'
    ];

    for (const provider of expectedProviders) {
      expect(PROVIDER_TEMPLATES[provider]).toBeDefined();
      expect(PROVIDER_TEMPLATES[provider].key).toBe(provider);
    }
  });

  it('每个 Provider 都应该有必需的字段', () => {
    for (const [, template] of Object.entries(PROVIDER_TEMPLATES)) {
      expect(template).toHaveProperty('key');
      expect(template).toHaveProperty('name');
      expect(template).toHaveProperty('description');
      expect(template).toHaveProperty('docs');
      expect(template).toHaveProperty('envVarKey');
      expect(template).toHaveProperty('defaultEndpoint');
      expect(template).toHaveProperty('defaultModel');
      expect(template).toHaveProperty('maxTokenKey');
      expect(template).toHaveProperty('defaultMaxToken');
    }
  });
});

describe('getProviderTemplate', () => {
  it('应该返回存在的 Provider 模板', () => {
    const template = getProviderTemplate('anthropic');

    expect(template).toBeDefined();
    expect(template?.name).toBe('Anthropic Claude');
    expect(template?.defaultModel).toBe('claude-sonnet-4-6');
  });

  it('应该返回 null 对于不存在的 Provider', () => {
    const template = getProviderTemplate('nonexistent');
    expect(template).toBeNull();
  });
});

describe('getAllProviderTemplates', () => {
  it('应该返回所有 Provider 模板数组', () => {
    const templates = getAllProviderTemplates();

    expect(Array.isArray(templates)).toBe(true);
    expect(templates.length).toBeGreaterThan(0);
    expect(templates.every(t => t.key && t.name)).toBe(true);
  });
});

describe('validateProviderConfig', () => {
  it('应该验证有效的配置', () => {
    const validConfig = {
      provider: 'openai',
      apiKey: 'sk-valid-key',
      apiEndpoint: 'https://api.openai.com/v1',
      model: 'gpt-4o',
      maxToken: 4096
    };

    const result = validateProviderConfig(validConfig);
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it('应该拒绝空的 API Key', () => {
    const config = {
      provider: 'openai',
      apiKey: '',
      apiEndpoint: 'https://api.openai.com/v1',
      model: 'gpt-4o',
      maxToken: 4096
    };

    const result = validateProviderConfig(config);
    expect(result.valid).toBe(false);
    expect(result.errors).toContain('API Key 不能为空');
  });

  it('应该拒绝无效的 URL', () => {
    const config = {
      provider: 'openai',
      apiKey: 'sk-valid-key',
      apiEndpoint: 'not-a-valid-url',
      model: 'gpt-4o',
      maxToken: 4096
    };

    const result = validateProviderConfig(config);
    expect(result.valid).toBe(false);
    expect(result.errors).toContain('API Endpoint 必须是有效的 URL');
  });

  it('应该拒绝超出范围的 Max Token', () => {
    const config1 = {
      provider: 'openai',
      apiKey: 'sk-valid-key',
      apiEndpoint: 'https://api.openai.com/v1',
      model: 'gpt-4o',
      maxToken: 0
    };

    const result1 = validateProviderConfig(config1);
    expect(result1.valid).toBe(false);
    expect(result1.errors).toContain('Max Token 必须在 1-128000 之间');

    const config2 = {
      ...config1,
      maxToken: 200000
    };

    const result2 = validateProviderConfig(config2);
    expect(result2.valid).toBe(false);
  });

  it('应该允许自定义 Provider 验证', () => {
    const config = {
      provider: 'custom_provider',
      apiKey: 'sk-valid-key',
      apiEndpoint: 'https://custom.api.com/v1',
      model: 'custom-model',
      maxToken: 4096
    };

    // 自定义 Provider 应该通过验证（isCustom = true）
    const result = validateProviderConfig(config, true);
    expect(result.valid).toBe(true);
  });
});

describe('Provider 默认配置', () => {
  it('Anthropic 应该有正确的默认值', () => {
    const template = PROVIDER_TEMPLATES.anthropic;
    expect(template.defaultEndpoint).toBe('https://api.anthropic.com');
    expect(template.defaultModel).toBe('claude-sonnet-4-6');
    expect(template.defaultMaxToken).toBe(4096);
  });

  it('OpenAI 应该有正确的默认值', () => {
    const template = PROVIDER_TEMPLATES.openai;
    expect(template.defaultEndpoint).toBe('https://api.openai.com/v1');
    expect(template.defaultModel).toBe('gpt-4o');
    expect(template.defaultMaxToken).toBe(4096);
  });

  it('DeepSeek 应该有正确的默认值', () => {
    const template = PROVIDER_TEMPLATES.deepseek;
    expect(template.defaultEndpoint).toBe('https://api.deepseek.com/v1');
    expect(template.defaultModel).toBe('deepseek-chat');
    expect(template.defaultMaxToken).toBe(4096);
  });
});
