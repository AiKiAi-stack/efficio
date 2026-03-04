/**
 * SQL Schema 定义
 *
 * 包含所有数据库的通用 Schema 定义
 */

import * as fs from 'fs';
import * as path from 'path';

/**
 * 读取 SQL 文件内容
 */
export function readSqlFile(filename: string): string {
  const sqlPath = path.join(__dirname, '../../sql', filename);
  return fs.readFileSync(sqlPath, 'utf-8');
}

/**
 * 获取 SQLite Schema
 */
export function getSqliteSchema(): string {
  return readSqlFile('sqlite-schema.sql');
}

/**
 * 获取 PostgreSQL Schema
 */
export function getPostgresSchema(): string {
  return readSqlFile('init.sql');
}

/**
 * SQLite 初始化脚本
 */
export const SQLITE_INIT = `
-- 启用外键支持
PRAGMA foreign_keys = ON;

-- 创建用户表（用于兼容性）
CREATE TABLE IF NOT EXISTS _migrations (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    version TEXT NOT NULL,
    applied_at TEXT DEFAULT (datetime('now'))
);
`;

/**
 * 检查 SQLite 表是否存在
 */
export function getSqliteTableCheckSql(tableName: string): string {
  return `SELECT name FROM sqlite_master WHERE type='table' AND name='${tableName}'`;
}
