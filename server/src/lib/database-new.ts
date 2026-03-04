/**
 * 数据库统一导出模块
 *
 * 为了兼容现有代码，同时支持新的数据库工厂模式
 */

import { createDatabaseAdapter, getDatabaseMode } from './database-factory';
import { IDatabaseAdapter } from './database-adapter';
import { supabase, isMemoryMode, createInMemoryDatabase, inMemoryStore } from './database';

/**
 * 当前数据库适配器实例
 */
export let dbAdapter: IDatabaseAdapter | null = null;

/**
 * 初始化数据库
 */
export async function initializeDatabase(): Promise<void> {
  const mode = getDatabaseMode();

  if (mode === 'sqlite' || mode === 'turso') {
    // 使用新的适配器模式
    dbAdapter = createDatabaseAdapter();
    await dbAdapter.initialize();
    console.log(`✅ 数据库已初始化：${dbAdapter.name}`);
  } else {
    // 使用现有的内存/Supabase 模式
    dbAdapter = null;
    console.log(`✅ 数据库模式：${mode}`);
  }
}

/**
 * 获取数据库适配器
 * 如果未初始化，返回内存适配器
 */
export function getDatabase(): IDatabaseAdapter {
  if (!dbAdapter) {
    dbAdapter = createInMemoryDatabase() as any as IDatabaseAdapter;
  }
  return dbAdapter;
}

// 导出原有兼容 API
export { supabase, isMemoryMode, createInMemoryDatabase, inMemoryStore };

// 导出工厂函数
export { createDatabaseAdapter, getDatabaseMode };

// 导出适配器接口和实现
export { IDatabaseAdapter, QueryOptions, QueryResult, SingleResult } from './database-adapter';
export { SQLiteAdapter } from './sqlite-adapter';
export { TursoAdapter } from './turso-adapter';
