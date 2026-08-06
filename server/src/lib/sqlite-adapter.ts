/**
 * SQLite 数据库适配器
 *
 * 使用 better-sqlite3 实现本地数据库存储
 */

import Database from 'better-sqlite3';
type DatabaseType = Database.Database;

import * as crypto from 'crypto';
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

      // 存量库迁移：老库的 work_records 没有 jira_key 列
      this.migrateIfNeeded();

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

      // WHERE 条件（支持 { eq, gt, gte, lt, lte } 操作符对象）
      if (options?.where) {
        const whereClauses: string[] = [];
        const opMap: Record<string, string> = { eq: '=', gt: '>', gte: '>=', lt: '<', lte: '<=' };
        for (const [key, value] of Object.entries(options.where)) {
          if (value === null) {
            whereClauses.push(`${key} IS NULL`);
          } else if (typeof value === 'object' && !Array.isArray(value)) {
            for (const [op, v] of Object.entries(value as Record<string, any>)) {
              const sqlOp = opMap[op] || '=';
              whereClauses.push(`${key} ${sqlOp} ?`);
              params.push(v);
            }
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
      const data = (stmt.all(...params) as any[]).map(row => this.deserializeRow(row)) as T[];

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

      const row = { ...data } as Record<string, any>;
      if (!row.id) row.id = crypto.randomUUID();
      if (!row.created_at) row.created_at = new Date().toISOString();

      const columns = Object.keys(row);
      const values = columns.map(() => '?');
      const params = columns.map(key => this.serializeValue(row[key]));

      const sql = `INSERT INTO ${table} (${columns.join(', ')}) VALUES (${values.join(', ')})`;

      const stmt = (this.db as any).prepare(sql);
      const result = stmt.run(...params);

      // 返回插入的记录
      const lastId = result.lastInsertRowid;
      if (lastId) {
        const selectStmt = (this.db as any).prepare(`SELECT * FROM ${table} WHERE rowid = ?`);
        const inserted = selectStmt.get(lastId);
        return { data: this.deserializeRow(inserted) as T, error: null };
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
      const params = [...columns.map(key => this.serializeValue(data[key])), id];

      const sql = `UPDATE ${table} SET ${setClause} WHERE id = ?`;

      const stmt = (this.db as any).prepare(sql);
      stmt.run(...params);

      // 返回更新后的记录
      const selectStmt = (this.db as any).prepare(`SELECT * FROM ${table} WHERE id = ?`);
      const updated = selectStmt.get(id);

      return { data: this.deserializeRow(updated) as T, error: null };
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

  // ==================== 私有辅助 ====================

  /**
   * 存量库列迁移（CREATE TABLE IF NOT EXISTS 不会给已有表加列）
   */
  private migrateIfNeeded(): void {
    if (!this.db) return;

    const migrations: Array<{ table: string; column: string; ddl: string }> = [
      {
        table: 'work_records',
        column: 'jira_key',
        ddl: 'ALTER TABLE work_records ADD COLUMN jira_key TEXT'
      }
    ];

    for (const migration of migrations) {
      try {
        const columns = (this.db as any).pragma(`table_info(${migration.table})`) as any[];
        if (!columns.some((c: any) => c.name === migration.column)) {
          (this.db as any).exec(migration.ddl);
          console.log(`✅ 数据库迁移：${migration.table}.${migration.column} 已添加`);
        }
      } catch (error) {
        console.warn(`数据库迁移跳过 ${migration.table}.${migration.column}:`, error);
      }
    }
  }

  /**
   * 序列化值：对象/数组转为 JSON 字符串（SQLite 只有 TEXT 列存储 JSON 列）
   */
  private serializeValue(value: any): any {
    if (value !== null && typeof value === 'object') {
      return JSON.stringify(value);
    }
    return value;
  }

  /**
   * 反序列化值：形如 JSON 的字符串尝试解析（{ 或 [ 开头）
   */
  private deserializeValue(value: any): any {
    if (typeof value === 'string' && (value.startsWith('{') || value.startsWith('['))) {
      try {
        return JSON.parse(value);
      } catch {
        return value;
      }
    }
    return value;
  }

  /**
   * 反序列化整行记录
   */
  private deserializeRow(row: any): any {
    if (!row) return row;
    const out: Record<string, any> = {};
    for (const [key, value] of Object.entries(row)) {
      out[key] = this.deserializeValue(value);
    }
    return out;
  }
}
