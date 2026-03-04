/**
 * SQLite 数据库适配器
 *
 * 使用 better-sqlite3 实现本地数据库存储
 */

import Database from 'better-sqlite3';
type DatabaseType = Database.Database;

import * as path from 'path';
import * as fs from 'fs';
import {
  IDatabaseAdapter,
  QueryOptions,
  QueryResult,
  SingleResult
} from './database-adapter';
import { getSqliteSchema, SQLITE_INIT } from './sql-schema';

/**
 * SQLite 适配器配置
 */
export interface SQLiteConfig {
  dbPath: string;
}

/**
 * SQLite 适配器实现
 */
export class SQLiteAdapter implements IDatabaseAdapter {
  readonly name = 'sqlite';
  readonly isConnected = false;

  private db: DatabaseType | null = null;
  private config: SQLiteConfig;

  constructor(config?: SQLiteConfig) {
    this.config = {
      dbPath: config?.dbPath || './data/efficiency.db'
    };
  }

  /**
   * 初始化数据库
   */
  async initialize(): Promise<void> {
    try {
      // 确保目录存在
      const dir = path.dirname(this.config.dbPath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }

      // 连接数据库
      this.db = new Database(this.config.dbPath) as unknown as DatabaseType;

      // 启用外键
      (this.db as any).pragma('foreign_keys = ON');

      // 执行初始化脚本
      (this.db as any).exec(SQLITE_INIT);

      // 执行 Schema
      (this.db as any).exec(getSqliteSchema());

      console.log(`✅ SQLite 数据库已初始化：${this.config.dbPath}`);
    } catch (error) {
      console.error('SQLite 初始化失败:', error);
      throw error;
    }
  }

  /**
   * 查询多条记录
   */
  async select<T>(table: string, options?: QueryOptions): Promise<QueryResult<T>> {
    try {
      if (!this.db) {
        return { data: null, error: new Error('数据库未连接') };
      }

      let sql = `SELECT * FROM ${table}`;
      const params: any[] = [];

      // WHERE 条件
      if (options?.where) {
        const whereClauses: string[] = [];
        for (const [key, value] of Object.entries(options.where)) {
          if (value === null) {
            whereClauses.push(`${key} IS NULL`);
          } else {
            whereClauses.push(`${key} = ?`);
            params.push(value);
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
      if (options?.limit) {
        sql += ` LIMIT ?`;
        params.push(options.limit);
      }

      // OFFSET
      if (options?.offset) {
        sql += ` OFFSET ?`;
        params.push(options.offset);
      }

      const stmt = (this.db as any).prepare(sql);
      const data = stmt.all(...params) as T[];

      return { data, error: null };
    } catch (error) {
      console.error('SQLite select error:', error);
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
      if (!this.db) {
        return { data: null, error: new Error('数据库未连接') };
      }

      const columns = Object.keys(data);
      const values = columns.map(() => '?');
      const params = columns.map(key => data[key]);

      const sql = `INSERT INTO ${table} (${columns.join(', ')}) VALUES (${values.join(', ')})`;

      const stmt = (this.db as any).prepare(sql);
      const result = stmt.run(...params);

      // 返回插入的记录
      const lastId = result.lastInsertRowid;
      if (lastId) {
        const selectStmt = (this.db as any).prepare(`SELECT * FROM ${table} WHERE rowid = ?`);
        const inserted = selectStmt.get(lastId) as T;
        return { data: inserted, error: null };
      }

      return { data: null, error: new Error('无法获取插入的记录') };
    } catch (error) {
      console.error('SQLite insert error:', error);
      return { data: null, error: error as Error };
    }
  }

  /**
   * 更新记录
   */
  async update<T>(table: string, id: string, data: Record<string, any>): Promise<SingleResult<T>> {
    try {
      if (!this.db) {
        return { data: null, error: new Error('数据库未连接') };
      }

      const columns = Object.keys(data);
      const setClause = columns.map(key => `${key} = ?`).join(', ');
      const params = [...columns.map(key => data[key]), id];

      const sql = `UPDATE ${table} SET ${setClause} WHERE id = ?`;

      const stmt = (this.db as any).prepare(sql);
      stmt.run(...params);

      // 返回更新后的记录
      const selectStmt = (this.db as any).prepare(`SELECT * FROM ${table} WHERE id = ?`);
      const updated = selectStmt.get(id) as T;

      return { data: updated, error: null };
    } catch (error) {
      console.error('SQLite update error:', error);
      return { data: null, error: error as Error };
    }
  }

  /**
   * 删除记录
   */
  async delete<T>(table: string, id: string): Promise<{ success: boolean; error: Error | null }> {
    try {
      if (!this.db) {
        return { success: false, error: new Error('数据库未连接') };
      }

      const sql = `DELETE FROM ${table} WHERE id = ?`;
      const stmt = (this.db as any).prepare(sql);
      stmt.run(id);

      return { success: true, error: null };
    } catch (error) {
      console.error('SQLite delete error:', error);
      return { success: false, error: error as Error };
    }
  }

  /**
   * 执行原生 SQL 查询
   */
  async query<T>(sql: string, params?: any[]): Promise<QueryResult<T>> {
    try {
      if (!this.db) {
        return { data: null, error: new Error('数据库未连接') };
      }

      const stmt = (this.db as any).prepare(sql);
      const data = stmt.all(...(params || [])) as T[];

      return { data, error: null };
    } catch (error) {
      console.error('SQLite query error:', error);
      return { data: null, error: error as Error };
    }
  }

  /**
   * 关闭数据库连接
   */
  async close(): Promise<void> {
    if (this.db) {
      (this.db as any).close();
      this.db = null;
      console.log('SQLite 数据库已关闭');
    }
  }
}
