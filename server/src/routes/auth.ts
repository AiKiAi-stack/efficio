import { Router } from 'express';
import { getDatabase } from '../lib/database-new';

export const authRouter = Router();

// 简单登录 - 创建或获取用户
authRouter.post('/login', async (req, res) => {
  try {
    const { email } = req.body;

    if (!email || typeof email !== 'string') {
      return res.status(400).json({
        success: false,
        error: '邮箱地址不能为空'
      });
    }

    const db = getDatabase();
    const normalizedEmail = email.toLowerCase();

    // 检查用户是否存在
    const { data: user } = await db.selectSingle('users', {
      where: { email: normalizedEmail }
    });

    // 如果用户不存在，创建新用户
    let savedUser = user;
    if (!savedUser) {
      const result = await db.insert('users', { email: normalizedEmail });
      if (result.error) throw result.error;
      savedUser = result.data;
    }

    // 生成简单 session token (生产环境应该使用更安全的方案)
    const sessionToken = Buffer.from(`${savedUser.id}-${Date.now()}`).toString('base64');

    res.json({
      success: true,
      data: {
        user: {
          id: savedUser.id,
          email: savedUser.email,
          created_at: savedUser.created_at
        },
        session_token: sessionToken
      }
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({
      success: false,
      error: '登录失败，请稍后重试'
    });
  }
});
