/**
 * Supabase 数据库适配器
 *
 * 将 IDatabaseAdapter 接口映射到 supabase-js 客户端（PostgreSQL）。
 */

import * as crypto from 'crypto';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import {
  IDatabaseAdapter,
  QueryOptions,
  QueryResult,
  SingleResult
} from './database-adapter';

/**
 * Supabase 适配器配置
 */
export interface SupabaseConfig {
  url: string;
  serviceKey: string;
}

/**
 * Supabase 适配器实现
 */
export class SupabaseAdapter implements IDatabaseAdapter {
  readonly name = 'supabase';
  readonly isConnected = false;

  private client: SupabaseClient | null = null;
  private config: SupabaseConfig;

  constructor(config: SupabaseConfig) {
    this.config = config;
  }

  /**
   * 初始化数据库
   */
  async initialize(): Promise<void> {
    this.client = createClient(this.config.url, this.config.serviceKey);
    console.log(`✅ Supabase 数据库已连接：${this.config.url}`);
  }

  private applyWhere(query: any, where?: Record<string, any>): any {
    if (!where) return query;
    for (const [key, condition] of Object.entries(where)) {
      if (condition !== null && typeof condition === 'object' && !Array.isArray(condition)) {
        const c = condition as Record<string, any>;
        if ('eq' in c) query = query.eq(key, c.eq);
        if ('gt' in c) query = query.gt(key, c.gt);
        if ('gte' in c) query = query.gte(key, c.gte);
        if ('lt' in c) query = query.lt(key, c.lt);
        if ('lte' in c) query = query.lte(key, c.lte);
      } else {
        query = query.eq(key, condition);
      }
    }
    return query;
  }

  async select<T>(table: string, options?: QueryOptions): Promise<QueryResult<T>> {
    if (!this.client) {
      return { data: null, error: new Error('Supabase 未连接') };
    }
    try {
      let query = this.client.from(table).select('*');
      query = this.applyWhere(query, options?.where);

      if (options?.orderBy) {
        query = query.order(options.orderBy.column, {
          ascending: options.orderBy.direction === 'ASC'
        });
      }
      if (options?.limit != null) {
        query = query.limit(options.limit);
      }
      if (options?.offset != null) {
        query = query.range(options.offset, options.offset + (options.limit || 100) - 1);
      }

      const { data, error } = await query;
      if (error) throw error;
      return { data: (data as T[]) || [], error: null };
    } catch (error) {
      return { data: null, error: error as Error };
    }
  }

  async selectSingle<T>(table: string, options?: QueryOptions): Promise<SingleResult<T>> {
    const res = await this.select<T>(table, { ...options, limit: 1 });
    if (res.error) {
      return { data: null, error: res.error };
    }
    return { data: res.data?.[0] || null, error: null };
  }

  async insert<T>(table: string, data: Record<string, any>): Promise<SingleResult<T>> {
    if (!this.client) {
      return { data: null, error: new Error('Supabase 未连接') };
    }
    try {
      const row = {
        ...data,
        id: data.id || crypto.randomUUID(),
        created_at: data.created_at || new Date().toISOString()
      };
      const { data: inserted, error } = await this.client
        .from(table)
        .insert([row])
        .select()
        .single();
      if (error) throw error;
      return { data: (inserted as T) || null, error: null };
    } catch (error) {
      return { data: null, error: error as Error };
    }
  }

  async update<T>(table: string, id: string, data: Record<string, any>): Promise<SingleResult<T>> {
    if (!this.client) {
      return { data: null, error: new Error('Supabase 未连接') };
    }
    try {
      const { data: updated, error } = await this.client
        .from(table)
        .update(data)
        .eq('id', id)
        .select()
        .single();
      if (error) throw error;
      return { data: (updated as T) || null, error: null };
    } catch (error) {
      return { data: null, error: error as Error };
    }
  }

  async delete<T>(table: string, id: string): Promise<{ success: boolean; error: Error | null }> {
    if (!this.client) {
      return { success: false, error: new Error('Supabase 未连接') };
    }
    try {
      const { error } = await this.client.from(table).delete().eq('id', id);
      if (error) throw error;
      return { success: true, error: null };
    } catch (error) {
      return { success: false, error: error as Error };
    }
  }

  async query<T>(sql: string): Promise<QueryResult<T>> {
    return { data: null, error: new Error('Supabase 适配器不支持原生 SQL，请使用 RPC') };
  }

  async close(): Promise<void> {
    // supabase-js 无需显式关闭
  }
}
