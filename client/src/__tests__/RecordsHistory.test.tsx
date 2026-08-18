import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, act, fireEvent, cleanup } from '@testing-library/react';
import RecordsHistory from '../pages/RecordsHistory';

// Mock fetch
globalThis.fetch = vi.fn();

describe('RecordsHistory Component', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    localStorage.setItem('user', JSON.stringify({ id: 'test-user', email: 'test@test.com' }));
    vi.mocked(fetch).mockResolvedValue({
      json: async () => ({ success: true, data: [] })
    } as Response);
  });

  afterEach(() => {
    vi.useRealTimers();
    cleanup();
  });

  it('日历翻月应正确（回归：toISOString 取 UTC 日期在非 UTC 时区跳错月）', async () => {
    vi.useFakeTimers();
    // 本地时间 2026-07-01 00:30：UTC+ 时区下 toISOString 会得到 6 月 30 日，
    // 能暴露旧实现的时区 bug（UTC 时区下该用例退化为普通翻月断言）
    vi.setSystemTime(new Date(2026, 6, 1, 0, 30));

    render(<RecordsHistory />);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(0);
    });

    // 初始应显示当前本地月份（7 月）
    expect(screen.getByText(/2026年 七月/)).toBeInTheDocument();

    // 下月 → 8 月（旧实现可能停在 7 月末日期对应的月份）
    fireEvent.click(screen.getByText(/下月/));
    await act(async () => {
      await vi.advanceTimersByTimeAsync(0);
    });
    expect(screen.getByText(/2026年 八月/)).toBeInTheDocument();

    // 上月 → 回到 7 月
    fireEvent.click(screen.getByText(/上月/));
    await act(async () => {
      await vi.advanceTimersByTimeAsync(0);
    });
    expect(screen.getByText(/2026年 七月/)).toBeInTheDocument();

    // 再上月 → 6 月（不能跳过月份）
    fireEvent.click(screen.getByText(/上月/));
    await act(async () => {
      await vi.advanceTimersByTimeAsync(0);
    });
    expect(screen.getByText(/2026年 六月/)).toBeInTheDocument();
  });

  it('空日期应显示空状态', async () => {
    render(<RecordsHistory />);

    await act(async () => {
      await Promise.resolve();
    });

    expect(await screen.findByText(/暂无记录/)).toBeInTheDocument();
  });
});
