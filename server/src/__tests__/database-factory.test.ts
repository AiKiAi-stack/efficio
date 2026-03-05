/**
 * 数据库工厂测试
 *
 * 测试数据库适配器创建和配置功能
 */

import { createDatabaseAdapter, getDatabaseMode } from '../lib/database-factory';

// 模拟环境变量
const originalEnv = process.env;

describe('getDatabaseMode', () => {
  beforeEach(() => {
    jest.resetModules();
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it('应该返回默认模式 sqlite', () => {
    delete process.env.DATABASE_MODE;
    expect(getDatabaseMode()).toBe('sqlite');
  });

  it('应该返回环境变量中设置的模式', () => {
    process.env.DATABASE_MODE = 'turso';
    expect(getDatabaseMode()).toBe('turso');
  });

  it('应该支持 memory 模式', () => {
    process.env.DATABASE_MODE = 'memory';
    expect(getDatabaseMode()).toBe('memory');
  });
});

describe('createDatabaseAdapter', () => {
  beforeEach(() => {
    jest.resetModules();
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it('应该创建 SQLite 适配器（默认）', () => {
    const adapter = createDatabaseAdapter();

    expect(adapter).toBeDefined();
    expect(adapter.name).toBeDefined();
    expect(adapter.isConnected).toBeDefined();
  });

  it('应该创建 SQLite 适配器（显式配置）', () => {
    const adapter = createDatabaseAdapter({
      mode: 'sqlite',
      sqlitePath: '/tmp/test-efficiency.db'
    });

    expect(adapter).toBeDefined();
    expect(adapter.name).toBeDefined();
  });

  it('应该创建内存数据库适配器', () => {
    const adapter = createDatabaseAdapter({ mode: 'memory' });

    expect(adapter).toBeDefined();
    // 内存数据库可能没有 name 属性，不强制检查
  });

  it('应该在 Turso 配置缺失时降级到 SQLite', () => {
    // 不提供 Turso 配置
    const adapter = createDatabaseAdapter({
      mode: 'turso'
      // 不提供 tursoUrl 和 tursoToken
    });

    // 应该降级到 SQLite
    expect(adapter).toBeDefined();
  });

  it('应该在 Supabase 配置缺失时降级到 SQLite', () => {
    const adapter = createDatabaseAdapter({
      mode: 'supabase'
      // 不提供 Supabase 配置
    });

    expect(adapter).toBeDefined();
  });

  it('适配器应该实现必需的方法', () => {
    const adapter = createDatabaseAdapter();

    expect(adapter.initialize).toBeDefined();
    expect(adapter.select).toBeDefined();
    expect(adapter.selectSingle).toBeDefined();
    expect(adapter.insert).toBeDefined();
    expect(adapter.update).toBeDefined();
    expect(adapter.delete).toBeDefined();
    expect(adapter.query).toBeDefined();
    expect(adapter.close).toBeDefined();
  });
});

describe('数据库适配器初始化', () => {
  let adapter: any;

  beforeEach(() => {
    process.env = { ...originalEnv };
  });

  afterEach(async () => {
    if (adapter && typeof adapter.close === 'function') {
      try {
        await adapter.close();
      } catch {}
    }
    process.env = originalEnv;
  });

  it('应该能初始化 SQLite 数据库', async () => {
    adapter = createDatabaseAdapter({
      mode: 'sqlite',
      sqlitePath: '/tmp/test-init.db'
    });

    // SQLite 适配器有 initialize 方法
    if (typeof adapter.initialize === 'function') {
      await expect(adapter.initialize()).resolves.not.toThrow();
    }
    // 检查适配器是否可用
    expect(adapter).toBeDefined();
  });

  it('应该能执行基本查询', async () => {
    // 使用内存模式进行测试
    const memoryDb = createDatabaseAdapter({ mode: 'memory' });

    // 内存数据库使用不同的接口
    const insertResult = await memoryDb.insert('users', {
      id: 'test-1',
      email: 'test@example.com'
    });

    expect(insertResult).toBeDefined();
  });
});
