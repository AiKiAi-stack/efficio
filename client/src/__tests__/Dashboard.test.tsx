import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import Dashboard from '../pages/Dashboard';

// Mock fetch
global.fetch = vi.fn();

// Mock React Router
vi.mock('react-router-dom', () => ({
  BrowserRouter: ({ children }: { children: React.ReactNode }) => children,
}));

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
  Legend: () => null,
}));

describe('Dashboard Component', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
  });

  it('should render loading state initially', () => {
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

    // 检查统计卡片
    expect(screen.getByText(/0/i)).toBeInTheDocument();
  });

  it('should render records count when data exists', async () => {
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
      expect(screen.getByText('1')).toBeInTheDocument();
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
      expect(screen.getByPlaceholderText(/开始日期/i)).toBeInTheDocument();
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

    // 触发日期范围输入
    const dateInput = await screen.findByPlaceholderText(/开始日期/i);
    fireEvent.change(dateInput, { target: { value: '2024-01-01' } });

    // 点击生成按钮
    const submitButton = screen.getByText(/生成/i);
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
      expect(screen.getByText(/高价值工作/i)).toBeInTheDocument();
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
