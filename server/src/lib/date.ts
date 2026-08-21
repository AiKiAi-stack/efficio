/**
 * 本地日历日期工具
 *
 * 领域语义：「今天 / 某天」按用户本地时区的日历划分，而非 UTC。
 * 背景：UTC+8 的凌晨 0~8 点，UTC 日期仍是昨天——用 toISOString
 * 划分日界会把凌晨的记录归档到昨天（与前端日历的本地日期不一致）。
 */

/** 将 Date 格式化为本地日历日期 YYYY-MM-DD */
export function localDateStr(d: Date = new Date()): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}
