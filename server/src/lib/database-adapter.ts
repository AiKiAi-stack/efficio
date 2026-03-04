/**
 * 数据库适配器接口
 *
 * 所有数据库实现必须遵循此接口
 * 支持：SQLite, Turso, Supabase, Memory
 */

/**
 * 查询选项接口
 */
export interface QueryOptions {
  where?: Record<string, any>;
  orderBy?: { column: string; direction: 'ASC' | 'DESC' };
  limit?: number;
  offset?: number;
}

/**
 * 查询结果接口
 */
export interface QueryResult<T = any> {
  data: T[] | null;
  error: Error | null;
}

/**
 * 单条记录结果
 */
export interface SingleResult<T = any> {
  data: T | null;
  error: Error | null;
}

/**
 * 数据库适配器接口
 */
export interface IDatabaseAdapter {
  /**
   * 数据库名称/标识
   */
  readonly name: string;

  /**
   * 是否已连接
   */
  readonly isConnected: boolean;

  /**
   * 初始化数据库（创建表等）
   */
  initialize(): Promise<void>;

  /**
   * 查询多条记录
   * @param table 表名
   * @param options 查询选项
   */
  select<T>(table: string, options?: QueryOptions): Promise<QueryResult<T>>;

  /**
   * 查询单条记录
   * @param table 表名
   * @param options 查询选项
   */
  selectSingle<T>(table: string, options?: QueryOptions): Promise<SingleResult<T>>;

  /**
   * 插入记录
   * @param table 表名
   * @param data 数据对象
   */
  insert<T>(table: string, data: Record<string, any>): Promise<SingleResult<T>>;

  /**
   * 更新记录
   * @param table 表名
   * @param id 记录 ID
   * @param data 更新数据
   */
  update<T>(table: string, id: string, data: Record<string, any>): Promise<SingleResult<T>>;

  /**
   * 删除记录
   * @param table 表名
   * @param id 记录 ID
   */
  delete<T>(table: string, id: string): Promise<{ success: boolean; error: Error | null }>;

  /**
   * 执行原生 SQL 查询
   * @param sql SQL 语句
   * @param params 参数数组
   */
  query<T>(sql: string, params?: any[]): Promise<QueryResult<T>>;

  /**
   * 关闭数据库连接
   */
  close(): Promise<void>;
}

/**
 * 数据库配置接口
 */
export interface DatabaseConfig {
  mode: 'memory' | 'sqlite' | 'turso' | 'supabase';
  sqlitePath?: string;
  tursoUrl?: string;
  tursoToken?: string;
  supabaseUrl?: string;
  supabaseKey?: string;
}
