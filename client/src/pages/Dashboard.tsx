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
  const [loading, setLoading] = useState(true);

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

    // 加载任务日志
    const taskLogsRes = await fetch('/api/task-logs', {
      headers: { 'X-User-Id': token }
    });
    const taskLogsData = await taskLogsRes.json();
    if (taskLogsData.data) {
      setTaskLogs(taskLogsData.data);
    }

    setLoading(false);
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

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-gray-500">加载仪表板中...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* 统计摘要 */}
      <div className="bg-white rounded-lg shadow p-6">
        <h3 className="text-lg font-semibold text-gray-800 mb-4">📈 总体统计</h3>
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
