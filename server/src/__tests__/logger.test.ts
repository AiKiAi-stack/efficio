/**
 * 日志模块测试
 *
 * 注意：EFFICIO_LOG_DIR 必须在导入 logger 前设置（LOG_FILE 在模块加载时确定），
 * 使用 jest.isolateModules 保证隔离。
 */

import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

const tmpLogDir = fs.mkdtempSync(path.join(os.tmpdir(), 'efficio-log-test-'));

process.env.EFFICIO_LOG_DIR = tmpLogDir;

function loadLogger() {
  let mod: any = {};
  jest.isolateModules(() => {
    mod = require('../lib/logger');
  });
  return mod;
}

describe('日志模块', () => {
  let logger: any;

  beforeEach(() => {
    logger = loadLogger();
    logger.setLogLevel('info');
  });

  afterEach(() => {
    fs.rmSync(tmpLogDir, { recursive: true, force: true });
    fs.mkdirSync(tmpLogDir, { recursive: true });
  });

  it('writeLog 应写入日志文件', () => {
    logger.writeLog('info', 'hello world');
    const content = fs.readFileSync(logger.LOG_FILE, 'utf-8');
    expect(content).toContain('hello world');
  });

  it('error 级别应进入最近错误缓冲', () => {
    logger.writeLog('error', 'something failed');
    const errors = logger.getRecentErrors(10);
    expect(errors.length).toBe(1);
    expect(errors[0].level).toBe('error');
    expect(errors[0].message).toContain('something failed');
  });

  it('debug 级别低于 info 时不输出', () => {
    logger.setLogLevel('error');
    logger.writeLog('debug', 'should not appear');
    logger.writeLog('error', 'should appear');
    const content = fs.readFileSync(logger.LOG_FILE, 'utf-8');
    expect(content).not.toContain('should not appear');
    expect(content).toContain('should appear');
  });

  it('Error 对象应输出 stack', () => {
    logger.writeLog('error', new Error('boom'));
    const errors = logger.getRecentErrors(10);
    expect(errors[0].message).toContain('boom');
    expect(errors[0].stack).toBeTruthy();
  });

  it('getRecentErrors 应返回最新的在前', () => {
    logger.writeLog('error', 'first');
    logger.writeLog('error', 'second');
    const errors = logger.getRecentErrors(10);
    expect(errors[0].message).toContain('second');
    expect(errors[1].message).toContain('first');
  });
});
