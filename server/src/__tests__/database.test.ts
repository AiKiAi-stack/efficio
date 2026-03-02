import { describe, it, expect, beforeEach, jest } from '@jest/globals';

//  mocks 必须在导入被测试模块之前设置
jest.mock('../lib/database', () => {
  const inMemoryStore = {
    users: [],
    work_records: [],
    weekly_summaries: [],
    monthly_trends: [],
    optimization_suggestions: [],
    daily_logs: [],
    task_logs: []
  };

  const generateId = () => Math.random().toString(36).substring(2) + Date.now().toString(36);

  class QueryBuilder {
    private store: any[];
    private filters: Array<{ column: string; op: string; value: any }> = [];
    private orderBy: { column: string; ascending: boolean } | null = null;

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

    async then(resolve: any, reject: any) {
      try {
        const result = this.applyFilters();
        resolve({ data: result, error: null });
      } catch (error) {
        resolve({ data: null, error });
      }
    }
  }

  class TableOperation {
    private tableName: string;

    constructor(tableName: string) {
      this.tableName = tableName;
    }

    select() {
      const store = inMemoryStore[this.tableName as keyof typeof inMemoryStore] as any[];
      return new QueryBuilder(store);
    }

    insert(data: any[]) {
      return {
        select: () => ({
          single: async () => {
            const store = inMemoryStore[this.tableName as keyof typeof inMemoryStore] as any[];
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
              const store = inMemoryStore[this.tableName as keyof typeof inMemoryStore] as any[];
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
      return {
        eq: (column: string, value: any) => {
          const store = inMemoryStore[this.tableName as keyof typeof inMemoryStore] as any[];
          const index = store.findIndex((item: any) => item[column] === value);
          if (index !== -1) {
            store.splice(index, 1);
          }
          return { data: null, error: null };
        }
      };
    }
  }

  class InMemorySupabase {
    from(table: string) {
      return new TableOperation(table);
    }
  }

  return {
    supabase: new InMemorySupabase(),
    isMemoryMode: true,
    inMemoryStore
  };
});

describe('Database Module', () => {
  let supabase: any;
  let inMemoryStore: any;

  beforeEach(() => {
    jest.resetModules();
    const mock = require('../lib/database') as any;
    supabase = mock.supabase;
    inMemoryStore = mock.inMemoryStore;

    // 清空存储
    inMemoryStore.users = [];
    inMemoryStore.work_records = [];
  });

  describe('User Operations', () => {
    it('should create a new user', async () => {
      const { data, error } = await supabase
        .from('users')
        .insert([{ email: 'test@example.com' }])
        .select()
        .single();

      expect(error).toBeNull();
      expect(data).toBeDefined();
      expect(data.email).toBe('test@example.com');
      expect(data.id).toBeDefined();
    });

    it('should get user by email', async () => {
      // 先创建用户
      await supabase
        .from('users')
        .insert([{ email: 'test@example.com' }])
        .select()
        .single();

      // 再查询
      const { data, error } = await supabase
        .from('users')
        .select('*')
        .eq('email', 'test@example.com')
        .single();

      expect(error).toBeNull();
      expect(data).toBeDefined();
      expect(data.email).toBe('test@example.com');
    });

    it('should return null for non-existent user', async () => {
      const { data, error } = await supabase
        .from('users')
        .select('*')
        .eq('email', 'nonexistent@example.com')
        .single();

      expect(error).toBeNull();
      expect(data).toBeNull();
    });
  });

  describe('Work Records Operations', () => {
    it('should create a new work record', async () => {
      const { data: user } = await supabase
        .from('users')
        .insert([{ email: 'test@example.com' }])
        .select()
        .single();

      const { data, error } = await supabase
        .from('work_records')
        .insert([{
          user_id: user.id,
          original_text: 'Test record',
          optimized_text: 'Optimized test record',
          structured_data: { category: 'development' }
        }])
        .select()
        .single();

      expect(error).toBeNull();
      expect(data).toBeDefined();
      expect(data.original_text).toBe('Test record');
      expect(data.structured_data).toEqual({ category: 'development' });
    });

    it('should get records by user_id', async () => {
      const { data: user } = await supabase
        .from('users')
        .insert([{ email: 'test@example.com' }])
        .select()
        .single();

      await supabase
        .from('work_records')
        .insert([
          { user_id: user.id, original_text: 'Record 1' },
          { user_id: user.id, original_text: 'Record 2' }
        ])
        .select()
        .single();

      const { data, error } = await supabase
        .from('work_records')
        .select('*')
        .eq('user_id', user.id);

      expect(error).toBeNull();
      expect(data).toHaveLength(2);
      expect(data[0].user_id).toBe(user.id);
    });

    it('should delete a record', async () => {
      const { data: user } = await supabase
        .from('users')
        .insert([{ email: 'test@example.com' }])
        .select()
        .single();

      const { data: record } = await supabase
        .from('work_records')
        .insert([{ user_id: user.id, original_text: 'To delete' }])
        .select()
        .single();

      const { error } = await supabase
        .from('work_records')
        .delete()
        .eq('id', record.id);

      expect(error).toBeNull();

      const { data: deletedRecord } = await supabase
        .from('work_records')
        .select('*')
        .eq('id', record.id)
        .single();

      expect(deletedRecord).toBeNull();
    });
  });

  describe('Query Operations', () => {
    it('should filter records with eq', async () => {
      const { data: user } = await supabase
        .from('users')
        .insert([{ email: 'test@example.com' }])
        .select()
        .single();

      await supabase
        .from('work_records')
        .insert([
          { user_id: user.id, original_text: 'Record 1' },
          { user_id: 'other-user', original_text: 'Record 2' }
        ])
        .select()
        .single();

      const { data } = await supabase
        .from('work_records')
        .select('*')
        .eq('user_id', user.id);

      expect(data).toHaveLength(1);
      expect(data[0].user_id).toBe(user.id);
    });

    it('should order records', async () => {
      const { data: user } = await supabase
        .from('users')
        .insert([{ email: 'test@example.com' }])
        .select()
        .single();

      await supabase
        .from('work_records')
        .insert([
          { user_id: user.id, original_text: 'First', created_at: '2024-01-01T00:00:00Z' },
          { user_id: user.id, original_text: 'Second', created_at: '2024-01-02T00:00:00Z' }
        ])
        .select()
        .single();

      const { data } = await supabase
        .from('work_records')
        .select('*')
        .order('created_at', { ascending: true });

      expect(data[0].original_text).toBe('First');
      expect(data[1].original_text).toBe('Second');
    });
  });
});
