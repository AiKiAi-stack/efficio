import { useState, useEffect } from 'react';

interface WorkRecord {
  id: string;
  created_at: string;
  original_text: string;
  structured_data: {
    task_category: string;
    time_spent: string;
    value_level: string;
    is_deep_work: boolean;
  } | null;
}

interface TaskLog {
  id: string;
  task_title: string;
  task_description: string | null;
  task_category: string | null;
  start_time: string | null;
  end_time: string | null;
  status: 'pending' | 'in_progress' | 'completed';
  outcome: string | null;
  reflection: string | null;
  time_spent_minutes: number | null;
  priority: string | null;
  created_at: string;
}

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001/api';

export default function RecordsHistory() {
  const token = localStorage.getItem('sessionToken');

  // 日期选择状态
  const [selectedDate, setSelectedDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');
  const [dateRangeMode, setDateRangeMode] = useState(false);

  // 数据状态
  const [records, setRecords] = useState<WorkRecord[]>([]);
  const [taskLogs, setTaskLogs] = useState<TaskLog[]>([]);
  const [loading, setLoading] = useState(true);

  // AI 总结状态
  const [aiSummary, setAiSummary] = useState<string | null>(null);
  const [aiSummaryLoading, setAiSummaryLoading] = useState(false);
  const [summaryClickCount, setSummaryClickCount] = useState(0);
  const [showRegenerate, setShowRegenerate] = useState(false);

  useEffect(() => {
    loadData();
    // 加载点击计数
    const savedCount = localStorage.getItem('aiSummaryClickCount');
    if (savedCount) {
      setSummaryClickCount(parseInt(savedCount));
    }
  }, [selectedDate, startDate, endDate, dateRangeMode]);

  // 检查是否需要显示重新总结按钮（每 10 次）
  useEffect(() => {
    if (summaryClickCount > 0 && summaryClickCount % 10 === 0) {
      setShowRegenerate(true);
    } else {
      setShowRegenerate(false);
    }
  }, [summaryClickCount]);

  const loadData = async () => {
    if (!token) return;
    setLoading(true);

    try {
      // 加载工作记录
      const recordsRes = await fetch(`${API_URL}/records`, {
        headers: { 'X-User-Id': token }
      });
      const recordsData = await recordsRes.json();
      if (recordsData.data) {
        let filteredRecords = recordsData.data;

        if (dateRangeMode && startDate && endDate) {
          const start = new Date(startDate);
          const end = new Date(endDate);
          end.setHours(23, 59, 59, 999);
          filteredRecords = filteredRecords.filter((r: WorkRecord) => {
            const date = new Date(r.created_at);
            return date >= start && date <= end;
          });
        } else if (selectedDate) {
          filteredRecords = filteredRecords.filter((r: WorkRecord) =>
            new Date(r.created_at).toDateString() === new Date(selectedDate).toDateString()
          );
        }

        setRecords(filteredRecords);
      }

      // 加载任务日志
      const taskLogsRes = await fetch(`${API_URL}/task-logs`, {
        headers: { 'X-User-Id': token }
      });
      const taskLogsData = await taskLogsRes.json();
      if (taskLogsData.data) {
        let filteredLogs = taskLogsData.data;

        if (dateRangeMode && startDate && endDate) {
          const start = new Date(startDate);
          const end = new Date(endDate);
          end.setHours(23, 59, 59, 999);
          filteredLogs = filteredLogs.filter((t: TaskLog) => {
            const date = new Date(t.created_at);
            return date >= start && date <= end;
          });
        } else if (selectedDate) {
          filteredLogs = filteredLogs.filter((t: TaskLog) =>
            new Date(t.created_at).toDateString() === new Date(selectedDate).toDateString()
          );
        }

        setTaskLogs(filteredLogs.filter((t: TaskLog) => t.status === 'completed'));
      }

      // 检查是否有缓存的 AI 总结
      if (dateRangeMode && startDate && endDate) {
        const cacheKey = `summary_${startDate}_${endDate}`;
        const cached = localStorage.getItem(cacheKey);
        if (cached) {
          setAiSummary(cached);
        } else {
          setAiSummary(null);
        }
      } else {
        const cacheKey = `summary_${selectedDate}`;
        const cached = localStorage.getItem(cacheKey);
        if (cached) {
          setAiSummary(cached);
        } else {
          setAiSummary(null);
        }
      }
    } catch (error) {
      console.error('Failed to load data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleGenerateAISummary = async () => {
    if (!token) return;

    setAiSummaryLoading(true);

    let dateParam: any = {};
    if (dateRangeMode && startDate && endDate) {
      dateParam = { start_date: startDate, end_date: endDate };
    } else {
      dateParam = { date: selectedDate };
    }

    try {
      const res = await fetch(`${API_URL}/summaries/range`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-User-Id': token
        },
        body: JSON.stringify(dateParam)
      });

      const data = await res.json();
      if (data.data?.markdown_content) {
        setAiSummary(data.data.markdown_content);

        // 缓存总结
        const cacheKey = dateRangeMode && startDate && endDate
          ? `summary_${startDate}_${endDate}`
          : `summary_${selectedDate}`;
        localStorage.setItem(cacheKey, data.data.markdown_content);

        // 增加点击计数
        const newCount = summaryClickCount + 1;
        setSummaryClickCount(newCount);
        localStorage.setItem('aiSummaryClickCount', newCount.toString());
      }
    } catch (error) {
      console.error('Failed to generate summary:', error);
      alert('生成总结失败，请稍后重试');
    } finally {
      setAiSummaryLoading(false);
    }
  };

  const handleRegenerateSummary = async () => {
    // 清除缓存
    const cacheKey = dateRangeMode && startDate && endDate
      ? `summary_${startDate}_${endDate}`
      : `summary_${selectedDate}`;
    localStorage.removeItem(cacheKey);
    setAiSummary(null);
    setShowRegenerate(false);

    // 重新生成
    await handleGenerateAISummary();
  };

  // 获取月份的天数
  const getDaysInMonth = (year: number, month: number) => {
    return new Date(year, month + 1, 0).getDate();
  };

  // 渲染日历
  const renderCalendar = () => {
    const currentDate = new Date(selectedDate);
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();
    const firstDay = new Date(year, month, 1).getDay();
    const daysInMonth = getDaysInMonth(year, month);

    const months = ['一月', '二月', '三月', '四月', '五月', '六月', '七月', '八月', '九月', '十月', '十一月', '十二月'];

    return (
      <div className="bg-white rounded-lg shadow p-4">
        <div className="flex items-center justify-between mb-4">
          <button
            onClick={() => {
              const newDate = new Date(year, month - 1, 1);
              setSelectedDate(newDate.toISOString().split('T')[0]);
            }}
            className="px-2 py-1 text-sm hover:bg-gray-100 rounded"
          >
            ← 上月
          </button>
          <span className="text-sm font-semibold">
            {year}年 {months[month]}
          </span>
          <button
            onClick={() => {
              const newDate = new Date(year, month + 1, 1);
              setSelectedDate(newDate.toISOString().split('T')[0]);
            }}
            className="px-2 py-1 text-sm hover:bg-gray-100 rounded"
          >
            下月 →
          </button>
        </div>

        <div className="grid grid-cols-7 gap-1 text-center">
          {['日', '一', '二', '三', '四', '五', '六'].map(day => (
            <div key={day} className="text-xs font-medium text-gray-500 py-1">
              {day}
            </div>
          ))}

          {/* 空白填充 */}
          {Array.from({ length: firstDay }).map((_, i) => (
            <div key={`empty-${i}`} className="p-1" />
          ))}

          {/* 日期 */}
          {Array.from({ length: daysInMonth }).map((_, i) => {
            const day = i + 1;
            const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
            const isSelected = dateStr === selectedDate;
            const isToday = dateStr === new Date().toISOString().split('T')[0];

            return (
              <button
                key={day}
                onClick={() => {
                  setSelectedDate(dateStr);
                  setDateRangeMode(false);
                }}
                className={`p-1 text-sm rounded transition ${
                  isSelected
                    ? 'bg-blue-500 text-white'
                    : isToday
                    ? 'bg-blue-100 text-blue-700 font-semibold'
                    : 'hover:bg-gray-100'
                }`}
              >
                {day}
              </button>
            );
          })}
        </div>

        <button
          onClick={() => setSelectedDate(new Date().toISOString().split('T')[0])}
          className="w-full mt-3 px-2 py-1 text-xs text-blue-600 hover:bg-blue-50 rounded"
        >
          回到今天
        </button>
      </div>
    );
  };

  const categoryLabels: Record<string, string> = {
    development: '开发',
    meeting: '会议',
    communication: '沟通',
    documentation: '文档',
    review: '评审',
    learning: '学习',
    other: '其他'
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-gray-500">加载中...</div>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
      {/* 左侧：日历和日期选择 */}
      <div className="lg:col-span-1 space-y-4">
        {/* 日历 */}
        {!dateRangeMode && renderCalendar()}

        {/* 日期范围选择切换 */}
        <div className="bg-white rounded-lg shadow p-4">
          <button
            onClick={() => setDateRangeMode(!dateRangeMode)}
            className={`w-full py-2 text-sm rounded-lg transition ${
              dateRangeMode
                ? 'bg-blue-500 text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            {dateRangeMode ? '📅 单日模式' : '📆 日期范围模式'}
          </button>

          {dateRangeMode && (
            <div className="mt-3 space-y-2">
              <div>
                <label className="block text-xs text-gray-600 mb-1">开始日期</label>
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-xs text-gray-600 mb-1">结束日期</label>
                <input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded focus:ring-2 focus:ring-blue-500"
                />
              </div>
              {startDate && endDate && (
                <div className="text-xs text-gray-500 text-center">
                  已选择：{startDate} 至 {endDate}
                </div>
              )}
            </div>
          )}
        </div>

        {/* AI 总结按钮 */}
        <div className="bg-white rounded-lg shadow p-4">
          <h3 className="text-sm font-semibold text-gray-800 mb-3">✨ AI 总结</h3>
          <div className="space-y-2">
            <button
              onClick={handleGenerateAISummary}
              disabled={aiSummaryLoading || (dateRangeMode && (!startDate || !endDate))}
              className={`w-full py-2 text-sm rounded-lg transition ${
                aiSummaryLoading
                  ? 'bg-gray-300 cursor-not-allowed'
                  : 'bg-gradient-to-r from-purple-500 to-pink-500 text-white hover:from-purple-600 hover:to-pink-600'
              }`}
            >
              {aiSummaryLoading ? '生成中...' : '🤖 生成 AI 总结'}
            </button>

            {showRegenerate && (
              <button
                onClick={handleRegenerateSummary}
                className="w-full py-2 text-sm rounded-lg bg-yellow-400 text-yellow-900 font-semibold animate-pulse hover:bg-yellow-500 transition"
              >
                ✨ AI 重新总结
              </button>
            )}
          </div>
        </div>
      </div>

      {/* 右侧：记录列表 */}
      <div className="lg:col-span-3 space-y-6">
        {/* AI 总结显示 */}
        {aiSummary && (
          <div className="bg-gradient-to-r from-purple-50 to-pink-50 rounded-lg shadow p-6 border-l-4 border-purple-500">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold text-purple-800">📊 AI 总结报告</h3>
              <button
                onClick={() => setAiSummary(null)}
                className="text-xs text-purple-600 hover:text-purple-800"
              >
                收起
              </button>
            </div>
            <pre className="whitespace-pre-wrap text-sm text-gray-700 font-sans bg-white p-4 rounded">
              {aiSummary}
            </pre>
          </div>
        )}

        {/* 任务日志 */}
        {taskLogs.length > 0 && (
          <div className="bg-white rounded-lg shadow p-6">
            <h3 className="text-sm font-semibold text-gray-800 mb-4">
              ✅ 任务记录 ({taskLogs.length})
            </h3>
            <div className="space-y-3 max-h-96 overflow-y-auto">
              {taskLogs.map((task) => (
                <div key={task.id} className="border border-gray-200 rounded-lg p-3">
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-medium text-gray-800">{task.task_title}</span>
                    <div className="flex items-center gap-2">
                      {task.priority && (
                        <span className={`px-2 py-0.5 text-xs rounded ${
                          task.priority === 'high' ? 'bg-red-100 text-red-700' :
                          task.priority === 'medium' ? 'bg-yellow-100 text-yellow-700' :
                          'bg-green-100 text-green-700'
                        }`}>
                          {task.priority === 'high' ? '高' : task.priority === 'medium' ? '中' : '低'}
                        </span>
                      )}
                      <span className="text-xs text-gray-500">
                        {task.time_spent_minutes ? `${task.time_spent_minutes}分钟` : ''}
                      </span>
                    </div>
                  </div>
                  {task.outcome && (
                    <p className="text-sm text-gray-600">{task.outcome}</p>
                  )}
                  {task.reflection && (
                    <p className="text-xs text-gray-500 mt-2">
                      <span className="font-medium">反思：</span>{task.reflection}
                    </p>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* 工作记录 */}
        {records.length > 0 && (
          <div className="bg-white rounded-lg shadow p-6">
            <h3 className="text-sm font-semibold text-gray-800 mb-4">
              📝 工作记录 ({records.length})
            </h3>
            <div className="space-y-3 max-h-96 overflow-y-auto">
              {records.map((record) => (
                <div key={record.id} className="border border-gray-200 rounded-lg p-3">
                  <div className="flex items-center gap-2 mb-2 flex-wrap">
                    <span className="text-xs text-gray-500">
                      {new Date(record.created_at).toLocaleString('zh-CN')}
                    </span>
                    {record.structured_data && (
                      <>
                        <span className={`px-2 py-0.5 text-xs rounded ${
                          record.structured_data.value_level === 'high' ? 'bg-green-100 text-green-700' :
                          record.structured_data.value_level === 'medium' ? 'bg-yellow-100 text-yellow-700' :
                          'bg-gray-100 text-gray-700'
                        }`}>
                          {record.structured_data.value_level === 'high' ? '高价值' :
                           record.structured_data.value_level === 'medium' ? '中价值' : '一般'}
                        </span>
                        {record.structured_data.task_category && (
                          <span className="px-2 py-0.5 text-xs rounded bg-purple-100 text-purple-700">
                            {categoryLabels[record.structured_data.task_category] || record.structured_data.task_category}
                          </span>
                        )}
                      </>
                    )}
                  </div>
                  <p className="text-sm text-gray-700">{record.original_text}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* 空状态 */}
        {records.length === 0 && taskLogs.length === 0 && (
          <div className="bg-white rounded-lg shadow p-12 text-center">
            <div className="text-4xl mb-4">📭</div>
            <p className="text-gray-500">
              {dateRangeMode && startDate && endDate
                ? `所选时间段 (${startDate} 至 ${endDate}) 暂无记录`
                : `${selectedDate} 暂无记录`}
            </p>
            <p className="text-xs text-gray-400 mt-2">
              去任务追踪页面添加新任务吧！
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
