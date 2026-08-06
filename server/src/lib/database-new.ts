/**
 * 数据库统一导出模块
 *
 * 所有业务路由通过 getDatabase() 获取数据库适配器。
 * 默认 SQLite 持久化；DATABASE_MODE=memory 时使用内存适配器（测试场景）。
 */

import { createDatabaseAdapter, getDatabaseMode } from './database-factory';
import { IDatabaseAdapter } from './database-adapter';
import { InMemoryAdapter } from './in-memory-adapter';

/**
 * 当前数据库适配器实例
 */
export let dbAdapter: IDatabaseAdapter | null = null;

/**
 * 初始化数据库
 */
export async function initializeDatabase(): Promise<void> {
  dbAdapter = createDatabaseAdapter();
  await dbAdapter.initialize();
  console.log(`✅ 数据库已初始化：${dbAdapter.name}`);
}

/**
 * 获取数据库适配器
 * 如果未初始化，惰性创建内存适配器（测试环境直接挂载路由时使用）
 */
export function getDatabase(): IDatabaseAdapter {
  if (!dbAdapter) {
    dbAdapter = new InMemoryAdapter();
  }
  return dbAdapter;
}

// 导出工厂函数
export { createDatabaseAdapter, getDatabaseMode };

// 导出适配器接口和实现
export { IDatabaseAdapter, QueryOptions, QueryResult, SingleResult } from './database-adapter';
export { SQLiteAdapter } from './sqlite-adapter';
export { TursoAdapter } from './turso-adapter';
export { InMemoryAdapter, resetInMemoryStore } from './in-memory-adapter';
export { SupabaseAdapter } from './supabase-adapter';
