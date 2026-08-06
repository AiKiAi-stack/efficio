/**
 * AI 错误分类与降级模式数据真实性测试
 */

import { describe, it, expect } from '@jest/globals';
import {
  classifyAIError,
  analyzeWithoutAI,
  generateWorkInsights
} from '../lib/ai';

describe('AI 错误分类 classifyAIError', () => {
  it('网络错误应分类为 network 并给出国内网络提示', () => {
    const info = classifyAIError(
      new Error('fetch failed: getaddrinfo ENOTFOUND api.anthropic.com'),
      'anthropic'
    );
    expect(info.type).toBe('network');
    expect(info.hint).toContain('HTTPS_PROXY');
    expect(info.hint).toContain('DeepSeek');
  });

  it('401 应分类为 auth', () => {
    const info = classifyAIError(new Error('401 Unauthorized: invalid x-api-key'));
    expect(info.type).toBe('auth');
  });

  it('超时应分类为 timeout', () => {
    const info = classifyAIError(new Error('Request timed out after 60000ms'));
    expect(info.type).toBe('timeout');
  });

  it('429 应分类为 rate_limit', () => {
    const info = classifyAIError(new Error('429 Too Many Requests: rate limit exceeded'));
    expect(info.type).toBe('rate_limit');
  });

  it('模型不存在应分类为 model', () => {
    const info = classifyAIError(new Error('404 model_not_found: gpt-4o-xxx does not exist'));
    expect(info.type).toBe('model');
  });

  it('未配置应分类为 not_configured', () => {
    const info = classifyAIError(new Error('AI Provider 未配置'));
    expect(info.type).toBe('not_configured');
  });

  it('未知错误应分类为 unknown', () => {
    const info = classifyAIError(new Error('some weird internal error'));
    expect(info.type).toBe('unknown');
  });
});

describe('降级模式不再生成假数据', () => {
  it('analyzeWithoutAI 的 interruptions 恒为 0 且标记来源，输出确定性', () => {
    const a = analyzeWithoutAI('开发了新的功能并修复了 bug');
    const b = analyzeWithoutAI('开发了新的功能并修复了 bug');
    expect(a.interruptions).toBe(0);
    expect(a.analysis_source).toBe('rule');
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
  });

  it('generateWorkInsights 的周趋势基于真实数据，得分范围 0-100', () => {
    const records = [
      { created_at: '2026-08-03T01:00:00Z', structured_data: { is_deep_work: true, value_level: 'high', interruptions: 0 } },
      { created_at: '2026-08-03T02:00:00Z', structured_data: { is_deep_work: false, value_level: 'medium', interruptions: 0 } },
      { created_at: '2026-08-04T01:00:00Z', structured_data: { is_deep_work: true, value_level: 'medium', interruptions: 0 } }
    ];
    const insights = generateWorkInsights(records, []);

    expect(insights.weeklyTrend.length).toBeGreaterThan(0);
    for (const day of insights.weeklyTrend) {
      expect(day.score).toBeGreaterThanOrEqual(0);
      expect(day.score).toBeLessThanOrEqual(100);
    }
    // 记录最多的那天应得 100 分
    expect(Math.max(...insights.weeklyTrend.map(d => d.score))).toBe(100);
  });
});
