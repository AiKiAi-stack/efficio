import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, fireEvent, act, cleanup } from '@testing-library/react';
import TaskTracker from '../pages/TaskTracker';

// Mock fetch
globalThis.fetch = vi.fn();

function mockTask(overrides: Record<string, any> = {}) {
  return {
    id: 'task-1',
    task_title: '测试任务',
    task_description: null,
    task_category: null,
    start_time: null,
    end_time: null,
    status: 'pending',
    outcome: null,
    reflection: null,
    time_spent_minutes: null,
    priority: 'medium',
    estimated_duration: null,
    tags: null,
    created_at: '2026-08-19T09:00:00.000Z',
    ...overrides,
  };
}

function mockFetchResponse(data: any) {
  return { json: async () => ({ success: true, data }) } as Response;
}

describe('TaskTracker Component', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    localStorage.setItem('user', JSON.stringify({ id: 'test-user', email: 'test@test.com' }));
  });

  afterEach(() => {
    vi.useRealTimers();
    cleanup();
  });

  it('应渲染创建表单和筛选标签', async () => {
    vi.mocked(fetch).mockResolvedValue(mockFetchResponse([]));

    render(<TaskTracker />);

    expect(screen.getByText(/创建任务/i)).toBeInTheDocument();
    await waitFor(() => {
      expect(screen.getByText(/全部 0/i)).toBeInTheDocument();
    });
    expect(screen.getByText(/还没有任务/i)).toBeInTheDocument();
  });

  it('应按状态筛选并显示计数', async () => {
    vi.mocked(fetch).mockResolvedValue(
      mockFetchResponse([
        mockTask({ id: '1', status: 'in_progress', start_time: '2026-08-19T09:30:00.000Z' }),
        mockTask({ id: '2', status: 'pending' }),
        mockTask({ id: '3', status: 'completed', end_time: '2026-08-19T09:40:00.000Z', time_spent_minutes: 10 }),
      ])
    );

    render(<TaskTracker />);

    await waitFor(() => {
      expect(screen.getByText(/全部 3/i)).toBeInTheDocument();
    });
    expect(screen.getByText(/进行中 1/i)).toBeInTheDocument();
    expect(screen.getByText(/待办 1/i)).toBeInTheDocument();
    expect(screen.getByText(/已完成 1/i)).toBeInTheDocument();

    // 待办任务显示开始按钮；进行中显示完成表单
    expect(screen.getByText(/开始任务/i)).toBeInTheDocument();
    expect(screen.getByText(/标记完成/i)).toBeInTheDocument();
  });

  it('创建任务应调用 POST 并刷新列表', async () => {
    const created = mockTask({ id: 'new-1', task_title: '新任务' });
    vi.mocked(fetch)
      .mockResolvedValueOnce(mockFetchResponse([]))
      .mockResolvedValueOnce(mockFetchResponse(created))
      .mockResolvedValueOnce(mockFetchResponse([created]));

    render(<TaskTracker />);

    await waitFor(() => {
      expect(screen.getByText(/还没有任务/i)).toBeInTheDocument();
    });

    fireEvent.change(screen.getByPlaceholderText('例如：完成登录页面'), {
      target: { value: '新任务' },
    });
    fireEvent.click(screen.getByText(/添加任务/i));

    await waitFor(() => {
      expect(screen.getByText('新任务')).toBeInTheDocument();
    });

    const calls = vi.mocked(fetch).mock.calls;
    const postCall = calls.find(([, init]) => (init as RequestInit)?.method === 'POST');
    expect(postCall).toBeTruthy();
    const body = JSON.parse((postCall![1] as RequestInit).body as string);
    expect(body.task_title).toBe('新任务');
    expect(body.status).toBe('pending');
  });

  it('进行中任务的已进行时间应随时间刷新', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-08-19T10:00:00.000Z'));

    vi.mocked(fetch).mockResolvedValue(
      mockFetchResponse([
        mockTask({ id: '1', status: 'in_progress', start_time: '2026-08-19T09:55:00.000Z' }),
      ])
    );

    render(<TaskTracker />);

    // 初始渲染：进行 5 分钟
    await act(async () => {
      await vi.advanceTimersByTimeAsync(0);
    });
    expect(screen.getByText(/已进行 5分钟/)).toBeInTheDocument();

    // 90 秒后应重渲染为 6 分钟（若无定时刷新会停留在 5 分钟）
    await act(async () => {
      await vi.advanceTimersByTimeAsync(90_000);
    });
    expect(screen.getByText(/已进行 6分钟/)).toBeInTheDocument();
  });

  it('完成任务后应显示实际用时', async () => {
    vi.mocked(fetch).mockResolvedValue(
      mockFetchResponse([
        mockTask({
          id: '1',
          status: 'completed',
          start_time: '2026-08-19T09:00:00.000Z',
          end_time: '2026-08-19T10:30:00.000Z',
          time_spent_minutes: 90,
          outcome: '做完了',
        }),
      ])
    );

    render(<TaskTracker />);

    await waitFor(() => {
      expect(screen.getByText(/实际用时 1小时30分/)).toBeInTheDocument();
    });
    expect(screen.getByText(/完成内容：/)).toBeInTheDocument();
  });
});
