/**
 * 数据库工厂
 *
 * 根据配置创建相应的数据库适配器
 */

import { IDatabaseAdapter } from './database-adapter';
import { SQLiteAdapter } from './sqlite-adapter';
import { TursoAdapter } from './turso-adapter';
import { createInMemoryDatabase } from './database';

/**
 * 数据库配置
 */
export interface DatabaseFactoryConfig {
  mode?: 'memory' | 'sqlite' | 'turso' | 'supabase';
  sqlitePath?: string;
  tursoUrl?: string;
  tursoToken?: string;
}

/**
 * 创建数据库适配器
 *
 * @param config 配置选项
 * @returns 数据库适配器实例
 */
export function createDatabaseAdapter(config?: DatabaseFactoryConfig): IDatabaseAdapter {
  const mode = config?.mode || process.env.DATABASE_MODE || 'sqlite';

  console.log(`📀 数据库模式：${mode}`);

  switch (mode) {
    case 'sqlite': {
      const adapter = new SQLiteAdapter({
        dbPath: config?.sqlitePath || process.env.SQLITE_DB_PATH || './data/efficiency.db'
      });
      return adapter as any as IDatabaseAdapter;
    }

    case 'turso': {
      const tursoUrl = config?.tursoUrl || process.env.TURSO_DATABASE_URL;
      const tursoToken = config?.tursoToken || process.env.TURSO_AUTH_TOKEN;

      if (!tursoUrl || !tursoToken) {
        console.warn('⚠️ Turso 配置缺失，降级到 SQLite 模式');
        return createDatabaseAdapter({ mode: 'sqlite' });
      }

      const adapter = new TursoAdapter({
        url: tursoUrl,
        authToken: tursoToken
      });
      return adapter as any as IDatabaseAdapter;
    }

    case 'supabase': {
      // Supabase 配置缺失时降级到 SQLite
      const supabaseUrl = process.env.SUPABASE_URL;
      const supabaseKey = process.env.SUPABASE_SERVICE_KEY;

      if (!supabaseUrl || !supabaseKey || supabaseUrl === 'your_supabase_url') {
        console.warn('⚠️ Supabase 配置缺失，降级到 SQLite 模式');
        return createDatabaseAdapter({ mode: 'sqlite' });
      }

      // 使用现有的 Supabase 实现
      return createInMemoryDatabase() as any as IDatabaseAdapter;
    }

    case 'memory':
    default: {
      // 内存模式（降级模式）
      console.warn('⚠️ 使用内存模式，重启后数据会丢失');
      return createInMemoryDatabase() as any as IDatabaseAdapter;
    }
  }
}

/**
 * 获取当前数据库模式
 */
export function getDatabaseMode(): string {
  return process.env.DATABASE_MODE || 'sqlite';
}
