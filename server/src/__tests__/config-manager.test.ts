/**
 * ConfigManager 测试
 *
 * 测试配置文件管理功能
 */

import { parseEnvFile, stringifyEnvFile, ConfigManager } from '../lib/config-manager';

describe('parseEnvFile', () => {
  it('应该正确解析 KEY=VALUE 格式', () => {
    const content = 'KEY1=value1\nKEY2=value2';
    const result = parseEnvFile(content);
    expect(result).toEqual({ KEY1: 'value1', KEY2: 'value2' });
  });

  it('应该跳过空行和注释', () => {
    const content = '# This is a comment\nKEY1=value1\n\nKEY2=value2';
    const result = parseEnvFile(content);
    expect(result).toEqual({ KEY1: 'value1', KEY2: 'value2' });
  });

  it('应该移除引号', () => {
    const content = 'KEY1="value1"\nKEY2=\'value2\'';
    const result = parseEnvFile(content);
    expect(result).toEqual({ KEY1: 'value1', KEY2: 'value2' });
  });

  it('应该处理带空格的值', () => {
    const content = 'KEY1 = value1 with spaces';
    const result = parseEnvFile(content);
    expect(result).toEqual({ KEY1: 'value1 with spaces' });
  });

  it('空内容应该返回空对象', () => {
    expect(parseEnvFile('')).toEqual({});
    expect(parseEnvFile('# only comment\n\n')).toEqual({});
  });
});

describe('stringifyEnvFile', () => {
  it('应该生成带时间戳的 .env 格式', () => {
    const config = { KEY1: 'value1', KEY2: 'value2' };
    const result = stringifyEnvFile(config);

    expect(result).toContain('# RecordEvo AI Provider Configuration');
    expect(result).toContain('KEY1="value1"');
    expect(result).toContain('KEY2="value2"');
  });

  it('应该按字母顺序排序 key', () => {
    const config = { ZEBRA: 'z', ALPHA: 'a', MIDDLE: 'm' };
    const result = stringifyEnvFile(config);
    const lines = result.split('\n').filter(line => line.includes('='));

    expect(lines[0]).toContain('ALPHA');
    expect(lines[1]).toContain('MIDDLE');
    expect(lines[2]).toContain('ZEBRA');
  });
});

describe('ConfigManager', () => {
  let configManager: ConfigManager;
  const testEnvPath = '/tmp/test-efficio.env';

  beforeEach(() => {
    configManager = new ConfigManager(testEnvPath);
    // 清理测试文件
    try {
      require('fs').unlinkSync(testEnvPath);
    } catch {}
  });

  afterEach(() => {
    // 清理测试文件
    try {
      require('fs').unlinkSync(testEnvPath);
    } catch {}
  });

  it('应该能读取不存在的文件并返回空对象', () => {
    const result = configManager.read();
    expect(result).toEqual({});
  });

  it('应该能写入和读取配置', () => {
    const config = { TEST_KEY: 'test_value', ANOTHER_KEY: 'another_value' };

    // 写入
    const writeSuccess = configManager.write(config);
    expect(writeSuccess).toBe(true);

    // 读取
    const result = configManager.read();
    expect(result.TEST_KEY).toBe('test_value');
    expect(result.ANOTHER_KEY).toBe('another_value');
  });

  it('应该能设置单个配置值', () => {
    configManager.set('SINGLE_KEY', 'single_value');
    expect(configManager.get('SINGLE_KEY')).toBe('single_value');
  });

  it('应该能删除配置值', () => {
    configManager.set('TO_DELETE', 'value');
    expect(configManager.get('TO_DELETE')).toBe('value');

    const deleteSuccess = configManager.delete('TO_DELETE');
    expect(deleteSuccess).toBe(true);
    expect(configManager.get('TO_DELETE')).toBeUndefined();
  });

  it('应该能批量获取配置（支持前缀过滤）', () => {
    configManager.write({
      API_KEY: 'key1',
      API_SECRET: 'secret1',
      OTHER_KEY: 'other1'
    });

    const all = configManager.getMany();
    expect(all).toHaveProperty('API_KEY');
    expect(all).toHaveProperty('API_SECRET');
    expect(all).toHaveProperty('OTHER_KEY');

    const apiOnly = configManager.getMany('API_');
    expect(apiOnly).toHaveProperty('API_KEY');
    expect(apiOnly).toHaveProperty('API_SECRET');
    expect(apiOnly).not.toHaveProperty('OTHER_KEY');
  });

  it('应该能清除缓存', () => {
    configManager.set('CACHED_KEY', 'cached_value');
    expect(configManager.get('CACHED_KEY')).toBe('cached_value');

    configManager.clearCache();
    // 缓存已清除，下次读取会从文件重新加载
  });

  it('应该能检查文件是否存在', () => {
    expect(configManager.exists()).toBe(false);

    configManager.write({ TEST: 'value' });
    expect(configManager.exists()).toBe(true);
  });
});
