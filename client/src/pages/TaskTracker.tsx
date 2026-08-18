import { useState, useEffect } from 'react';
import { getUserId } from '../api';

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
  estimated_duration: string | null;
  tags: string[] | null;
  created_at: string;
}

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001/api';

type Filter = 'all' | 'in_progress' | 'pending' | 'completed';

const CATEGORY_LABELS: Record<string, string> = {
  development: '开发',
  meeting: '会议',
  communication: '沟通',
  documentation: '文档',
  review: '评审',
  learning: '学习',
  other: '其他'
};

const PRIORITY_STYLES: Record<string, { label: string; cls: string }> = {
  high: { label: '高', cls: 'bg-red-100 text-red-700' },
  medium: { label: '中', cls: 'bg-amber-100 text-amber-700' },
  low: { label: '低', cls: 'bg-gray-100 text-gray-600' }
};

const STATUS_STYLES: Record<string, { label: string; cls: string }> = {
  pending: { label: '待办', cls: 'bg-gray-100 text-gray-600' },
  in_progress: { label: '进行中', cls: 'bg-blue-100 text-blue-700' },
  completed: { label: '已完成', cls: 'bg-green-100 text-green-700' }
};

function formatDuration(minutes: number | null): string {
  if (minutes == null) return '';
  if (minutes < 60) return `${minutes}分钟`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m > 0 ? `${h}小时${m}分` : `${h}小时`;
}

function elapsedSince(iso: string | null): string {
  if (!iso) return '';
  const mins = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
  if (mins < 1) return '刚刚开始';
  if (mins < 60) return `已进行 ${mins}分钟`;
  const h = Math.floor(mins / 60);
  return `已进行 ${h}小时${mins % 60}分`;
}

interface TaskCardProps {
  task: TaskLog;
  onChanged: () => void;
  onError: (msg: string) => void;
}

function TaskCard({ task, onChanged, onError }: TaskCardProps) {
  const userId = getUserId();
  const [outcome, setOutcome] = useState(task.outcome || '');
  const [reflection, setReflection] = useState(task.reflection || '');
  const [saving, setSaving] = useState(false);

  const save = async (patch: Partial<TaskLog>) => {
    if (!userId) return;
    setSaving(true);
    try {
      const res = await fetch(`${API_URL}/task-logs`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-User-Id': userId },
        body: JSON.stringify({
          id: task.id,
          task_title: task.task_title,
          task_description: task.task_description,
          task_category: task.task_category,
          priority: task.priority,
          estimated_duration: task.estimated_duration,
          outcome,
          reflection,
          status: task.status,
          ...patch
        })
      });
      const data = await res.json();
      if (data.data) {
        onChanged();
      } else {
        onError(data.error || '保存失败');
      }
    } catch (error) {
      onError('保存失败，请重试');
    } finally {
      setSaving(false);
    }
  };

  const del = async () => {
    if (!window.confirm(`确定删除任务「${task.task_title}」吗？`)) return;
    if (!userId) return;
    try {
      await fetch(`${API_URL}/task-logs/${task.id}`, {
        method: 'DELETE',
        headers: { 'X-User-Id': userId }
      });
      onChanged();
    } catch (error) {
      onError('删除失败，请重试');
    }
  };

  const priorityStyle = PRIORITY_STYLES[task.priority || 'medium'] || PRIORITY_STYLES.medium;
  const statusStyle = STATUS_STYLES[task.status];

  return (
    <div className={`bg-white rounded-lg shadow p-4 border-l-4 transition ${
      task.status === 'in_progress' ? 'border-blue-500'
      : task.status === 'completed' ? 'border-green-500'
      : 'border-gray-200'
    }`}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className={`px-1.5 py-0.5 text-xs rounded ${statusStyle.cls}`}>{statusStyle.label}</span>
            {task.task_category && (
              <span className="px-1.5 py-0.5 text-xs bg-purple-100 text-purple-700 rounded">
                {CATEGORY_LABELS[task.task_category] || task.task_category}
              </span>
            )}
            <span className={`px-1.5 py-0.5 text-xs rounded ${priorityStyle.cls}`}>
              优先级 {priorityStyle.label}
            </span>
            {task.estimated_duration && (
              <span className="px-1.5 py-0.5 text-xs bg-cyan-100 text-cyan-700 rounded">
                预计 {task.estimated_duration}
              </span>
            )}
          </div>
          <h3 className={`text-sm font-semibold text-gray-800 mt-1.5 ${task.status === 'completed' ? 'line-through text-gray-400' : ''}`}>
            {task.task_title}
          </h3>
          {task.task_description && (
            <p className="text-xs text-gray-500 mt-0.5">{task.task_description}</p>
          )}
          <div className="text-xs text-gray-400 mt-1 flex items-center gap-2 flex-wrap">
            <span>创建于 {new Date(task.created_at).toLocaleString('zh-CN', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</span>
            {task.status === 'in_progress' && <span className="text-blue-500">{elapsedSince(task.start_time)}</span>}
            {task.status === 'completed' && task.time_spent_minutes != null && (
              <span>实际用时 {formatDuration(task.time_spent_minutes)}</span>
            )}
          </div>
        </div>
        <button onClick={del} className="text-xs text-gray-300 hover:text-red-500 shrink-0" title="删除任务">
          🗑
        </button>
      </div>

      {/* 操作区 */}
      <div className="mt-3 space-y-2">
        {task.status === 'pending' && (
          <button
            onClick={() => save({ status: 'in_progress' })}
            disabled={saving}
            className="w-full bg-blue-600 text-white py-1.5 text-sm rounded-lg hover:bg-blue-700 disabled:opacity-50 transition"
          >
            {saving ? '保存中...' : '▶ 开始任务'}
          </button>
        )}

        {task.status === 'in_progress' && (
          <div className="space-y-2">
            <textarea
              value={outcome}
              onChange={(e) => setOutcome(e.target.value)}
              className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded focus:ring-2 focus:ring-green-500 resize-none"
              rows={2}
              placeholder="实际完成了什么？"
            />
            <button
              onClick={() => save({ status: 'completed', outcome })}
              disabled={saving || !outcome.trim()}
              className="w-full bg-green-600 text-white py-1.5 text-sm rounded-lg hover:bg-green-700 disabled:opacity-50 transition"
            >
              {saving ? '保存中...' : '✓ 标记完成'}
            </button>
          </div>
        )}

        {task.status === 'completed' && (
          <div className="space-y-2">
            {task.outcome && (
              <div className="text-xs text-gray-600 bg-gray-50 rounded p-2">
                <span className="font-medium text-gray-500">完成内容：</span>
                {task.outcome}
              </div>
            )}
            <textarea
              value={reflection}
              onChange={(e) => setReflection(e.target.value)}
              className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded focus:ring-2 focus:ring-purple-500 resize-none"
              rows={2}
              placeholder="任务反思（可选）：好的/改进"
            />
            <button
              onClick={() => save({ reflection })}
              disabled={saving}
              className="w-full bg-purple-600 text-white py-1.5 text-sm rounded-lg hover:bg-purple-700 disabled:opacity-50 transition"
            >
              {saving ? '保存中...' : '💾 保存反思'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

export default function TaskTracker() {
  const userId = getUserId();
  const [tasks, setTasks] = useState<TaskLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<Filter>('all');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [createNotice, setCreateNotice] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // 创建表单
  const [taskTitle, setTaskTitle] = useState('');
  const [taskDescription, setTaskDescription] = useState('');
  const [taskCategory, setTaskCategory] = useState('');
  const [priority, setPriority] = useState('medium');
  const [estimatedDuration, setEstimatedDuration] = useState('');
  const [creating, setCreating] = useState(false);

  const showError = (message: string) => {
    setErrorMessage(message);
    setTimeout(() => setErrorMessage(null), 3000);
  };

  const loadTasks = async () => {
    if (!userId) return;
    try {
      const res = await fetch(`${API_URL}/task-logs`, {
        headers: { 'X-User-Id': userId }
      });
      const data = await res.json();
      if (data.data) {
        const order: Record<string, number> = { in_progress: 0, pending: 1, completed: 2 };
        setTasks([...data.data].sort((a, b) => {
          const diff = (order[a.status] ?? 9) - (order[b.status] ?? 9);
          if (diff !== 0) return diff;
          return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
        }));
      }
    } catch (error) {
      console.error('Failed to load tasks:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadTasks();
  }, []);

  // 存在进行中任务时每 30 秒强制重渲染，保证"已进行 X分钟"实时刷新
  const [, setTick] = useState(0);
  useEffect(() => {
    if (!tasks.some(t => t.status === 'in_progress')) return;
    const timer = setInterval(() => setTick(n => n + 1), 30_000);
    return () => clearInterval(timer);
  }, [tasks]);

  const handleCreateTask = async () => {
    if (!taskTitle.trim()) {
      showError('请填写任务标题');
      return;
    }
    if (!userId) {
      showError('会话已过期，请重新登录');
      return;
    }
    setCreating(true);
    try {
      const res = await fetch(`${API_URL}/task-logs`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-User-Id': userId },
        body: JSON.stringify({
          task_title: taskTitle.trim(),
          task_description: taskDescription || undefined,
          task_category: taskCategory || undefined,
          priority,
          estimated_duration: estimatedDuration || undefined,
          status: 'pending'
        })
      });
      const data = await res.json();
      if (data.data) {
        setTaskTitle('');
        setTaskDescription('');
        setTaskCategory('');
        setEstimatedDuration('');
        setCreateNotice({ type: 'success', message: '任务已创建' });
        setTimeout(() => setCreateNotice(null), 2500);
        loadTasks();
      } else {
        setCreateNotice({ type: 'error', message: data.error || '创建失败' });
      }
    } catch (error: any) {
      setCreateNotice({ type: 'error', message: '创建失败：' + error.message });
    } finally {
      setCreating(false);
    }
  };

  const counts = {
    all: tasks.length,
    in_progress: tasks.filter(t => t.status === 'in_progress').length,
    pending: tasks.filter(t => t.status === 'pending').length,
    completed: tasks.filter(t => t.status === 'completed').length
  };

  const filteredTasks = filter === 'all' ? tasks : tasks.filter(t => t.status === filter);

  const filterTabs: Array<{ key: Filter; label: string }> = [
    { key: 'all', label: `全部 ${counts.all}` },
    { key: 'in_progress', label: `⏳ 进行中 ${counts.in_progress}` },
    { key: 'pending', label: `📋 待办 ${counts.pending}` },
    { key: 'completed', label: `✅ 已完成 ${counts.completed}` }
  ];

  return (
    <div className="space-y-4">
      {/* 错误提示 */}
      {errorMessage && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-3 flex items-center gap-2">
          <span className="text-xl">⚠️</span>
          <span className="text-sm text-red-700">{errorMessage}</span>
        </div>
      )}

      {/* 创建任务 */}
      <div className="bg-white rounded-lg shadow p-4">
        <h2 className="text-sm font-semibold text-gray-800 mb-3">📝 创建任务（可同时管理多个）</h2>
        <div className="space-y-3">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">任务标题 *</label>
              <input
                type="text"
                value={taskTitle}
                onChange={(e) => setTaskTitle(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') handleCreateTask(); }}
                className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded focus:ring-2 focus:ring-blue-500"
                placeholder="例如：完成登录页面"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">任务描述</label>
              <input
                type="text"
                value={taskDescription}
                onChange={(e) => setTaskDescription(e.target.value)}
                className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded focus:ring-2 focus:ring-blue-500"
                placeholder="可选：详细描述..."
              />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-2">
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">类别</label>
              <select
                value={taskCategory}
                onChange={(e) => setTaskCategory(e.target.value)}
                className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 bg-white"
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
              <label className="block text-xs font-medium text-gray-700 mb-1">优先级</label>
              <select
                value={priority}
                onChange={(e) => setPriority(e.target.value)}
                className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 bg-white"
              >
                <option value="high">高</option>
                <option value="medium">中</option>
                <option value="low">低</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">预计周期</label>
              <select
                value={estimatedDuration}
                onChange={(e) => setEstimatedDuration(e.target.value)}
                className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 bg-white"
              >
                <option value="">不设置</option>
                <option value="<1小时">&lt;1小时</option>
                <option value="半天">半天</option>
                <option value="1天">1天</option>
                <option value="2-3天">2-3天</option>
                <option value="1周">1周</option>
                <option value=">1周">&gt;1周</option>
              </select>
            </div>
          </div>

          <button
            onClick={handleCreateTask}
            disabled={creating || !taskTitle.trim()}
            className="w-full md:w-auto bg-blue-600 text-white py-2 px-6 text-sm rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition"
          >
            {creating ? '创建中...' : '➕ 添加任务'}
          </button>
          {createNotice && (
            <span className={`ml-3 text-sm ${createNotice.type === 'success' ? 'text-green-600' : 'text-red-600'}`}>
              {createNotice.type === 'success' ? '✅' : '⚠️'} {createNotice.message}
            </span>
          )}
        </div>
      </div>

      {/* 筛选 */}
      <div className="flex gap-2 flex-wrap">
        {filterTabs.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setFilter(tab.key)}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition ${
              filter === tab.key ? 'bg-blue-100 text-blue-700' : 'bg-white text-gray-600 hover:bg-gray-100 shadow-sm'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* 任务列表 */}
      {loading ? (
        <div className="text-center text-gray-500 py-8 text-sm">加载任务中...</div>
      ) : filteredTasks.length === 0 ? (
        <div className="text-center text-gray-400 py-8 text-sm">
          {tasks.length === 0 ? '还没有任务，先在上方创建一个吧' : '该分类下暂无任务'}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {filteredTasks.map((task) => (
            <TaskCard key={task.id} task={task} onChanged={loadTasks} onError={showError} />
          ))}
        </div>
      )}
    </div>
  );
}
