import { createClient, SupabaseClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY;

// 内存存储（降级模式）
interface InMemoryUser {
  id: string;
  email: string;
  created_at: string;
}

interface InMemoryRecord {
  id: string;
  user_id: string;
  original_text: string;
  optimized_text: string | null;
  structured_data: any | null;
  created_at: string;
}

interface InMemorySummary {
  id: string;
  user_id: string;
  week_start: string;
  week_end: string;
  summary_data: any;
  markdown_content: string;
  created_at: string;
}

interface InMemoryDailyLog {
  id: string;
  user_id: string;
  log_date: string;
  goals: string | null;
  goal_priority: any | null;
  start_time: string | null;
  end_time: string | null;
  accomplishments: string | null;
  reflection: string | null;
  lessons_learned: any | null;
  improvement_plan: string | null;
  mood_score: number | null;
  energy_level: string | null;
  structured_data: any | null;
  created_at: string;
  updated_at: string;
}

interface InMemoryTaskLog {
  id: string;
  user_id: string;
  task_title: string;
  task_description: string | null;
  task_category: string | null;
  start_time: string | null;
  end_time: string | null;
  status: string;
  outcome: string | null;
  reflection: string | null;
  time_spent_minutes: number | null;
  priority: string | null;
  tags: string[] | null;
  created_at: string;
  updated_at: string;
}

interface InMemoryStore {
  users: InMemoryUser[];
  work_records: InMemoryRecord[];
  weekly_summaries: InMemorySummary[];
  monthly_trends: any[];
  optimization_suggestions: any[];
  daily_logs: InMemoryDailyLog[];
  task_logs: InMemoryTaskLog[];
}

// 全局内存存储
const inMemoryStore: InMemoryStore = {
  users: [],
  work_records: [],
  weekly_summaries: [],
  monthly_trends: [],
  optimization_suggestions: [],
  daily_logs: [],
  task_logs: []
};

// 生成 UUID
function generateId(): string {
  return Math.random().toString(36).substring(2) + Date.now().toString(36);
}

// 查询构建器类
class QueryBuilder {
  private store: any[];
  private filters: Array<{ column: string; op: string; value: any }> = [];
  private orderBy: { column: string; ascending: boolean } | null = null;
  private singleResult = false;

  constructor(store: any[]) {
    this.store = store;
  }

  eq(column: string, value: any) {
    this.filters.push({ column, op: 'eq', value });
    return this;
  }

  gte(column: string, value: any) {
    this.filters.push({ column, op: 'gte', value });
    return this;
  }

  lt(column: string, value: any) {
    this.filters.push({ column, op: 'lt', value });
    return this;
  }

  lte(column: string, value: any) {
    this.filters.push({ column, op: 'lte', value });
    return this;
  }

  order(column: string, { ascending }: { ascending: boolean }) {
    this.orderBy = { column, ascending };
    return this;
  }

  limit(count: number) {
    return this;
  }

  private applyFilters(): any[] {
    let result = [...this.store];

    for (const filter of this.filters) {
      result = result.filter(item => {
        const itemValue = item[filter.column];
        switch (filter.op) {
          case 'eq':
            return itemValue === filter.value;
          case 'gte':
            return new Date(itemValue).toISOString() >= filter.value;
          case 'lt':
            return new Date(itemValue).toISOString() < filter.value;
          case 'lte':
            return new Date(itemValue).toISOString() <= filter.value;
          default:
            return true;
        }
      });
    }

    if (this.orderBy) {
      result.sort((a, b) => {
        const aVal = a[this.orderBy!.column];
        const bVal = b[this.orderBy!.column];
        if (aVal < bVal) return this.orderBy!.ascending ? -1 : 1;
        if (aVal > bVal) return this.orderBy!.ascending ? 1 : -1;
        return 0;
      });
    }

    return result;
  }

  async single() {
    const result = this.applyFilters();
    return { data: result.length > 0 ? result[0] : null, error: null };
  }

  // 实现 then 方法以支持 await - 返回正确的 Promise 类型
  then<TResult1 = any, TResult2 = never>(
    resolve?: ((value: any) => TResult1 | PromiseLike<TResult1>) | undefined | null,
    reject?: ((reason: any) => TResult2 | PromiseLike<TResult2>) | undefined | null
  ): PromiseLike<TResult1 | TResult2> {
    try {
      const result = this.applyFilters();
      return Promise.resolve({ data: result, error: null }).then(resolve, reject);
    } catch (error) {
      return Promise.resolve({ data: null, error }).then(resolve, reject);
    }
  }
}

// 表操作类
class TableOperation {
  private tableName: string;

  constructor(tableName: string) {
    this.tableName = tableName;
  }

  select(columns: string = '*') {
    const store = inMemoryStore[this.tableName as keyof InMemoryStore] as any[];
    return new QueryBuilder(store);
  }

  insert(data: any[]) {
    return {
      select: () => ({
        single: async () => {
          const store = inMemoryStore[this.tableName as keyof InMemoryStore] as any[];
          const newRecords = data.map(item => ({
            ...item,
            id: item.id || generateId(),
            created_at: item.created_at || new Date().toISOString()
          }));
          store.push(...newRecords);
          return { data: newRecords[0] || null, error: null };
        }
      })
    };
  }

  update(data: any) {
    return {
      eq: (column: string, value: any) => ({
        select: () => ({
          single: async () => {
            const store = inMemoryStore[this.tableName as keyof InMemoryStore] as any[];
            const item = store.find((item: any) => item[column] === value);
            if (item) {
              Object.assign(item, data);
            }
            return { data: item || null, error: null };
          }
        })
      })
    };
  }

  delete() {
    const self = this;
    return {
      eq: (column: string, value: any) => {
        return {
          eq: (column2: string, value2: any) => {
            const store = inMemoryStore[self.tableName as keyof typeof inMemoryStore] as any[];
            const index = store.findIndex((item: any) => item[column] === value && item[column2] === value2);
            if (index !== -1) {
              store.splice(index, 1);
            }
            return Promise.resolve({ data: null, error: null });
          },
          then: (resolve: any, reject: any) => {
            const store = inMemoryStore[self.tableName as keyof typeof inMemoryStore] as any[];
            const index = store.findIndex((item: any) => item[column] === value);
            if (index !== -1) {
              store.splice(index, 1);
            }
            return Promise.resolve({ data: null, error: null }).then(resolve, reject);
          }
        };
      }
    };
  }
}

// Supabase 适配器的内存实现
class InMemorySupabase {
  from(table: string) {
    return new TableOperation(table);
  }
}

// 导出 supabase 实例（可能是真实的或内存的）
export let supabase: SupabaseClient | InMemorySupabase;
export let isMemoryMode = false;

if (supabaseUrl && supabaseServiceKey) {
  supabase = createClient(supabaseUrl, supabaseServiceKey);
  console.log('✅ 使用 Supabase 数据库');
} else {
  supabase = new InMemorySupabase() as any;
  isMemoryMode = true;
  console.log('⚠️  Supabase 未配置，使用内存存储模式（重启后数据会丢失）');
}

// 导出内存存储供其他模块使用
export { inMemoryStore };
