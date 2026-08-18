import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, fireEvent, cleanup } from '@testing-library/react';
import DailyTracker from '../pages/DailyTracker';

// Mock fetch
globalThis.fetch = vi.fn();

describe('DailyTracker Component', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    localStorage.setItem('user', JSON.stringify({ id: 'test-user', email: 'test@test.com' }));
    vi.spyOn(window, 'alert').mockImplementation(() => {});
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it('保存反思时应保留原始完成时间（回归：曾用 new Date() 覆盖导致漂移）', async () => {
    const originalEndTime = '2026-08-19T10:00:00.000Z';

    vi.mocked(fetch).mockResolvedValueOnce({
      json: async () => ({
        success: true,
        data: {
          goals: '完成开发',
          accomplishments: '已完成',
          reflection: '',
          mood_score: 4,
          energy_level: 'high',
          start_time: '2026-08-19T01:00:00.000Z',
          end_time: originalEndTime
        }
      })
    } as Response);

    render(<DailyTracker />);

    await waitFor(() => {
      expect(screen.getByText(/保存反思/)).not.toBeDisabled();
    });

    // 反思保存会再发一次 POST
    vi.mocked(fetch).mockResolvedValueOnce({
      json: async () => ({ success: true, data: {} })
    } as Response);

    fireEvent.click(screen.getByText(/保存反思/));

    await waitFor(() => {
      const calls = vi.mocked(fetch).mock.calls;
      const postCall = calls.find(([, init]) => (init as RequestInit)?.method === 'POST');
      expect(postCall).toBeTruthy();
      const body = JSON.parse((postCall![1] as RequestInit).body as string);
      expect(body.end_time).toBe(originalEndTime);
      expect(body.reflection).toBeDefined();
    });
  });

  it('未加载日志时应显示加载后表单', async () => {
    vi.mocked(fetch).mockResolvedValueOnce({
      json: async () => ({ success: true, data: null })
    } as Response);

    render(<DailyTracker />);

    await waitFor(() => {
      expect(screen.getByText(/开始今天/)).toBeInTheDocument();
    });
  });
});
