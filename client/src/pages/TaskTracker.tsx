import { useState, useEffect } from 'react';

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
  tags: string[] | null;
  created_at: string;
}

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001/api';

export default function TaskTracker() {
  const token = localStorage.getItem('sessionToken');

  // 当前任务状态
  const [taskTitle, setTaskTitle] = useState('');
  const [taskDescription, setTaskDescription] = useState('');
  const [taskCategory, setTaskCategory] = useState('');
  const [priority, setPriority] = useState('medium');

  // 执行阶段
  const [outcome, setOutcome] = useState('');
  const [status, setStatus] = useState<'pending' | 'in_progress' | 'completed'>('pending');
  const [startTime, setStartTime] = useState<string | null>(null);

  // 反思阶段
  const [reflection, setReflection] = useState('');

  const [loading, setLoading] = useState(false);
  const [currentTaskId, setCurrentTaskId] = useState<string | null>(null);

  // 任务历史 - 只显示当天
  const [taskHistory, setTaskHistory] = useState<TaskLog[]>([]);
  const [showHistory, setShowHistory] = useState(false);
  const [expanded, setExpanded] = useState(true); // 控制历史记录展开/收起

  // 加载当前任务
  useEffect(() => {
    loadActiveTask();
    loadTaskHistory();
  }, []);

  const loadActiveTask = async () => {
    if (!token) return;
    try {
      const res = await fetch(`${API_URL}/task-logs`, {
        headers: { 'X-User-Id': token }
      });
      const data = await res.json();
      if (data.data && data.data.length > 0) {
        // 找到未完成的任务
        const activeTask = data.data.find((t: TaskLog) => t.status !== 'completed');
        if (activeTask) {
          setTaskTitle(activeTask.task_title);
          setTaskDescription(activeTask.task_description || '');
          setTaskCategory(activeTask.task_category || '');
          setPriority(activeTask.priority || 'medium');
          setStartTime(activeTask.start_time);
          setStatus(activeTask.status);
          setOutcome(activeTask.outcome || '');
          setReflection(activeTask.reflection || '');
          setCurrentTaskId(activeTask.id);
        }
      }
    } catch (error) {
      console.error('Failed to load active task:', error);
    }
  };

  const loadTaskHistory = async () => {
    if (!token) return;
    try {
      const res = await fetch(`${API_URL}/task-logs`, {
        headers: { 'X-User-Id': token }
      });
      const data = await res.json();
      if (data.data) {
        // 只保留当天完成的任务
        const today = new Date().toDateString();
        const todaysTasks = data.data.filter((t: TaskLog) =>
          t.status === 'completed' && new Date(t.created_at).toDateString() === today
        );
        setTaskHistory(todaysTasks);
      }
    } catch (error) {
      console.error('Failed to load history:', error);
    }
  };

  // 阶段 1: 开始任务 (Plan)
  const handleStartTask = async () => {
    if (!taskTitle.trim()) {
      alert('请先填写任务标题！');
      return;
    }

    setLoading(true);
    try {
      const res = await fetch(`${API_URL}/task-logs`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-User-Id': token!
        },
        body: JSON.stringify({
          task_title: taskTitle,
          task_description: taskDescription,
          task_category: taskCategory,
          priority: priority,
          status: 'in_progress'
        })
      });

      const data = await res.json();
      if (data.data) {
        setCurrentTaskId(data.data.id);
        setStartTime(data.data.start_time);
        setStatus('in_progress');
      }
    } catch (error) {
      console.error('Failed to start task:', error);
    } finally {
      setLoading(false);
    }
  };

  // 阶段 2: 完成任务 (Do)
  const handleCompleteTask = async () => {
    if (!outcome.trim()) {
      alert('请先填写完成内容！');
      return;
    }

    setLoading(true);
    try {
      const res = await fetch(`${API_URL}/task-logs`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-User-Id': token!
        },
        body: JSON.stringify({
          id: currentTaskId,
          task_title: taskTitle,
          task_description: taskDescription,
          task_category: taskCategory,
          priority: priority,
          outcome: outcome,
          status: 'completed'
        })
      });

      const data = await res.json();
      if (data.data) {
        setStatus('completed');
        loadTaskHistory();
      }
    } catch (error) {
      console.error('Failed to complete task:', error);
    } finally {
      setLoading(false);
    }
  };

  // 阶段 3: 保存反思 (Check/Act)
  const handleSaveReflection = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API_URL}/task-logs`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-User-Id': token!
        },
        body: JSON.stringify({
          id: currentTaskId,
          task_title: taskTitle,
          task_description: taskDescription,
          task_category: taskCategory,
          priority: priority,
          outcome: outcome,
          reflection: reflection,
          status: 'completed'
        })
      });

      const data = await res.json();
      if (data.success) {
        alert('✅ 已保存');
        loadTaskHistory();
      }
    } catch (error) {
      console.error('Failed to save reflection:', error);
      alert('保存失败');
    } finally {
      setLoading(false);
    }
  };

  // 重置以开始新任务
  const handleNewTask = () => {
    setTaskTitle('');
    setTaskDescription('');
    setTaskCategory('');
    setPriority('medium');
    setOutcome('');
    setReflection('');
    setStatus('pending');
    setStartTime(null);
    setCurrentTaskId(null);
  };

  return (
    <div className="space-y-4">
      {/* 横向三阶段布局 */}
      <div className="grid grid-cols-3 gap-4">
        {/* 阶段 1: 任务设定 (Plan) */}
        <div className={`bg-white rounded-lg shadow p-4 border-l-4 ${
          status === 'pending' ? 'border-blue-500' :
          status === 'in_progress' ? 'border-green-500' : 'border-gray-300'
        }`}>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold text-gray-800">
              📍 任务设定 (Plan)
            </h2>
            {status !== 'pending' && (
              <span className="text-xs text-green-600 bg-green-100 px-2 py-0.5 rounded">
                已完成
              </span>
            )}
          </div>

          <div className="space-y-3">
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">
                任务标题 *
              </label>
              <input
                type="text"
                value={taskTitle}
                onChange={(e) => setTaskTitle(e.target.value)}
                disabled={status !== 'pending'}
                className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:bg-gray-100"
                placeholder="例如：完成登录页面"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">
                任务描述
              </label>
              <textarea
                value={taskDescription}
                onChange={(e) => setTaskDescription(e.target.value)}
                disabled={status !== 'pending'}
                className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none disabled:bg-gray-100"
                rows={2}
                placeholder="可选：详细描述..."
              />
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">
                  类别
                </label>
                <select
                  value={taskCategory}
                  onChange={(e) => setTaskCategory(e.target.value)}
                  disabled={status !== 'pending'}
                  className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100"
                >
                  <option value="">选择类别</option>
                  <option value="development">开发</option>
                  <option value="meeting">会议</option>
                  <option value="communication">沟通</option>
                  <option value="documentation">文档</option>
                  <option value="review">评审</option>
                  <option value="learning">学习</option>
                  <option value="other">其他</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">
                  优先级
                </label>
                <select
                  value={priority}
                  onChange={(e) => setPriority(e.target.value)}
                  disabled={status !== 'pending'}
                  className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100"
                >
                  <option value="high">高</option>
                  <option value="medium">中</option>
                  <option value="low">低</option>
                </select>
              </div>
            </div>

            {status === 'pending' && (
              <button
                onClick={handleStartTask}
                disabled={loading || !taskTitle.trim()}
                className="w-full bg-blue-600 text-white py-1.5 text-sm rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition"
              >
                {loading ? '保存中...' : '🚀 开始任务'}
              </button>
            )}
          </div>
        </div>

        {/* 阶段 2: 执行追踪 (Do) */}
        <div className={`bg-white rounded-lg shadow p-4 border-l-4 ${
          status === 'in_progress' ? 'border-yellow-500' :
          status === 'completed' ? 'border-green-500' : 'border-gray-300'
        } ${status === 'pending' && 'opacity-50'}`}>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold text-gray-800">
              ✅ 执行追踪 (Do)
            </h2>
            {startTime && status !== 'pending' && (
              <span className="text-xs text-gray-500">
                {new Date(startTime).toLocaleTimeString('zh-CN', {hour: '2-digit', minute:'2-digit'})}
              </span>
            )}
            {status === 'completed' && (
              <span className="text-xs text-green-600 bg-green-100 px-2 py-0.5 rounded">
                已完成
              </span>
            )}
          </div>

          <div className="space-y-3">
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">
                实际完成了什么 *
              </label>
              <textarea
                value={outcome}
                onChange={(e) => setOutcome(e.target.value)}
                disabled={status === 'pending'}
                className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded focus:ring-2 focus:ring-green-500 focus:border-transparent resize-none disabled:bg-gray-100"
                rows={3}
                placeholder="例如：&#10;✓ 完成了登录表单&#10;✓ 添加了邮箱验证"
              />
            </div>

            {status === 'in_progress' && (
              <button
                onClick={handleCompleteTask}
                disabled={loading || !outcome.trim()}
                className="w-full bg-green-600 text-white py-1.5 text-sm rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition"
              >
                {loading ? '保存中...' : '✓ 标记完成'}
              </button>
            )}
          </div>
        </div>

        {/* 阶段 3: 反思 (Check/Act) */}
        <div className={`bg-white rounded-lg shadow p-4 border-l-4 ${
          status === 'completed' ? 'border-purple-500' : 'border-gray-300'
        } ${status !== 'completed' && 'opacity-50'}`}>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold text-gray-800">
              🤔 反思 (Check/Act)
            </h2>
          </div>

          <div className="space-y-3">
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">
                任务反思
              </label>
              <textarea
                value={reflection}
                onChange={(e) => setReflection(e.target.value)}
                disabled={status !== 'completed'}
                className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded focus:ring-2 focus:ring-purple-500 focus:border-transparent resize-none disabled:bg-gray-100"
                rows={3}
                placeholder="例如：&#10;好的：专注度高&#10;改进：减少打扰"
              />
            </div>

            {status === 'completed' && (
              <>
                <button
                  onClick={handleSaveReflection}
                  disabled={loading}
                  className="w-full bg-purple-600 text-white py-1.5 text-sm rounded-lg hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed transition"
                >
                  {loading ? '保存中...' : '💾 保存反思'}
                </button>
                <button
                  onClick={handleNewTask}
                  className="w-full bg-gray-600 text-white py-1.5 text-sm rounded-lg hover:bg-gray-700 transition"
                >
                  ➕ 新任务
                </button>
              </>
            )}
          </div>
        </div>
      </div>

      {/* 任务历史切换 - 只显示当天 */}
      <div className="bg-white rounded-lg shadow">
        <div className="flex items-center justify-between px-4 py-2">
          <button
            onClick={() => setShowHistory(!showHistory)}
            className="text-sm font-medium text-gray-700 hover:bg-gray-50 rounded-lg px-2 py-1"
          >
            {showHistory ? '📋 隐藏历史' : '📋 查看历史'} ({taskHistory.length})
          </button>
          {showHistory && taskHistory.length > 0 && (
            <button
              onClick={() => setExpanded(!expanded)}
              className="text-xs text-gray-500 hover:text-gray-700 px-2 py-1"
            >
              {expanded ? '▲ 收起' : '▼ 展开'}
            </button>
          )}
        </div>

        {showHistory && taskHistory.length > 0 && (
          <div className={`border-t border-gray-200 transition-all ${
            expanded ? 'max-h-48' : 'max-h-24'
          } overflow-y-auto p-2`}>
            {taskHistory.map((task) => (
              <div key={task.id} className="text-sm p-2 hover:bg-gray-50 rounded">
                <div className="flex items-center justify-between">
                  <span className="font-medium text-gray-800">{task.task_title}</span>
                  <span className="text-xs text-gray-500">
                    {task.time_spent_minutes ? `${task.time_spent_minutes}分钟` : ''}
                  </span>
                </div>
                <div className="text-xs text-gray-600 mt-1 truncate">
                  {task.outcome}
                </div>
              </div>
            ))}
          </div>
        )}

        {showHistory && taskHistory.length === 0 && (
          <div className="border-t border-gray-200 p-4 text-center text-sm text-gray-500">
            今天还没有完成的任务
          </div>
        )}
      </div>

      {/* 科学提示 */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
        <h3 className="text-xs font-medium text-blue-800 mb-1">💡 任务级别追踪的好处</h3>
        <ul className="text-xs text-blue-700 space-y-0.5">
          <li>• 更精确的时间感知和规划能力</li>
          <li>• 减少"一天什么都没干"的挫败感</li>
          <li>• 积累任务完成数据，优化未来估算</li>
        </ul>
      </div>
    </div>
  );
}
