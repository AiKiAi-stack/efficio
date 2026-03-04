/**
 * Turso 数据库适配器
 *
 * 使用 @libsql/client 实现云端数据库存储
 * Turso 是基于 SQLite 的云端数据库服务
 * 网站：https://turso.tech
 */

import { createClient, Client } from '@libsql/client';
import {
  IDatabaseAdapter,
  QueryOptions,
  QueryResult,
  SingleResult
} from './database-adapter';
import { getSqliteSchema } from './sql-schema';

/**
 * Turso 适配器配置
 */
export interface TursoConfig {
  url: string;
  authToken: string;
}

/**
 * Turso 适配器实现
 */
export class TursoAdapter implements IDatabaseAdapter {
  readonly name = 'turso';
  readonly isConnected = false;

  private client: Client | null = null;
  private config: TursoConfig;

  constructor(config: TursoConfig) {
    this.config = config;
  }

  /**
   * 初始化数据库
   */
  async initialize(): Promise<void> {
    try {
      // 创建客户端
      this.client = createClient({
        url: this.config.url,
        authToken: this.config.authToken
      });

      // 执行 Schema（如果表不存在）
      const schema = getSqliteSchema();
      await this.client.execute(schema);

      console.log(`✅ Turso 数据库已连接：${this.config.url}`);
    } catch (error) {
      console.error('Turso 初始化失败:', error);
      throw error;
    }
  }

  /**
   * 查询多条记录
   */
  async select<T>(table: string, options?: QueryOptions): Promise<QueryResult<T>> {
    try {
      if (!this.client) {
        return { data: null, error: new Error('数据库未连接') };
      }

      let sql = `SELECT * FROM ${table}`;
      const args: any[] = [];

      // WHERE 条件
      if (options?.where) {
        const whereClauses: string[] = [];
        for (const [key, value] of Object.entries(options.where)) {
          if (value === null) {
            whereClauses.push(`${key} IS NULL`);
          } else {
            whereClauses.push(`${key} = ?`);
            args.push(value);
          }
        }
        if (whereClauses.length > 0) {
          sql += ` WHERE ${whereClauses.join(' AND ')}`;
        }
      }

      // ORDER BY
      if (options?.orderBy) {
        sql += ` ORDER BY ${options.orderBy.column} ${options.orderBy.direction}`;
      }

      // LIMIT
      if (options?.limit !== undefined) {
        sql += ` LIMIT ?`;
        args.push(options.limit);
      }

      // OFFSET
      if (options?.offset !== undefined) {
        sql += ` OFFSET ?`;
        args.push(options.offset);
      }

      const result = await this.client.execute({ sql, args });

      const data = result.rows.map(row => {
        const obj: any = {};
        result.columns?.forEach((col, i) => {
          obj[col] = row[i];
        });
        return obj as T;
      });

      return { data, error: null };
    } catch (error) {
      console.error('Turso select error:', error);
      return { data: null, error: error as Error };
    }
  }

  /**
   * 查询单条记录
   */
  async selectSingle<T>(table: string, options?: QueryOptions): Promise<SingleResult<T>> {
    try {
      const result = await this.select<T>(table, { ...options, limit: 1 });
      if (result.error) {
        return { data: null, error: result.error };
      }
      return { data: result.data?.[0] || null, error: null };
    } catch (error) {
      return { data: null, error: error as Error };
    }
  }

  /**
   * 插入记录
   */
  async insert<T>(table: string, data: Record<string, any>): Promise<SingleResult<T>> {
    try {
      if (!this.client) {
        return { data: null, error: new Error('数据库未连接') };
      }

      const columns = Object.keys(data);
      const values = columns.map(() => '?');
      const args = columns.map(key => data[key]);

      const sql = `INSERT INTO ${table} (${columns.join(', ')}) VALUES (${values.join(', ')})`;

      await this.client.execute({ sql, args });

      // 返回插入的记录（使用 lastInsertRowid）
      const idResult = await this.client.execute('SELECT last_insert_rowid()');
      const lastId = idResult.rows[0]?.[0];

      if (lastId) {
        const selectResult = await this.client.execute({
          sql: `SELECT * FROM ${table} WHERE rowid = ?`,
          args: [lastId]
        });

        const inserted = selectResult.rows[0] as any;
        const obj: any = {};
        selectResult.columns?.forEach((col, i) => {
          obj[col] = inserted[i];
        });

        return { data: obj as T, error: null };
      }

      return { data: null, error: new Error('无法获取插入的记录') };
    } catch (error) {
      console.error('Turso insert error:', error);
      return { data: null, error: error as Error };
    }
  }

  /**
   * 更新记录
   */
  async update<T>(table: string, id: string, data: Record<string, any>): Promise<SingleResult<T>> {
    try {
      if (!this.client) {
        return { data: null, error: new Error('数据库未连接') };
      }

      const columns = Object.keys(data);
      const setClause = columns.map(key => `${key} = ?`).join(', ');
      const args = [...columns.map(key => data[key]), id];

      const sql = `UPDATE ${table} SET ${setClause} WHERE id = ?`;

      await this.client.execute({ sql, args });

      // 返回更新后的记录
      const result = await this.client.execute({
        sql: `SELECT * FROM ${table} WHERE id = ?`,
        args: [id]
      });

      const row = result.rows[0] as any;
      const obj: any = {};
      result.columns?.forEach((col, i) => {
        obj[col] = row[i];
      });

      return { data: obj as T, error: null };
    } catch (error) {
      console.error('Turso update error:', error);
      return { data: null, error: error as Error };
    }
  }

  /**
   * 删除记录
   */
  async delete<T>(table: string, id: string): Promise<{ success: boolean; error: Error | null }> {
    try {
      if (!this.client) {
        return { success: false, error: new Error('数据库未连接') };
      }

      const sql = `DELETE FROM ${table} WHERE id = ?`;
      await this.client.execute({ sql, args: [id] });

      return { success: true, error: null };
    } catch (error) {
      console.error('Turso delete error:', error);
      return { success: false, error: error as Error };
    }
  }

  /**
   * 执行原生 SQL 查询
   */
  async query<T>(sql: string, params?: any[]): Promise<QueryResult<T>> {
    try {
      if (!this.client) {
        return { data: null, error: new Error('数据库未连接') };
      }

      const result = await this.client.execute({ sql, args: params || [] });

      const data = result.rows.map(row => {
        const obj: any = {};
        result.columns?.forEach((col, i) => {
          obj[col] = row[i];
        });
        return obj as T;
      });

      return { data, error: null };
    } catch (error) {
      console.error('Turso query error:', error);
      return { data: null, error: error as Error };
    }
  }

  /**
   * 关闭数据库连接
   */
  async close(): Promise<void> {
    if (this.client) {
      await this.client.close();
      this.client = null;
      console.log('Turso 数据库连接已关闭');
    }
  }
}
