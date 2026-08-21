/**
 * 本地日历日期工具测试
 *
 * 领域语义：「今天」按用户本地时区的日历划分，而非 UTC。
 * 背景：UTC+8 的凌晨 0~8 点，UTC 日期仍是昨天——此前 daily_logs
 * 用 toISOString 划分日界，导致凌晨记录被归档到昨天。
 */

import { localDateStr } from '../lib/date';

const REAL_TZ = process.env.TZ;

describe('localDateStr（本地日界）', () => {
  beforeEach(() => {
    process.env.TZ = 'Asia/Shanghai';
  });

  afterEach(() => {
    jest.useRealTimers();
    process.env.TZ = REAL_TZ;
  });

  it('UTC+8 凌晨 00:30 应归属当天（UTC 日期还是昨天）', () => {
    // 北京时间 2026-03-15 00:30 = UTC 2026-03-14 16:30
    jest.useFakeTimers({ now: new Date('2026-03-14T16:30:00.000Z') });
    expect(localDateStr()).toBe('2026-03-15');
  });

  it('白天时段与 UTC 日期一致', () => {
    // 北京时间 2026-03-15 12:00 = UTC 04:00
    jest.useFakeTimers({ now: new Date('2026-03-15T04:00:00.000Z') });
    expect(localDateStr()).toBe('2026-03-15');
  });

  it('跨年边界：UTC 年末 17:30 在北京已是次年元旦', () => {
    // 北京时间 2027-01-01 01:30 = UTC 2026-12-31 17:30
    jest.useFakeTimers({ now: new Date('2026-12-31T17:30:00.000Z') });
    expect(localDateStr()).toBe('2027-01-01');
  });

  it('接受显式 Date 参数', () => {
    expect(localDateStr(new Date('2026-08-19T00:30:00.000Z'))).toBe('2026-08-19');
  });
});
