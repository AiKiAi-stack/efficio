import { Router } from 'express';
import { generateAIResponse, isAiAvailable, optimizeWithoutAI } from '../lib/ai';

export const optimizeRouter = Router();

// AI 文本优化
optimizeRouter.post('/', async (req, res) => {
  try {
    const { text } = req.body;

    if (!text || typeof text !== 'string') {
      return res.status(400).json({
        success: false,
        error: '请输入工作内容'
      });
    }

    let optimizedText = '';

    if (isAiAvailable()) {
      // 使用 AI 优化
      optimizedText = await generateAIResponse({
        system: `你是一个专业的工作记录优化助手。你的任务是：
1. 将用户的原始工作记录整理成清晰、专业的表达
2. 保持原意，不添加不存在的内容
3. 使用简洁的中文，避免冗余
4. 突出工作成果和价值
5. 如果原始内容太简单，可以适当扩展但不要编造

请直接返回优化后的文本，不要添加任何解释。`,
        userMessage: `请优化以下工作记录：\n\n${text}`,
        maxTokens: 1024
      });
    } else {
      // 降级模式：简单优化
      optimizedText = optimizeWithoutAI(text);
      console.log('使用降级模式优化文本');
    }

    res.json({
      success: true,
      data: {
        original: text,
        optimized: optimizedText
      }
    });
  } catch (error) {
    console.error('Optimize error:', error);
    res.status(500).json({
      success: false,
      error: 'AI 优化失败，请稍后重试'
    });
  }
});
