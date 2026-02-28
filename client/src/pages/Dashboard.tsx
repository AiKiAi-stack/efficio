import { useState, useEffect } from 'react';
import { PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, LineChart, Line } from 'recharts';

interface Record {
  id: string;
  created_at: string;
  structured_data: {
    task_category: string;
    time_spent: string;
    value_level: string;
    is_deep_work: boolean;
  } | null;
}

interface WeeklySummary {
  id: string;
  week_start: string;
  markdown_content: string;
}

interface Suggestion {
  id: string;
  suggestion_data: {
    title: string;
    category: string;
    priority: string;
    why: string;
    how: string;
  };
  is_actioned: boolean;
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
  const [records, setRecords] = useState<Record[]>([]);
  const [summaries, setSummaries] = useState<WeeklySummary[]>([]);
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState<'week' | 'month' | 'suggestion' | null>(null);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
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

    // 加载周总结
    const summariesRes = await fetch('/api/summaries/weekly', {
      headers: { 'X-User-Id': token }
    });
    const summariesData = await summariesRes.json();
    if (summariesData.data) {
      setSummaries(summariesData.data);
    }

    // 加载建议
    const suggestionsRes = await fetch('/api/suggestions', {
      headers: { 'X-User-Id': token }
    });
    const suggestionsData = await suggestionsRes.json();
    if (suggestionsData.data) {
      setSuggestions(suggestionsData.data);
    }

    setLoading(false);
  };

  const handleGenerateWeekly = async () => {
    setGenerating('week');
    const token = localStorage.getItem('sessionToken');
    if (!token) return;

    // 计算本周一和周日
    const now = new Date();
    const dayOfWeek = now.getDay();
    const diff = now.getDate() - dayOfWeek + (dayOfWeek === 0 ? -6 : 1);
    const monday = new Date(now.setDate(diff));
    const sunday = new Date(now.setDate(monday.getDate() + 6));

    const res = await fetch('/api/summaries/weekly/generate', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-User-Id': token,
      },
      body: JSON.stringify({
        week_start: monday.toISOString().split('T')[0],
        week_end: sunday.toISOString().split('T')[0]
      })
    });

    const data = await res.json();
    if (data.data) {
      setSummaries([data.data, ...summaries]);
    }
    setGenerating(null);
  };

  const handleGenerateSuggestions = async () => {
    setGenerating('suggestion');
    const token = localStorage.getItem('sessionToken');
    if (!token) return;

    const res = await fetch('/api/suggestions/generate', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-User-Id': token,
      }
    });

    const data = await res.json();
    if (data.data?.suggestions) {
      // 重新加载建议列表
      await loadData();
    }
    setGenerating(null);
  };

  // 计算图表数据
  const categoryData = Object.entries(
    records.reduce((acc, r) => {
      const cat = r.structured_data?.task_category || 'other';
      acc[cat] = (acc[cat] || 0) + 1;
      return acc;
    }, {} as Record<string, number>)
  ).map(([name, value]) => ({ name: categoryLabels[name] || name, value }));

  const valueLevelData = Object.entries(
    records.reduce((acc, r) => {
      const level = r.structured_data?.value_level || 'low';
      acc[level] = (acc[level] || 0) + 1;
      return acc;
    }, {} as Record<string, number>)
  ).map(([name, value]) => ({ name: valueLabels[name] || name, value }));

  const deepWorkData = [
    { name: '深度工作', value: records.filter(r => r.structured_data?.is_deep_work).length },
    { name: '浅层工作', value: records.filter(r => r.structured_data && !r.structured_data.is_deep_work).length }
  ];

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-gray-500">加载仪表板中...</div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* 快速操作 */}
      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-lg font-semibold text-gray-800 mb-4">📊 分析工具</h2>
        <div className="flex gap-3 flex-wrap">
          <button
            onClick={handleGenerateWeekly}
            disabled={generating === 'week'}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 transition"
          >
            {generating === 'week' ? '生成中...' : '生成本周总结'}
          </button>
          <button
            onClick={handleGenerateSuggestions}
            disabled={generating === 'suggestion'}
            className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50 transition"
          >
            {generating === 'suggestion' ? '生成中...' : '生成优化建议'}
          </button>
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
                {categoryData.map((entry, index) => (
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
                {valueLevelData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
        </div>

        {/* 深度工作 vs 浅层工作 */}
        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-md font-semibold text-gray-800 mb-4">🎯 工作深度分布</h3>
          <ResponsiveContainer width="100%" height={250}>
            <BarChart data={deepWorkData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="name" />
              <YAxis />
              <Tooltip />
              <Bar dataKey="value" fill="#8B5CF6" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* 统计摘要 */}
      <div className="bg-white rounded-lg shadow p-6">
        <h3 className="text-lg font-semibold text-gray-800 mb-4">📈 统计摘要</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="text-center p-4 bg-blue-50 rounded-lg">
            <div className="text-2xl font-bold text-blue-600">{records.length}</div>
            <div className="text-sm text-gray-600 mt-1">总记录数</div>
          </div>
          <div className="text-center p-4 bg-green-50 rounded-lg">
            <div className="text-2xl font-bold text-green-600">
              {records.filter(r => r.structured_data?.value_level === 'high').length}
            </div>
            <div className="text-sm text-gray-600 mt-1">高价值工作</div>
          </div>
          <div className="text-center p-4 bg-purple-50 rounded-lg">
            <div className="text-2xl font-bold text-purple-600">
              {records.filter(r => r.structured_data?.is_deep_work).length}
            </div>
            <div className="text-sm text-gray-600 mt-1">深度工作</div>
          </div>
          <div className="text-center p-4 bg-orange-50 rounded-lg">
            <div className="text-2xl font-bold text-orange-600">
              {summaries.length}
            </div>
            <div className="text-sm text-gray-600 mt-1">周总结</div>
          </div>
        </div>
      </div>

      {/* 优化建议 */}
      {suggestions.length > 0 && (
        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-lg font-semibold text-gray-800 mb-4">💡 优化建议</h3>
          <div className="space-y-4">
            {suggestions.slice(0, 5).map((suggestion) => (
              <div
                key={suggestion.id}
                className={`p-4 rounded-lg border-l-4 ${
                  suggestion.is_actioned ? 'bg-gray-50 border-gray-400' :
                  suggestion.suggestion_data.priority === 'high' ? 'bg-red-50 border-red-500' :
                  suggestion.suggestion_data.priority === 'medium' ? 'bg-yellow-50 border-yellow-500' :
                  'bg-green-50 border-green-500'
                }`}
              >
                <div className="flex items-center justify-between mb-2">
                  <h4 className="font-semibold text-gray-800">{suggestion.suggestion_data.title}</h4>
                  <span className={`px-2 py-1 text-xs rounded ${
                    suggestion.suggestion_data.priority === 'high' ? 'bg-red-100 text-red-700' :
                    suggestion.suggestion_data.priority === 'medium' ? 'bg-yellow-100 text-yellow-700' :
                    'bg-green-100 text-green-700'
                  }`}>
                    {suggestion.suggestion_data.priority === 'high' ? '高优先级' :
                     suggestion.suggestion_data.priority === 'medium' ? '中优先级' : '低优先级'}
                  </span>
                </div>
                <p className="text-sm text-gray-600 mb-2"><strong>为什么：</strong>{suggestion.suggestion_data.why}</p>
                <p className="text-sm text-gray-700"><strong>怎么做：</strong>{suggestion.suggestion_data.how}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 周总结列表 */}
      {summaries.length > 0 && (
        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-lg font-semibold text-gray-800 mb-4">📋 周总结报告</h3>
          <div className="space-y-4">
            {summaries.slice(0, 3).map((summary) => (
              <div key={summary.id} className="border border-gray-200 rounded-lg p-4">
                <div className="text-sm text-gray-500 mb-2">
                  {new Date(summary.week_start).toLocaleDateString('zh-CN')}
                </div>
                <div className="prose prose-sm max-w-none">
                  <pre className="whitespace-pre-wrap text-gray-700 font-sans text-sm bg-gray-50 p-4 rounded">
                    {summary.markdown_content}
                  </pre>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
