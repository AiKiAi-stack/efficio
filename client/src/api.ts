// API 地址配置：优先级 环境变量 > 默认值
// 部署时通过 .env 文件设置 VITE_API_URL，例如：
// VITE_API_URL=http://YOUR_SERVER_IP:3001/api
const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001/api';

/**
 * 获取当前登录用户的真实 ID（localStorage 'user' 中的 id）
 * 注意：不是 sessionToken！sessionToken 是 base64(userId-时间戳)，
 * 不能作为 X-User-Id 请求头（会导致数据库外键校验失败）。
 * 所有需要鉴权的请求都应使用 getUserId() 的返回值作为 X-User-Id。
 */
export function getUserId(): string | null {
  try {
    const saved = localStorage.getItem('user');
    if (!saved) return null;
    return JSON.parse(saved).id || null;
  } catch {
    return null;
  }
}

export interface User {
  id: string;
  email: string;
  created_at: string;
}

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
}

// 登录
export async function login(email: string): Promise<ApiResponse<{ user: User; session_token: string }>> {
  const response = await fetch(`${API_URL}/auth/login`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ email }),
  });
  return response.json();
}
