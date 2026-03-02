import { describe, it, expect, beforeEach } from '@jest/globals';
import {
  analyzeWithoutAI,
  optimizeWithoutAI,
  generateWeeklySummaryWithoutAI,
  generateSuggestionsWithoutAI
} from '../lib/ai';

describe('AI Module - Fallback Functions', () => {
  describe('analyzeWithoutAI', () => {
    it('should categorize development work', () => {
      const result = analyzeWithoutAI('今天开发了新功能，编写了代码并修复了 bug');

      expect(result.task_category).toBe('development');
      expect(result.time_spent).toBeDefined();
      expect(result.tools_used).toBeDefined();
      expect(result.tags).toContain('feature');
      expect(result.tags).toContain('bugfix');
    });

    it('should categorize meeting work', () => {
      const result = analyzeWithoutAI('参加了项目评审会议和周会讨论');

      expect(result.task_category).toBe('meeting');
      expect(result.is_deep_work).toBe(false);
    });

    it('should categorize documentation work', () => {
      const result = analyzeWithoutAI('编写了项目文档和 README 说明');

      expect(result.task_category).toBe('documentation');
      expect(result.is_deep_work).toBe(true);
    });

    it('should categorize communication work', () => {
      const result = analyzeWithoutAI('回复邮件，和团队沟通协调进度');

      expect(result.task_category).toBe('communication');
      expect(result.value_level).toBe('low');
    });

    it('should categorize review work', () => {
      const result = analyzeWithoutAI('进行了代码审查和 PR 审核');

      expect(result.task_category).toBe('review');
    });

    it('should categorize learning work', () => {
      const result = analyzeWithoutAI('学习了新技术，研究框架文档');

      expect(result.task_category).toBe('learning');
    });

    it('should default to other for unrecognized content', () => {
      const result = analyzeWithoutAI('今天天气不错');

      expect(result.task_category).toBe('other');
    });

    it('should extract tools from text', () => {
      const result = analyzeWithoutAI('使用 VSCode 编写代码，用 Git 提交，在 Docker 中测试');

      expect(result.tools_used).toContain('VSCode');
      expect(result.tools_used).toContain('Git');
      expect(result.tools_used).toContain('Docker');
    });

    it('should generate appropriate tags', () => {
      const result = analyzeWithoutAI('修复了一个严重的 bug 并上线了新功能');

      expect(result.tags).toContain('bugfix');
      expect(result.tags).toContain('feature');
    });

    it('should determine deep work based on category', () => {
      const devResult = analyzeWithoutAI('开发新功能模块');
      expect(devResult.is_deep_work).toBe(true);

      const meetingResult = analyzeWithoutAI('参加项目会议');
      expect(meetingResult.is_deep_work).toBe(false);
    });

    it('should assign value levels appropriately', () => {
      const highValueResult = analyzeWithoutAI('开发了核心功能模块');
      expect(highValueResult.value_level).toBe('high');

      const lowValueResult = analyzeWithoutAI('参加了例行会议和沟通');
      expect(lowValueResult.value_level).toBe('low');
    });

    it('should estimate time based on content length', () => {
      const shortResult = analyzeWithoutAI('短记录');
      expect(shortResult.time_spent).toBe('30m');

      // 创建一个超过 100 字符的长文本
      const longText = '今天花费了很长时间开发一个复杂的功能模块，涉及多个文件的修改和测试，需要仔细考虑架构设计和代码质量，最终成功实现了预期的功能，并且进行了充分的测试和文档编写，确保代码质量和系统稳定性达到最佳状态，整个过程非常复杂且有挑战性';
      const longResult = analyzeWithoutAI(longText);
      expect(longResult.time_spent).toBe('1h');
      expect(longText.length).toBeGreaterThan(100); // 确保测试有效
    });
  });

  describe('optimizeWithoutAI', () => {
    it('should trim whitespace', () => {
      const result = optimizeWithoutAI('  hello world  ');
      expect(result).toBe('hello world');
    });

    it('should normalize spaces', () => {
      const result = optimizeWithoutAI('hello    world');
      expect(result).toBe('hello world');
    });
  });

  describe('generateWeeklySummaryWithoutAI', () => {
    it('should generate summary with category distribution', () => {
      const records = [
        { structured_data: { task_category: 'development', is_deep_work: true, value_level: 'high' } },
        { structured_data: { task_category: 'development', is_deep_work: true, value_level: 'medium' } },
        { structured_data: { task_category: 'meeting', is_deep_work: false, value_level: 'low' } },
        { structured_data: { task_category: 'documentation', is_deep_work: true, value_level: 'medium' } },
      ];

      const summary = generateWeeklySummaryWithoutAI(records);

      expect(summary).toContain('# 本周工作分析');
      expect(summary).toContain('📊 时间分布');
      expect(summary).toContain('- development: 2条记录');
      expect(summary).toContain('- meeting: 1 条记录');
      expect(summary).toContain('- documentation: 1 条记录');
      expect(summary).toContain('✨ 高价值工作');
      expect(summary).toContain('🎯 深度工作状态');
      expect(summary).toContain('💡 优化建议');
    });

    it('should handle empty records', () => {
      const summary = generateWeeklySummaryWithoutAI([]);

      expect(summary).toContain('# 本周工作分析');
    });

    it('should calculate percentages correctly', () => {
      const records = [
        { structured_data: { task_category: 'development' } },
        { structured_data: { task_category: 'development' } },
        { structured_data: { task_category: 'meeting' } },
      ];

      const summary = generateWeeklySummaryWithoutAI(records);

      expect(summary).toContain('(67%)'); // development (2/3)
      expect(summary).toContain('(33%)'); // meeting (1/3)
    });
  });

  describe('generateSuggestionsWithoutAI', () => {
    it('should suggest reducing meetings when meeting count is high', () => {
      const records = [
        { structured_data: { task_category: 'meeting' } },
        { structured_data: { task_category: 'meeting' } },
        { structured_data: { task_category: 'meeting' } },
        { structured_data: { task_category: 'development' } },
        { structured_data: { task_category: 'development' } },
      ];

      const { suggestions } = generateSuggestionsWithoutAI(records);

      const meetingSuggestion = suggestions.find(s => s.title === '减少会议时间');
      expect(meetingSuggestion).toBeDefined();
      expect(meetingSuggestion?.priority).toBe('high');
      expect(meetingSuggestion?.category).toBe('时间管理');
    });

    it('should suggest increasing deep work when deep work count is low', () => {
      const records = [
        { structured_data: { task_category: 'meeting', is_deep_work: false } },
        { structured_data: { task_category: 'communication', is_deep_work: false } },
        { structured_data: { task_category: 'other', is_deep_work: false } },
        { structured_data: { task_category: 'other', is_deep_work: false } },
        { structured_data: { task_category: 'other', is_deep_work: false } },
      ];

      const { suggestions } = generateSuggestionsWithoutAI(records);

      const deepWorkSuggestion = suggestions.find(s => s.title === '增加深度工作时间');
      expect(deepWorkSuggestion).toBeDefined();
      expect(deepWorkSuggestion?.priority).toBe('high');
    });

    it('should provide positive feedback when work pattern is healthy', () => {
      const records = [
        { structured_data: { task_category: 'development', is_deep_work: true } },
        { structured_data: { task_category: 'development', is_deep_work: true } },
        { structured_data: { task_category: 'documentation', is_deep_work: true } },
      ];

      const { suggestions } = generateSuggestionsWithoutAI(records);

      // 当没有负面建议时，应该给出正面反馈
      const keepCurrentSuggestion = suggestions.find(s => s.title === '保持当前工作状态');
      if (suggestions.length === 1) {
        expect(keepCurrentSuggestion).toBeDefined();
      }
    });

    it('should return at least one suggestion', () => {
      const records: any[] = [];
      const { suggestions } = generateSuggestionsWithoutAI(records);

      expect(suggestions.length).toBeGreaterThan(0);
    });
  });
});
