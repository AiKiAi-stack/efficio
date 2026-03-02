/**
 * 配置文件管理模块
 *
 * 负责 .env 文件的读取和写入操作
 */

import * as fs from 'fs';
import * as path from 'path';

/**
 * 解析 .env 文件内容
 */
export function parseEnvFile(content: string): Record<string, string> {
  const result: Record<string, string> = {};
  const lines = content.split('\n');

  for (const line of lines) {
    const trimmedLine = line.trim();

    // 跳过空行和注释
    if (!trimmedLine || trimmedLine.startsWith('#')) {
      continue;
    }

    // 解析 KEY=VALUE 格式
    const equalIndex = trimmedLine.indexOf('=');
    if (equalIndex === -1) {
      continue;
    }

    const key = trimmedLine.substring(0, equalIndex).trim();
    const value = trimmedLine.substring(equalIndex + 1).trim();

    // 移除引号（如果存在）
    const unquotedValue = value.replace(/^["']|["']$/g, '');

    if (key) {
      result[key] = unquotedValue;
    }
  }

  return result;
}

/**
 * 将配置对象转换为 .env 文件内容
 */
export function stringifyEnvFile(config: Record<string, string>): string {
  const lines: string[] = [];

  // 添加文件头注释
  lines.push('# RecordEvo AI Provider Configuration');
  lines.push(`# Generated at: ${new Date().toISOString()}`);
  lines.push('');

  // 按字母顺序排序 key
  const sortedKeys = Object.keys(config).sort();

  for (const key of sortedKeys) {
    const value = config[key];
    lines.push(`${key}="${value}"`);
  }

  return lines.join('\n');
}

/**
 * 配置文件管理器类
 */
export class ConfigManager {
  private envFilePath: string;
  private cache: Record<string, string> | null = null;
  private cacheTimestamp: number = 0;
  private readonly CACHE_TTL = 5000; // 5 秒缓存

  constructor(envFilePath?: string) {
    this.envFilePath = envFilePath || path.resolve(process.cwd(), '.env');
  }

  /**
   * 读取 .env 文件
   */
  read(): Record<string, string> {
    // 检查缓存是否有效
    const now = Date.now();
    if (this.cache && now - this.cacheTimestamp < this.CACHE_TTL) {
      return { ...this.cache };
    }

    try {
      if (!fs.existsSync(this.envFilePath)) {
        this.cache = {};
        this.cacheTimestamp = now;
        return {};
      }

      const content = fs.readFileSync(this.envFilePath, 'utf-8');
      this.cache = parseEnvFile(content);
      this.cacheTimestamp = now;

      return { ...this.cache };
    } catch (error) {
      console.error('Failed to read .env file:', error);
      return {};
    }
  }

  /**
   * 写入 .env 文件
   */
  write(config: Record<string, string>): boolean {
    try {
      const content = stringifyEnvFile(config);
      fs.writeFileSync(this.envFilePath, content, 'utf-8');

      // 更新缓存
      this.cache = { ...config };
      this.cacheTimestamp = Date.now();

      return true;
    } catch (error) {
      console.error('Failed to write .env file:', error);
      return false;
    }
  }

  /**
   * 获取单个配置值
   */
  get(key: string): string | undefined {
    const config = this.read();
    return config[key];
  }

  /**
   * 设置单个配置值
   */
  set(key: string, value: string): boolean {
    const config = this.read();
    config[key] = value;
    return this.write(config);
  }

  /**
   * 删除配置值
   */
  delete(key: string): boolean {
    const config = this.read();
    if (config[key] === undefined) {
      return true; // 已经不存在
    }
    delete config[key];
    return this.write(config);
  }

  /**
   * 批量获取配置值（支持通配符）
   */
  getMany(prefix?: string): Record<string, string> {
    const config = this.read();

    if (!prefix) {
      return { ...config };
    }

    const result: Record<string, string> = {};
    const upperPrefix = prefix.toUpperCase();

    for (const [key, value] of Object.entries(config)) {
      if (key.startsWith(upperPrefix)) {
        result[key] = value;
      }
    }

    return result;
  }

  /**
   * 清除缓存
   */
  clearCache(): void {
    this.cache = null;
    this.cacheTimestamp = 0;
  }

  /**
   * 验证 .env 文件路径
   */
  getEnvFilePath(): string {
    return this.envFilePath;
  }

  /**
   * 检查 .env 文件是否存在
   */
  exists(): boolean {
    return fs.existsSync(this.envFilePath);
  }
}

// 导出单例实例
export const configManager = new ConfigManager();

/**
 * 更新 Provider 配置的辅助函数
 */
export async function updateProviderConfig(
  providerKey: string,
  updates: {
    apiKey?: string;
    apiEndpoint?: string;
    model?: string;
    maxToken?: number;
  }
): Promise<{ success: boolean; error?: string }> {
  try {
    const config = configManager.read();

    // 根据 provider key 确定环境变量名
    const upperKey = providerKey.toUpperCase();

    if (updates.apiKey !== undefined) {
      config[`${upperKey}_API_KEY`] = updates.apiKey;
    }

    if (updates.apiEndpoint !== undefined) {
      config[`${upperKey}_ENDPOINT`] = updates.apiEndpoint;
    }

    if (updates.model !== undefined) {
      config[`${upperKey}_MODEL`] = updates.model;
    }

    if (updates.maxToken !== undefined) {
      config[`${upperKey}_MAX_TOKENS`] = updates.maxToken.toString();
    }

    // 更新当前激活的 provider
    if (updates.apiKey !== undefined && updates.apiKey.trim() !== '') {
      config.AI_PROVIDER = providerKey;
    }

    const success = configManager.write(config);

    if (success) {
      // 清除缓存，确保下次读取时获取最新值
      configManager.clearCache();

      // 同时更新 process.env（当前进程生效）
      if (updates.apiKey !== undefined) {
        process.env[`${upperKey}_API_KEY`] = updates.apiKey;
      }
      if (updates.apiEndpoint !== undefined) {
        process.env[`${upperKey}_ENDPOINT`] = updates.apiEndpoint;
      }
      if (updates.model !== undefined) {
        process.env[`${upperKey}_MODEL`] = updates.model;
      }
      if (updates.maxToken !== undefined) {
        process.env[`${upperKey}_MAX_TOKENS`] = updates.maxToken.toString();
      }
      if (updates.apiKey !== undefined && updates.apiKey.trim() !== '') {
        process.env.AI_PROVIDER = providerKey;
      }
    }

    return { success };
  } catch (error) {
    console.error('Failed to update provider config:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}

/**
 * 获取所有 Provider 的配置状态
 */
export function getAllProviderStatus(): Array<{
  key: string;
  name: string;
  isConfigured: boolean;
  hasApiKey: boolean;
}> {
  const config = configManager.read();
  const result: Array<{
    key: string;
    name: string;
    isConfigured: boolean;
    hasApiKey: boolean;
  }> = [];

  const providerNames: Record<string, string> = {
    anthropic: 'Anthropic Claude',
    openai: 'OpenAI GPT',
    deepseek: 'DeepSeek',
    zhipu: 'Zhipu AI',
    kimi: 'Kimi',
    nvidia: 'NVIDIA NIM',
    vllm: 'vLLM',
    aliyun: '阿里云百炼',
    volcengine: '火山引擎',
    minimax: 'MiniMax',
    openrouter: 'OpenRouter'
  };

  for (const [key, name] of Object.entries(providerNames)) {
    const apiKey = config[`${key.toUpperCase()}_API_KEY`];
    const hasApiKey = !!apiKey && apiKey.trim() !== '';
    const isConfigured = hasApiKey && config.AI_PROVIDER === key;

    result.push({
      key,
      name,
      isConfigured,
      hasApiKey
    });
  }

  return result;
}
