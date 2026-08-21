/**
 * QuickLog —— CLI 快速打卡的领域逻辑
 *
 * 定位：把 efficio 的每日记录压缩成终端一行命令（30 秒打卡），
 * 与 tracemd 的自由书写分工——量化归这里，长文归 Markdown。
 *
 * 通过 HTTP 调用已运行的服务（而非直连数据库），
 * 这样无论部署是 Docker 还是 run.sh，写到的都是同一份数据。
 */

export interface DailyLogInput {
  goals?: string;
  accomplishments?: string;
  reflection?: string;
  moodScore?: number;
  energyLevel?: number;
}

export interface QuickLogTarget {
  baseUrl: string;
  userId: string;
}

export type FetchLike = (url: string, init?: RequestInit) => Promise<Response>;

interface ApiEnvelope {
  success?: boolean;
  error?: string;
  data?: Record<string, unknown>;
}

function parseBody(res: Response): Promise<ApiEnvelope> {
  return res.json().catch(() => ({})) as Promise<ApiEnvelope>;
}

/** camelCase 入参映射为 daily-logs API 的 snake_case payload */
export function toDailyLogPayload(input: DailyLogInput): Record<string, unknown> {
  const payload: Record<string, unknown> = {};

  if (input.goals !== undefined) payload.goals = input.goals;
  if (input.accomplishments !== undefined) payload.accomplishments = input.accomplishments;
  if (input.reflection !== undefined) payload.reflection = input.reflection;

  for (const [key, value] of [
    ['mood_score', input.moodScore],
    ['energy_level', input.energyLevel]
  ] as const) {
    if (value === undefined) continue;
    if (!Number.isInteger(value) || value < 1 || value > 5) {
      throw new Error(`${key} 必须是 1-5 的整数，收到：${value}`);
    }
    payload[key] = value;
  }

  return payload;
}

/**
 * 解析用户标识：邮箱走 /api/auth/login 换取真实 id
 * （登录是幂等的——存在则返回，不存在则创建），纯 id 直接透传。
 */
export async function resolveUserId(
  userInput: string,
  baseUrl: string,
  fetchImpl: FetchLike = fetch
): Promise<string> {
  if (!userInput.includes('@')) {
    return userInput;
  }

  const res = await fetchImpl(`${baseUrl}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: userInput })
  });

  const body = await parseBody(res);
  if (!res.ok || !body.success || !(body.data?.user as { id?: string } | undefined)?.id) {
    throw new Error(body.error || `登录失败（HTTP ${res.status}）`);
  }
  return (body.data.user as { id: string }).id;
}

/** 推送当日日志；服务端按本地日历划分 log_date，重复调用为补丁更新 */
export async function pushDailyLog(
  input: DailyLogInput,
  target: QuickLogTarget,
  fetchImpl: FetchLike = fetch
): Promise<{ success: boolean; data?: Record<string, unknown>; error?: string }> {
  const payload = toDailyLogPayload(input);

  const res = await fetchImpl(`${target.baseUrl}/api/daily-logs`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-user-id': target.userId
    },
    body: JSON.stringify(payload)
  });

  const body = await parseBody(res);
  if (!res.ok || !body.success) {
    throw new Error(body.error || `记录失败（HTTP ${res.status}）`);
  }
  return body as { success: boolean; data?: Record<string, unknown>; error?: string };
}
