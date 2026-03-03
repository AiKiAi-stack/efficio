import { Router } from 'express';
import { generateAIResponse, isAiAvailable } from '../lib/ai';

export const analyzeRouter = Router();

// AI 结构化分析
analyzeRouter.post('/', async (req, res) => {
  try {
    const { text } = req.body;

    if (!text || typeof text !== 'string') {
      return res.status(400).json({
        success: false,
        error: '请输入工作内容'
      });
    }

    if (!isAiAvailable()) {
      return res.status(503).json({
        success: false,
        error: 'AI 服务未配置'
      });
    }

    const content = await generateAIResponse({
      system: `你是一个专业的结构化数据抽取助手。请从用户的工作记录中提取以下信息：

1. task_category: 任务类别 - 从以下选择最匹配的：
   - "development" (开发工作)
   - "meeting" (会议)
   - "communication" (沟通协作)
   - "documentation" (文档编写)
   - "review" (代码审查/设计评审)
   - "learning" (学习研究)
   - "other" (其他)

2. time_spent: 预估耗时 - 根据描述推断，格式如 "2h", "30m", "1.5h"

3. tools_used: 使用的工具列表 - 如 ["VSCode", "Git", "Slack", "Jira"]

4. tags: 标签列表 - 2-5 个关键词标签

5. is_deep_work: 是否需要深度专注（boolean）

6. interruptions: 被打断的可能性（0-5 的整数）

7. value_level: 价值等级 "high" | "medium" | "low"

请以纯 JSON 格式返回，不要任何解释或多余文字。`,
      userMessage: `请分析以下工作记录并提取结构化数据：\n\n${text}`,
      maxTokens: 1024
    });

    // 清理 JSON 字符串（处理可能的 markdown 代码块）
    let jsonStr = content.trim();
    if (jsonStr.startsWith('```json')) {
      jsonStr = jsonStr.replace(/^```json\s*/, '').replace(/\s*```$/, '');
    } else if (jsonStr.startsWith('```')) {
      jsonStr = jsonStr.replace(/^```\s*/, '').replace(/\s*```$/, '');
    }

    let structuredData;
    try {
      structuredData = JSON.parse(jsonStr);
    } catch (e) {
      console.error('Failed to parse JSON:', jsonStr);
      return res.status(500).json({
        success: false,
        error: 'AI 分析结果格式错误'
      });
    }

    res.json({
      success: true,
      data: structuredData
    });
  } catch (error) {
    console.error('Analyze error:', error);
    res.status(500).json({
      success: false,
      error: 'AI 分析失败，请稍后重试'
    });
  }
});
