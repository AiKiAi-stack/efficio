/**
 * 结构化日志模块
 *
 * - 输出到 stdout 与固定路径日志文件（EFFICIO_LOG_DIR，默认 ~/.config/efficio/logs/efficio.log）
 * - 简单大小轮转（超过 5MB 滚动为 .1/.2，保留 3 份）
 * - 内存环形缓冲最近错误（供 /api/system/recent-errors 查看，可追溯）
 * - 启动时补丁 console.error/warn，全库既有日志自动落文件
 * - 通过 AsyncLocalStorage 关联每个请求的 request-id（可追溯）
 */

import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import * as crypto from 'crypto';
import { AsyncLocalStorage } from 'async_hooks';
import { NextFunction, Request, Response } from 'express';

export const LOG_DIR = process.env.EFFICIO_LOG_DIR || path.join(os.homedir(), '.config', 'efficio', 'logs');
export const LOG_FILE = path.join(LOG_DIR, 'efficio.log');

const MAX_LOG_SIZE = 5 * 1024 * 1024; // 5MB
const MAX_LOG_FILES = 3;
const MAX_RECENT_ERRORS = 100;

const LEVELS: Record<string, number> = { debug: 10, info: 20, warn: 30, error: 40 };

let logLevel = LEVELS[process.env.LOG_LEVEL || 'info'] ?? LEVELS.info;

export function setLogLevel(level: string): void {
  logLevel = LEVELS[level] ?? LEVELS.info;
}

// ============ 最近错误环形缓冲（可追溯） ============

export interface RecentErrorEntry {
  time: string;
  level: string;
  message: string;
  stack?: string;
  requestId?: string;
  path?: string;
}

const recentErrors: RecentErrorEntry[] = [];

export function getRecentErrors(limit = 20): RecentErrorEntry[] {
  return recentErrors.slice(-limit).reverse();
}

// ============ 请求上下文（request-id 关联） ============

interface RequestStore {
  requestId: string;
  path: string;
}

export const requestContext = new AsyncLocalStorage<RequestStore>();

function currentRequest(): RequestStore | undefined {
  return requestContext.getStore();
}

// ============ 文件写入与轮转 ============

function rotateIfNeeded(): void {
  try {
    const stat = fs.statSync(LOG_FILE);
    if (stat.size < MAX_LOG_SIZE) return;
    for (let i = MAX_LOG_FILES - 1; i >= 1; i--) {
      const from = `${LOG_FILE}.${i - 1}`;
      const to = `${LOG_FILE}.${i}`;
      if (fs.existsSync(from)) {
        fs.renameSync(from, to);
      }
    }
    fs.renameSync(LOG_FILE, `${LOG_FILE}.1`);
  } catch {
    // 轮转失败不影响主流程
  }
}

function safeStringify(value: any): string {
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}

/**
 * 写入日志：文件 + 环形缓冲（error/warn）+ stdout
 */
export function writeLog(level: string, ...args: any[]): void {
  const levelNum = LEVELS[level] ?? LEVELS.info;
  if (levelNum < logLevel) return;

  const time = new Date().toISOString();
  const message = args
    .map(a => (a instanceof Error ? (a.stack || a.message) : typeof a === 'object' ? safeStringify(a) : String(a)))
    .join(' ');

  // 文件（尽力而为，失败不阻塞业务）
  try {
    rotateIfNeeded();
    fs.mkdirSync(LOG_DIR, { recursive: true });
    fs.appendFileSync(LOG_FILE, `${time} [${level.toUpperCase()}] ${message}\n`);
  } catch {
    // 忽略写日志失败
  }

  // 环形缓冲（error/warn 可追溯）
  if (level === 'error' || level === 'warn') {
    const req = currentRequest();
    recentErrors.push({
      time,
      level,
      message,
      stack: args.some(a => a instanceof Error) ? message : undefined,
      requestId: req?.requestId,
      path: req?.path
    });
    if (recentErrors.length > MAX_RECENT_ERRORS) {
      recentErrors.shift();
    }
  }

  // stdout（不经过 console，避免与补丁循环）
  const colored = level === 'error' ? '\x1b[31m[ERROR]\x1b[0m' : level === 'warn' ? '\x1b[33m[WARN]\x1b[0m' : `[${level.toUpperCase()}]`;
  process.stdout.write(`${time} ${colored} ${message}\n`);
}

/**
 * 补丁 console.error / console.warn，捕获全库既有日志
 * 仅在服务器启动时调用（index.ts），测试环境不调用
 */
export function patchConsole(): void {
  console.error = (...args: any[]) => {
    writeLog('error', ...args);
  };
  console.warn = (...args: any[]) => {
    writeLog('warn', ...args);
  };
}

// ============ Express 中间件 ============

/**
 * 请求日志中间件：
 * - 生成/透传 request-id（响应头 X-Request-Id）
 * - 记录 方法/路径/状态码/耗时
 * - 用 AsyncLocalStorage 为本次请求注入上下文
 */
export function requestLogger(req: Request, res: Response, next: NextFunction): void {
  const requestId = (req.headers['x-request-id'] as string) || crypto.randomUUID();
  res.setHeader('X-Request-Id', requestId);

  const start = Date.now();
  const requestPath = req.originalUrl || req.url;

  requestContext.run({ requestId, path: requestPath }, () => {
    res.on('finish', () => {
      writeLog('info', `${req.method} ${requestPath} ${res.statusCode} ${Date.now() - start}ms req=${requestId}`);
    });
    next();
  });
}
