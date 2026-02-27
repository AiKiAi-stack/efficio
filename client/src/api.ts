const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001/api';

export interface User {
  id: string;
  email: string;
  created_at: string;
}

export interface WorkRecord {
  id: string;
  user_id: string;
  original_text: string;
  optimized_text: string | null;
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

// 获取记录列表
export async function getRecords(token: string): Promise<ApiResponse<WorkRecord[]>> {
  const response = await fetch(`${API_URL}/records`, {
    headers: {
      'X-User-Id': token,
    },
  });
  return response.json();
}

// 创建记录
export async function createRecord(
  token: string,
  originalText: string,
  optimizedText?: string
): Promise<ApiResponse<WorkRecord>> {
  const response = await fetch(`${API_URL}/records`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-User-Id': token,
    },
    body: JSON.stringify({
      original_text: originalText,
      optimized_text: optimizedText,
    }),
  });
  return response.json();
}

// AI 优化
export async function optimizeText(text: string): Promise<ApiResponse<{ original: string; optimized: string }>> {
  const response = await fetch(`${API_URL}/optimize`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ text }),
  });
  return response.json();
}

// 删除记录
export async function deleteRecord(token: string, id: string): Promise<ApiResponse<{ message: string }>> {
  const response = await fetch(`${API_URL}/records/${id}`, {
    method: 'DELETE',
  });
  return response.json();
}
