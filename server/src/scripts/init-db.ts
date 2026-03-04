/**
 * 数据库初始化脚本
 *
 * 用法：npm run db:init
 */

import { createDatabaseAdapter } from '../lib/database-factory';
import { SQLiteAdapter } from '../lib/sqlite-adapter';

async function main() {
  console.log('🚀 开始初始化数据库...');

  try {
    // 创建数据库适配器
    const adapter = createDatabaseAdapter();

    // 初始化
    await adapter.initialize();

    console.log('✅ 数据库初始化成功！');

    // 关闭连接
    await adapter.close();

    process.exit(0);
  } catch (error) {
    console.error('❌ 数据库初始化失败:', error);
    process.exit(1);
  }
}

main();
