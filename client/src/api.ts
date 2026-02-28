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
  structured_data: {
    task_category: string;
    time_spent: string;
    tools_used: string[];
    tags: string[];
    is_deep_work: boolean;
    interruptions: number;
    value_level: string;
  } | null;
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
    headers: {
      'X-User-Id': token,
    },
  });
  return response.json();
}

// 获取周总结
export async function getWeeklySummaries(token: string): Promise<ApiResponse<any[]>> {
  const response = await fetch(`${API_URL}/summaries/weekly`, {
    headers: {
      'X-User-Id': token,
    },
  });
  return response.json();
}

// 生成周总结
export async function generateWeeklySummary(
  token: string,
  weekStart: string,
  weekEnd: string
): Promise<ApiResponse<any>> {
  const response = await fetch(`${API_URL}/summaries/weekly/generate`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-User-Id': token,
    },
    body: JSON.stringify({ week_start: weekStart, week_end: weekEnd }),
  });
  return response.json();
}

// 获取月趋势
export async function getMonthlyTrends(token: string): Promise<ApiResponse<any[]>> {
  const response = await fetch(`${API_URL}/trends/monthly`, {
    headers: {
      'X-User-Id': token,
    },
  });
  return response.json();
}

// 生成月趋势
export async function generateMonthlyTrend(
  token: string,
  year: number,
  month: number
): Promise<ApiResponse<any>> {
  const response = await fetch(`${API_URL}/trends/monthly/generate`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-User-Id': token,
    },
    body: JSON.stringify({ year, month }),
  });
  return response.json();
}

// 获取优化建议
export async function getOptimizationSuggestions(token: string): Promise<ApiResponse<any[]>> {
  const response = await fetch(`${API_URL}/suggestions`, {
    headers: {
      'X-User-Id': token,
    },
  });
  return response.json();
}

// 生成优化建议
export async function generateOptimizationSuggestions(token: string): Promise<ApiResponse<any>> {
  const response = await fetch(`${API_URL}/suggestions/generate`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-User-Id': token,
    },
  });
  return response.json();
}

// 标记建议为已执行
export async function actionSuggestion(token: string, id: string): Promise<ApiResponse<{ message: string }>> {
  const response = await fetch(`${API_URL}/suggestions/${id}/action`, {
    method: 'PATCH',
    headers: {
      'X-User-Id': token,
    },
  });
  return response.json();
}
