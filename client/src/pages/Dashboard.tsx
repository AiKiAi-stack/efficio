import { useState, useEffect } from 'react';
import { PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

interface WorkRecord {
  id: string;
  created_at: string;
  structured_data: {
    task_category: string;
    time_spent: string;
    value_level: string;
    is_deep_work: boolean;
    interruptions?: number;
  } | null;
}

interface TaskLog {
  id: string;
  task_title: string;
  task_category: string | null;
  status: 'pending' | 'in_progress' | 'completed';
  outcome: string | null;
  reflection: string | null;
  time_spent_minutes: number | null;
  priority: string | null;
  created_at: string;
}

interface TimeDistribution {
  hourlyDistribution: { hour: number; count: number }[];
  peakHours: number[];
  deepWorkWindows: { start: number; end: number; score: number }[];
  workDayPattern: 'morning' | 'afternoon' | 'evening' | 'balanced';
}

interface WorkInsights {
  productivityScore: number;
  deepWorkRatio: number;
  focusQuality: 'excellent' | 'good' | 'needs_improvement' | 'poor';
  topCategories: { category: string; percentage: number }[];
  valueContribution: { high: number; medium: number; low: number };
  identifiedPatterns: string[];
  improvementAreas: string[];
}

interface Recommendation {
  title: string;
  category: string;
  priority: 'high' | 'medium' | 'low';
  action: string;
  expected_impact: string;
}

interface SummaryMetrics {
  totalRecords: number;
  totalTasks: number;
  completedTasks: number;
  totalDeepWorkHours: number;
  averageInterruptionScore: number;
  highValueWorkPercentage: number;
}

const COLORS = ['#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#EC4899', '#6B7280'];

const categoryLabels: Record<string, string> = {
  development: '开发',
  meeting: '会议',
  communication: '沟通',
  documentation: '文档',
  review: '评审',
  learning: '学习',
  other: '其他'
};

const valueLabels: Record<string, string> = {
  high: '高价值',
  medium: '中价值',
  low: '一般'
};

export default function Dashboard() {
  const [records, setRecords] = useState<WorkRecord[]>([]);
  const [taskLogs, setTaskLogs] = useState<TaskLog[]>([]);

  // AI 总结状态
  const [aiSummary, setAiSummary] = useState<string | null>(null);
  const [aiSummaryLoading, setAiSummaryLoading] = useState(false);
  const [summaryError, setSummaryError] = useState<string | null>(null);
  const [showAiSummaryPanel, setShowAiSummaryPanel] = useState(true);

  // 增强的分析数据状态
  const [timeDistribution, setTimeDistribution] = useState<TimeDistribution | null>(null);
  const [insights, setInsights] = useState<WorkInsights | null>(null);
  const [recommendations, setRecommendations] = useState<Recommendation[] | null>(null);
  const [metrics, setMetrics] = useState<SummaryMetrics | null>(null);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    const token = localStorage.getItem('sessionToken');
    if (!token) return;

    // 加载记录
    const recordsRes = await fetch('/api/records', {
      headers: { 'X-User-Id': token }
    });
    const recordsData = await recordsRes.json();
    if (recordsData.data) {
      setRecords(recordsData.data);
    }

    // 加载任务日志
    const taskLogsRes = await fetch('/api/task-logs', {
      headers: { 'X-User-Id': token }
    });
    const taskLogsData = await taskLogsRes.json();
    if (taskLogsData.data) {
      setTaskLogs(taskLogsData.data);
    }
  };

  // 生成 AI 总结
  const handleGenerateSummary = async (range?: { start: string; end: string }) => {
    const token = localStorage.getItem('sessionToken');
    if (!token) {
      setSummaryError('请先登录');
      setTimeout(() => setSummaryError(null), 3000);
      return;
    }

    setAiSummaryLoading(true);
    setSummaryError(null);

    try {
      const body = range
        ? { start_date: range.start, end_date: range.end, enhanced: true }
        : { date: new Date().toISOString().split('T')[0], enhanced: true };

      const res = await fetch('/api/summaries/range', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-User-Id': token
        },
        body: JSON.stringify(body)
      });

      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.error || `HTTP ${res.status}`);
      }

      const data = await res.json();
      if (data.data?.markdown_content) {
        setAiSummary(data.data.markdown_content);
        // 设置增强的分析数据
        setTimeDistribution(data.data.time_distribution || null);
        setInsights(data.data.insights || null);
        setRecommendations(data.data.recommendations || null);
        setMetrics(data.data.metrics || null);
        setShowAiSummaryPanel(true);
      } else {
        setSummaryError('生成失败：无返回内容');
      }
    } catch (error: any) {
      console.error('Failed to generate summary:', error);
      if (error.message?.includes('401')) {
        setSummaryError('未授权，请重新登录');
      } else if (error.message?.includes('404')) {
        setSummaryError('该时间段暂无记录');
      } else if (error.message?.includes('500')) {
        setSummaryError('服务器错误，请稍后重试');
      } else {
        setSummaryError(error.message || '生成总结失败，请稍后重试');
      }
      setTimeout(() => setSummaryError(null), 5000);
    } finally {
      setAiSummaryLoading(false);
    }
  };

  // 计算图表数据
  const categoryData = Object.entries(
    records.reduce((acc, r) => {
      const cat = r.structured_data?.task_category || 'other';
      acc[cat] = (acc[cat] || 0) + 1;
      return acc;
    }, {} as { [key: string]: number })
  ).map(([name, value]) => ({ name: categoryLabels[name] || name, value }));

  const valueLevelData = Object.entries(
    records.reduce((acc, r) => {
      const level = r.structured_data?.value_level || 'low';
      acc[level] = (acc[level] || 0) + 1;
      return acc;
    }, {} as { [key: string]: number })
  ).map(([name, value]) => ({ name: valueLabels[name] || name, value }));

  // 任务统计数据
  const completedTasks = taskLogs.filter(t => t.status === 'completed');
  const totalTaskTime = completedTasks.reduce((sum, t) => sum + (t.time_spent_minutes || 0), 0);

  // 按优先级统计任务
  const priorityData = [
    { name: '高优先级', value: taskLogs.filter(t => t.priority === 'high').length },
    { name: '中优先级', value: taskLogs.filter(t => t.priority === 'medium').length },
    { name: '低优先级', value: taskLogs.filter(t => t.priority === 'low').length }
  ];

  // 日期范围选择状态
  const [showSummaryRange, setShowSummaryRange] = useState(false);
  const [summaryStart, setSummaryStart] = useState('');
  const [summaryEnd, setSummaryEnd] = useState('');

  return (
    <div className="space-y-6">
      {/* 错误提示 */}
      {summaryError && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-3 flex items-center gap-2">
          <span className="text-xl">⚠️</span>
          <span className="text-sm text-red-700">{summaryError}</span>
          <button
            onClick={() => setSummaryError(null)}
            className="ml-auto text-xs text-red-600 hover:text-red-800"
          >
            关闭
          </button>
        </div>
      )}

      {/* AI 总结显示 */}
      {aiSummary && showAiSummaryPanel && (
        <div className="space-y-6">
          {/* 基础指标卡片 */}
          {metrics && (
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
              <div className="bg-white rounded-lg shadow p-4 text-center">
                <div className="text-2xl font-bold text-blue-600">{metrics.totalRecords}</div>
                <div className="text-xs text-gray-500 mt-1">工作记录</div>
              </div>
              <div className="bg-white rounded-lg shadow p-4 text-center">
                <div className="text-2xl font-bold text-green-600">{metrics.completedTasks}/{metrics.totalTasks}</div>
                <div className="text-xs text-gray-500 mt-1">完成任务</div>
              </div>
              <div className="bg-white rounded-lg shadow p-4 text-center">
                <div className="text-2xl font-bold text-purple-600">{metrics.totalDeepWorkHours.toFixed(1)}h</div>
                <div className="text-xs text-gray-500 mt-1">深度工作</div>
              </div>
              <div className="bg-white rounded-lg shadow p-4 text-center">
                <div className="text-2xl font-bold text-orange-600">{metrics.highValueWorkPercentage}%</div>
                <div className="text-xs text-gray-500 mt-1">高价值占比</div>
              </div>
              <div className="bg-white rounded-lg shadow p-4 text-center">
                <div className="text-2xl font-bold text-red-600">{metrics.averageInterruptionScore}</div>
                <div className="text-xs text-gray-500 mt-1">平均打断</div>
              </div>
              {insights && (
                <div className="bg-white rounded-lg shadow p-4 text-center">
                  <div className={`text-2xl font-bold ${
                    insights.productivityScore >= 80 ? 'text-green-600' :
                    insights.productivityScore >= 60 ? 'text-blue-600' :
                    insights.productivityScore >= 40 ? 'text-yellow-600' : 'text-red-600'
                  }`}>{insights.productivityScore}</div>
                  <div className="text-xs text-gray-500 mt-1">生产力评分</div>
                </div>
              )}
            </div>
          )}

          {/* 时间分布图表 */}
          {timeDistribution && timeDistribution.hourlyDistribution && (
            <div className="bg-white rounded-lg shadow p-6">
              <h3 className="text-md font-semibold text-gray-800 mb-4">⏱️ 时间分布分析</h3>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                <div>
                  <h4 className="text-sm text-gray-600 mb-2">工作时段分布</h4>
                  <ResponsiveContainer width="100%" height={200}>
                    <BarChart data={timeDistribution.hourlyDistribution.filter(h => h.count > 0)}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="hour" tickFormatter={(h) => `${h}:00`} />
                      <YAxis />
                      <Tooltip labelFormatter={(h) => `${h}:00`} />
                      <Bar dataKey="count" fill="#3B82F6" name="记录数" />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
                <div className="space-y-3">
                  <div className="p-3 bg-gray-50 rounded">
                    <span className="text-sm font-medium text-gray-700">工作模式：</span>
                    <span className="ml-2 text-sm text-gray-600">
                      {timeDistribution.workDayPattern === 'morning' ? '晨间高效型' :
                       timeDistribution.workDayPattern === 'afternoon' ? '下午高效型' :
                       timeDistribution.workDayPattern === 'evening' ? '夜间工作型' : '均衡分布型'}
                    </span>
                  </div>
                  {timeDistribution.peakHours.length > 0 && (
                    <div className="p-3 bg-blue-50 rounded">
                      <span className="text-sm font-medium text-blue-700">高峰时段：</span>
                      <span className="ml-2 text-sm text-blue-600">
                        {timeDistribution.peakHours.map(h => `${h}:00`).join(', ')}
                      </span>
                    </div>
                  )}
                  {timeDistribution.deepWorkWindows.length > 0 && (
                    <div className="p-3 bg-purple-50 rounded">
                      <span className="text-sm font-medium text-purple-700">深度工作窗口：</span>
                      <div className="mt-1 text-sm text-purple-600">
                        {timeDistribution.deepWorkWindows.map((w, i) => (
                          <div key={i}>{w.start}:00 - {w.end}:00 (评分: {w.score})</div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* 洞察和建议 */}
          {insights && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* 工作洞察 */}
              <div className="bg-white rounded-lg shadow p-6">
                <h3 className="text-md font-semibold text-gray-800 mb-4">🎯 工作洞察</h3>
                <div className="space-y-4">
                  <div className="flex items-center justify-between p-3 bg-gray-50 rounded">
                    <span className="text-sm text-gray-600">专注质量</span>
                    <span className={`px-2 py-1 text-xs rounded ${
                      insights.focusQuality === 'excellent' ? 'bg-green-100 text-green-700' :
                      insights.focusQuality === 'good' ? 'bg-blue-100 text-blue-700' :
                      insights.focusQuality === 'needs_improvement' ? 'bg-yellow-100 text-yellow-700' :
                      'bg-red-100 text-red-700'
                    }`}>
                      {insights.focusQuality === 'excellent' ? '优秀' :
                       insights.focusQuality === 'good' ? '良好' :
                       insights.focusQuality === 'needs_improvement' ? '待改进' : '需要关注'}
                    </span>
                  </div>
                  <div className="flex items-center justify-between p-3 bg-gray-50 rounded">
                    <span className="text-sm text-gray-600">深度工作比例</span>
                    <span className="text-sm font-medium text-purple-600">{(insights.deepWorkRatio * 100).toFixed(1)}%</span>
                  </div>
                  {insights.identifiedPatterns.length > 0 && (
                    <div className="p-3 bg-blue-50 rounded">
                      <h4 className="text-sm font-medium text-blue-700 mb-2">识别的模式</h4>
                      <ul className="text-xs text-blue-600 space-y-1">
                        {insights.identifiedPatterns.map((p, i) => (
                          <li key={i}>• {p}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              </div>

              {/* 个性化建议 */}
              {recommendations && recommendations.length > 0 && (
                <div className="bg-white rounded-lg shadow p-6">
                  <h3 className="text-md font-semibold text-gray-800 mb-4">💡 个性化建议</h3>
                  <div className="space-y-3">
                    {recommendations.slice(0, 3).map((rec, i) => (
                      <div key={i} className="p-3 border border-gray-200 rounded hover:bg-gray-50">
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-sm font-medium text-gray-800">{rec.title}</span>
                          <span className={`px-2 py-0.5 text-xs rounded ${
                            rec.priority === 'high' ? 'bg-red-100 text-red-700' :
                            rec.priority === 'medium' ? 'bg-yellow-100 text-yellow-700' :
                            'bg-green-100 text-green-700'
                          }`}>
                            {rec.priority === 'high' ? '高' : rec.priority === 'medium' ? '中' : '低'}
                          </span>
                        </div>
                        <p className="text-xs text-gray-600 mb-1">{rec.action}</p>
                        <p className="text-xs text-gray-400">预期效果: {rec.expected_impact}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* 完整的 Markdown 报告 */}
          <div className="bg-gradient-to-r from-purple-50 to-pink-50 rounded-lg shadow p-6 border-l-4 border-purple-500">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold text-purple-800">📊 AI 详细报告</h3>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setShowAiSummaryPanel(!showAiSummaryPanel)}
                  className="text-xs text-purple-600 hover:text-purple-800"
                >
                  {showAiSummaryPanel ? '收起' : '展开'}
                </button>
                <button
                  onClick={() => {
                    setAiSummary(null);
                    setTimeDistribution(null);
                    setInsights(null);
                    setRecommendations(null);
                    setMetrics(null);
                    setShowAiSummaryPanel(true);
                  }}
                  className="text-xs text-purple-600 hover:text-purple-800"
                >
                  关闭
                </button>
              </div>
            </div>
            <pre className="whitespace-pre-wrap text-sm text-gray-700 font-sans bg-white p-4 rounded max-h-96 overflow-y-auto">
              {aiSummary}
            </pre>
          </div>
        </div>
      )}

      {/* 统计摘要 */}
      <div className="bg-white rounded-lg shadow p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-gray-800">📈 总体统计</h3>
          <div className="flex items-center gap-2">
            {!showSummaryRange ? (
              <button
                onClick={() => setShowSummaryRange(true)}
                className="px-3 py-1.5 text-sm bg-gradient-to-r from-purple-500 to-pink-500 text-white rounded-lg hover:from-purple-600 hover:to-pink-600 transition"
              >
                ✨ 生成 AI 总结
              </button>
            ) : (
              <div className="flex items-center gap-2">
                <input
                  type="date"
                  value={summaryStart}
                  onChange={(e) => setSummaryStart(e.target.value)}
                  className="px-2 py-1 text-sm border border-gray-300 rounded"
                />
                <span className="text-gray-500">至</span>
                <input
                  type="date"
                  value={summaryEnd}
                  onChange={(e) => setSummaryEnd(e.target.value)}
                  className="px-2 py-1 text-sm border border-gray-300 rounded"
                />
                <button
                  onClick={() => {
                    if (summaryStart && summaryEnd) {
                      handleGenerateSummary({ start: summaryStart, end: summaryEnd });
                    } else {
                      handleGenerateSummary();
                    }
                    setShowSummaryRange(false);
                  }}
                  className="px-3 py-1.5 text-sm bg-gradient-to-r from-purple-500 to-pink-500 text-white rounded-lg hover:from-purple-600 hover:to-pink-600 transition"
                >
                  {aiSummaryLoading ? '生成中...' : '生成'}
                </button>
                <button
                  onClick={() => setShowSummaryRange(false)}
                  className="px-2 py-1 text-xs text-gray-500 hover:text-gray-700"
                >
                  取消
                </button>
              </div>
            )}
          </div>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="text-center p-4 bg-blue-50 rounded-lg">
            <div className="text-2xl font-bold text-blue-600">{records.length}</div>
            <div className="text-sm text-gray-600 mt-1">工作记录</div>
          </div>
          <div className="text-center p-4 bg-green-50 rounded-lg">
            <div className="text-2xl font-bold text-green-600">{completedTasks.length}</div>
            <div className="text-sm text-gray-600 mt-1">完成任务</div>
          </div>
          <div className="text-center p-4 bg-purple-50 rounded-lg">
            <div className="text-2xl font-bold text-purple-600">{records.filter(r => r.structured_data?.value_level === 'high').length}</div>
            <div className="text-sm text-gray-600 mt-1">高价值工作</div>
          </div>
          <div className="text-center p-4 bg-orange-50 rounded-lg">
            <div className="text-2xl font-bold text-orange-600">{Math.round(totalTaskTime / 60 * 10) / 10}h</div>
            <div className="text-sm text-gray-600 mt-1">任务总时长</div>
          </div>
        </div>
      </div>

      {/* 图表区域 */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {/* 任务类别分布 */}
        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-md font-semibold text-gray-800 mb-4">📁 任务类别分布</h3>
          <ResponsiveContainer width="100%" height={250}>
            <PieChart>
              <Pie
                data={categoryData}
                cx="50%"
                cy="50%"
                labelLine={false}
                label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                outerRadius={80}
                fill="#8884d8"
                dataKey="value"
              >
                {categoryData.map((_, index) => (
                  <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
        </div>

        {/* 价值等级分布 */}
        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-md font-semibold text-gray-800 mb-4">💎 价值等级分布</h3>
          <ResponsiveContainer width="100%" height={250}>
            <PieChart>
              <Pie
                data={valueLevelData}
                cx="50%"
                cy="50%"
                labelLine={false}
                label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                outerRadius={80}
                fill="#8884d8"
                dataKey="value"
              >
                {valueLevelData.map((_, index) => (
                  <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
        </div>

        {/* 任务优先级分布 */}
        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-md font-semibold text-gray-800 mb-4">🎯 任务优先级分布</h3>
          <ResponsiveContainer width="100%" height={250}>
            <BarChart data={priorityData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="name" />
              <YAxis />
              <Tooltip />
              <Bar dataKey="value" fill="#8B5CF6" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* 最近完成的任务 */}
      {completedTasks.length > 0 && (
        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-lg font-semibold text-gray-800 mb-4">✅ 最近完成的任务</h3>
          <div className="space-y-3 max-h-64 overflow-y-auto">
            {completedTasks.slice(0, 10).map((task) => (
              <div key={task.id} className="border border-gray-200 rounded-lg p-3">
                <div className="flex items-center justify-between">
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
                  <p className="text-sm text-gray-600 mt-2">{task.outcome}</p>
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

      {/* 科学提示 */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <h3 className="text-sm font-medium text-blue-800 mb-2">💡 效率洞察</h3>
        <ul className="text-xs text-blue-700 space-y-1">
          <li>• 高价值工作占比：{records.length > 0 ? ((records.filter(r => r.structured_data?.value_level === 'high').length / records.length) * 100).toFixed(1) : 0}%</li>
          <li>• 任务完成率：{taskLogs.length > 0 ? ((completedTasks.length / taskLogs.length) * 100).toFixed(1) : 0}%</li>
          <li>• 平均任务时长：{completedTasks.length > 0 ? Math.round(totalTaskTime / completedTasks.length) : 0} 分钟</li>
        </ul>
      </div>
    </div>
  );
}
