/**
 * 内存数据库适配器
 *
 * 实现 IDatabaseAdapter 接口，数据保存在进程内存中。
 * 用于 DATABASE_MODE=memory 场景和测试（重启后数据丢失，启动时打印警告）。
 */

import * as crypto from 'crypto';
import {
  IDatabaseAdapter,
  QueryOptions,
  QueryResult,
  SingleResult
} from './database-adapter';

interface Store {
  [table: string]: any[];
}

const store: Store = {};

/**
 * 判断记录是否满足 where 条件
 * 支持 { eq, gt, gte, lt, lte } 操作符对象
 */
function matches(item: any, where?: Record<string, any>): boolean {
  if (!where) return true;
  return Object.entries(where).every(([key, condition]) => {
    if (condition !== null && typeof condition === 'object' && !Array.isArray(condition)) {
      const c = condition as Record<string, any>;
      const itemVal = item[key];
      const itemTime = () => new Date(itemVal).getTime();
      // 多操作符条件需同时满足（AND），与 SQLite 适配器的 WHERE ... AND ... 一致；
      // 早期实现命中第一个操作符即返回，导致 { gte, lt } 只应用 gte
      if ('eq' in c && itemVal !== c.eq) return false;
      if ('gt' in c && !(itemTime() > new Date(c.gt).getTime())) return false;
      if ('gte' in c && !(itemTime() >= new Date(c.gte).getTime())) return false;
      if ('lt' in c && !(itemTime() < new Date(c.lt).getTime())) return false;
      if ('lte' in c && !(itemTime() <= new Date(c.lte).getTime())) return false;
      return true;
    }
    return item[key] === condition;
  });
}

export class InMemoryAdapter implements IDatabaseAdapter {
  readonly name = 'memory';
  readonly isConnected = true;

  async initialize(): Promise<void> {
    console.warn('⚠️ 使用内存数据库模式，重启后数据会丢失');
  }

  private table(name: string): any[] {
    if (!store[name]) {
      store[name] = [];
    }
    return store[name];
  }

  async select<T>(table: string, options?: QueryOptions): Promise<QueryResult<T>> {
    let rows = this.table(table).filter(item => matches(item, options?.where));

    if (options?.orderBy) {
      const { column, direction } = options.orderBy;
      rows = [...rows].sort((a, b) => {
        const av = a[column];
        const bv = b[column];
        if (av == null) return 1;
        if (bv == null) return -1;
        if (av < bv) return direction === 'ASC' ? -1 : 1;
        if (av > bv) return direction === 'ASC' ? 1 : -1;
        return 0;
      });
    }

    if (options?.offset != null) {
      rows = rows.slice(options.offset);
    }
    if (options?.limit != null) {
      rows = rows.slice(0, options.limit);
    }

    return { data: rows as T[], error: null };
  }

  async selectSingle<T>(table: string, options?: QueryOptions): Promise<SingleResult<T>> {
    const res = await this.select<T>(table, { ...options, limit: 1 });
    return { data: res.data?.[0] ?? null, error: res.error };
  }

  async insert<T>(table: string, data: Record<string, any>): Promise<SingleResult<T>> {
    const row = {
      ...data,
      id: data.id || crypto.randomUUID(),
      created_at: data.created_at || new Date().toISOString()
    };
    this.table(table).push(row);
    return { data: row as T, error: null };
  }

  async update<T>(table: string, id: string, data: Record<string, any>): Promise<SingleResult<T>> {
    const rows = this.table(table);
    const idx = rows.findIndex(r => r.id === id);
    if (idx === -1) {
      return { data: null, error: null };
    }
    rows[idx] = { ...rows[idx], ...data, id, created_at: rows[idx].created_at };
    return { data: rows[idx] as T, error: null };
  }

  async delete<T>(table: string, id: string): Promise<{ success: boolean; error: Error | null }> {
    const rows = this.table(table);
    const idx = rows.findIndex(r => r.id === id);
    if (idx !== -1) {
      rows.splice(idx, 1);
    }
    return { success: true, error: null };
  }

  async query<T>(sql: string): Promise<QueryResult<T>> {
    // 内存模式仅支持简单的 SELECT * FROM table
    const match = sql.match(/FROM\s+([a-z_]+)/i);
    if (match) {
      return this.select<T>(match[1]);
    }
    return { data: [], error: new Error('内存模式不支持原生 SQL') };
  }

  async close(): Promise<void> {
    // 内存模式无需关闭
  }
}

/**
 * 清空内存存储（测试用）
 */
export function resetInMemoryStore(): void {
  for (const key of Object.keys(store)) {
    delete store[key];
  }
}
