import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import Dashboard from '../pages/Dashboard';

// Mock fetch
globalThis.fetch = vi.fn();

// Mock Recharts
vi.mock('recharts', () => ({
  ResponsiveContainer: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  PieChart: ({ children }: { children: React.ReactNode }) => <div data-testid="pie-chart">{children}</div>,
  Pie: () => null,
  Cell: () => null,
  BarChart: ({ children }: { children: React.ReactNode }) => <div data-testid="bar-chart">{children}</div>,
  Bar: () => null,
  XAxis: () => null,
  YAxis: () => null,
  CartesianGrid: () => null,
  Tooltip: () => null,
}));

describe('Dashboard Component', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
  });

  it('should render title', async () => {
    vi.mocked(fetch).mockResolvedValue({
      json: async () => ({ data: [] }),
    } as Response);

    render(<Dashboard />);
    expect(screen.getByText(/📈 总体统计/i)).toBeInTheDocument();
  });

  it('should render empty state when no data', async () => {
    vi.mocked(fetch).mockResolvedValue({
      json: async () => ({ data: [] }),
    } as Response);

    render(<Dashboard />);

    await waitFor(() => {
      expect(screen.getByText(/工作记录/i)).toBeInTheDocument();
    });

    // 检查统计卡片（0 可能出现在多个卡片中）
    expect(screen.getAllByText(/0/i).length).toBeGreaterThan(0);
  });

  it('should render records count when data exists', async () => {
    localStorage.setItem('sessionToken', 'test-token');

    const mockRecords = {
      json: async () => ({ data: [{ id: '1', original_text: 'Test' }] }),
    } as Response;

    const mockTaskLogs = {
      json: async () => ({ data: [] }),
    } as Response;

    vi.mocked(fetch)
      .mockResolvedValueOnce(mockRecords)
      .mockResolvedValueOnce(mockTaskLogs);

    render(<Dashboard />);

    await waitFor(() => {
      expect(screen.getAllByText('1').length).toBeGreaterThan(0);
    });

    expect(screen.getByText(/工作记录/i)).toBeInTheDocument();
  });

  it('should show AI summary button', () => {
    vi.mocked(fetch).mockResolvedValue({
      json: async () => ({ data: [] }),
    } as Response);

    render(<Dashboard />);
    expect(screen.getByText(/✨ 生成 AI 总结/i)).toBeInTheDocument();
  });

  it('should show date range inputs when AI summary button clicked', async () => {
    vi.mocked(fetch).mockResolvedValue({
      json: async () => ({ data: [] }),
    } as Response);

    render(<Dashboard />);

    const generateButton = screen.getByText(/✨ 生成 AI 总结/i);
    fireEvent.click(generateButton);

    await waitFor(() => {
      // 日期输入框（当前 UI 无 placeholder，按类型断言）
      expect(document.querySelectorAll('input[type="date"]').length).toBe(2);
    });
  });

  it('should show error message when summary generation fails', async () => {
    localStorage.setItem('sessionToken', 'test-token');

    vi.mocked(fetch).mockResolvedValue({
      ok: false,
      json: async () => ({ error: 'Summary generation failed' }),
    } as Response);

    render(<Dashboard />);

    const generateButton = screen.getByText(/✨ 生成 AI 总结/i);
    fireEvent.click(generateButton);

    // 点击日期面板里的「生成」按钮
    const submitButton = await screen.findByText(/^生成$/);
    fireEvent.click(submitButton);

    await waitFor(() => {
      expect(screen.getByText(/Summary generation failed/i)).toBeInTheDocument();
    });
  });

  it('should display statistics cards', async () => {
    vi.mocked(fetch).mockResolvedValue({
      json: async () => ({ data: [] }),
    } as Response);

    render(<Dashboard />);

    await waitFor(() => {
      expect(screen.getByText(/工作记录/i)).toBeInTheDocument();
      expect(screen.getByText(/完成任务/i)).toBeInTheDocument();
      // 「高价值工作」同时出现在统计卡片与洞察列表，用 getAllByText
      expect(screen.getAllByText(/高价值工作/i).length).toBeGreaterThan(0);
      expect(screen.getByText(/任务总时长/i)).toBeInTheDocument();
    });
  });

  it('should render chart sections', async () => {
    vi.mocked(fetch).mockResolvedValue({
      json: async () => ({ data: [] }),
    } as Response);

    render(<Dashboard />);

    await waitFor(() => {
      expect(screen.getByText(/📁 任务类别分布/i)).toBeInTheDocument();
      expect(screen.getByText(/💎 价值等级分布/i)).toBeInTheDocument();
      expect(screen.getByText(/🎯 任务优先级分布/i)).toBeInTheDocument();
    });
  });

  it('should render insights section', async () => {
    vi.mocked(fetch).mockResolvedValue({
      json: async () => ({ data: [] }),
    } as Response);

    render(<Dashboard />);

    await waitFor(() => {
      expect(screen.getByText(/💡 效率洞察/i)).toBeInTheDocument();
    });
  });
});
