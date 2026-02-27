import { Router } from 'express';
import { supabase } from '../lib/database';

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

    // 检查用户是否存在
    let { data: user } = await supabase
      .from('users')
      .select('*')
      .eq('email', email.toLowerCase())
      .single();

    // 如果用户不存在，创建新用户
    if (!user) {
      const { data: newUser, error } = await supabase
        .from('users')
        .insert([{ email: email.toLowerCase() }])
        .select()
        .single();

      if (error) throw error;
      user = newUser;
    }

    // 生成简单 session token (生产环境应该使用更安全的方案)
    const sessionToken = Buffer.from(`${user.id}-${Date.now()}`).toString('base64');

    res.json({
      success: true,
      data: {
        user: {
          id: user.id,
          email: user.email,
          created_at: user.created_at
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
