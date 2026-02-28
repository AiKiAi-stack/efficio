import { useState, useEffect } from 'react';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001/api';

export default function DailyTracker() {
  const token = localStorage.getItem('sessionToken');

  const [goals, setGoals] = useState('');
  const [accomplishments, setAccomplishments] = useState('');
  const [reflection, setReflection] = useState('');
  const [moodScore, setMoodScore] = useState(3);
  const [energyLevel, setEnergyLevel] = useState('medium');

  const [startTime, setStartTime] = useState<Date | null>(null);
  const [isStarted, setIsStarted] = useState(false);
  const [isCompleted, setIsCompleted] = useState(false);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // 加载当日日志
  useEffect(() => {
    loadTodayLog();
  }, []);

  const loadTodayLog = async () => {
    if (!token) return;

    try {
      const res = await fetch(`${API_URL}/daily-logs/today`, {
        headers: { 'X-User-Id': token }
      });
      const data = await res.json();

      if (data.data) {
        const log = data.data;
        setGoals(log.goals || '');
        setAccomplishments(log.accomplishments || '');
        setReflection(log.reflection || '');
        setMoodScore(log.mood_score || 3);
        setEnergyLevel(log.energy_level || 'medium');

        if (log.start_time) {
          setStartTime(new Date(log.start_time));
          setIsStarted(true);
        }
        if (log.end_time) {
          setIsCompleted(true);
        }
      }
    } catch (error) {
      console.error('Failed to load today log:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleStart = async () => {
    if (!goals.trim()) {
      alert('请先填写今日目标！');
      return;
    }

    setSaving(true);
    const now = new Date().toISOString();

    try {
      const res = await fetch(`${API_URL}/daily-logs`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-User-Id': token!
        },
        body: JSON.stringify({
          goals,
          start_time: now,
          mood_score: moodScore,
          energy_level: energyLevel
        })
      });

      const data = await res.json();
      if (data.data) {
        setStartTime(new Date(now));
        setIsStarted(true);
      }
    } catch (error) {
      console.error('Failed to start:', error);
    } finally {
      setSaving(false);
    }
  };

  const handleComplete = async () => {
    if (!accomplishments.trim()) {
      alert('请先填写完成内容！');
      return;
    }

    setSaving(true);
    const now = new Date().toISOString();

    try {
      const res = await fetch(`${API_URL}/daily-logs`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-User-Id': token!
        },
        body: JSON.stringify({
          goals,
          accomplishments,
          start_time: startTime?.toISOString(),
          end_time: now,
          mood_score: moodScore,
          energy_level: energyLevel
        })
      });

      const data = await res.json();
      if (data.data) {
        setIsCompleted(true);
      }
    } catch (error) {
      console.error('Failed to complete:', error);
    } finally {
      setSaving(false);
    }
  };

  const handleSaveReflection = async () => {
    setSaving(true);

    try {
      const res = await fetch(`${API_URL}/daily-logs`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-User-Id': token!
        },
        body: JSON.stringify({
          goals,
          accomplishments,
          reflection,
          start_time: startTime?.toISOString(),
          end_time: isCompleted ? new Date().toISOString() : null,
          mood_score: moodScore,
          energy_level: energyLevel
        })
      });

      const data = await res.json();
      if (data.success) {
        alert('✅ 已保存');
      }
    } catch (error) {
      console.error('Failed to save:', error);
      alert('保存失败');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <div className="text-center py-8 text-gray-500">加载中...</div>;
  }

  return (
    <div className="space-y-6">
      {/* 阶段 1: 目标设定 (Plan) */}
      <div className={`bg-white rounded-lg shadow p-6 border-l-4 ${
        isStarted ? 'border-green-500' : 'border-blue-500'
      }`}>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-gray-800">
            📍 阶段 1: 目标设定 (Plan)
          </h2>
          {isStarted && (
            <span className="text-sm text-green-600 bg-green-100 px-2 py-1 rounded">
              已开始
            </span>
          )}
        </div>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              今日目标
              <span className="text-xs text-gray-500 ml-2">
                （建议：1-3 个具体可衡量的目标）
              </span>
            </label>
            <textarea
              value={goals}
              onChange={(e) => setGoals(e.target.value)}
              disabled={isStarted}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none disabled:bg-gray-100"
              rows={3}
              placeholder="例如：&#10;1. 完成用户登录功能开发&#10;2. 复习第 5 章内容&#10;3. 运动 30 分钟"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                心情分数
              </label>
              <select
                value={moodScore}
                onChange={(e) => setMoodScore(Number(e.target.value))}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              >
                <option value={1}>😞 1 - 很糟糕</option>
                <option value={2}>😕 2 - 不太好</option>
                <option value={3}>😐 3 - 一般</option>
                <option value={4}>🙂 4 - 还不错</option>
                <option value={5}>😄 5 - 很棒</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                能量水平
              </label>
              <select
                value={energyLevel}
                onChange={(e) => setEnergyLevel(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              >
                <option value="low">😴 低</option>
                <option value="medium">😐 中</option>
                <option value="high">⚡ 高</option>
              </select>
            </div>
          </div>

          {!isStarted && (
            <button
              onClick={handleStart}
              disabled={saving || !goals.trim()}
              className="w-full bg-blue-600 text-white py-2 rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition"
            >
              {saving ? '保存中...' : '🚀 开始今天'}
            </button>
          )}
        </div>
      </div>

      {/* 阶段 2: 执行追踪 (Do) */}
      <div className={`bg-white rounded-lg shadow p-6 border-l-4 ${
        isCompleted ? 'border-green-500' : isStarted ? 'border-yellow-500' : 'border-gray-300'
      } ${!isStarted && 'opacity-50 pointer-events-none'}`}>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-gray-800">
            ✅ 阶段 2: 执行追踪 (Do)
          </h2>
          {startTime && (
            <span className="text-sm text-gray-600">
              开始于：{new Date(startTime).toLocaleTimeString('zh-CN')}
            </span>
          )}
          {isCompleted && (
            <span className="text-sm text-green-600 bg-green-100 px-2 py-1 rounded">
              已完成
            </span>
          )}
        </div>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              具体完成了什么
              <span className="text-xs text-gray-500 ml-2">
                （对照目标，记录实际成果）
              </span>
            </label>
            <textarea
              value={accomplishments}
              onChange={(e) => setAccomplishments(e.target.value)}
              disabled={isCompleted}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent resize-none disabled:bg-gray-100"
              rows={4}
              placeholder="例如：&#10;✓ 完成了用户登录页面，包含邮箱验证&#10;✓ 复习了第 5 章，做了笔记&#10;✗ 运动没完成，因为加班"
            />
          </div>

          {!isCompleted && (
            <button
              onClick={handleComplete}
              disabled={saving || !accomplishments.trim() || !isStarted}
              className="w-full bg-green-600 text-white py-2 rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition"
            >
              {saving ? '保存中...' : '✓ 标记完成'}
            </button>
          )}
        </div>
      </div>

      {/* 阶段 3: 反思 (Check/Act) */}
      <div className={`bg-white rounded-lg shadow p-6 border-l-4 ${
        isCompleted ? 'border-purple-500' : 'border-gray-300'
      } ${!isCompleted && 'opacity-50 pointer-events-none'}`}>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-gray-800">
            🤔 阶段 3: 反思 (Check/Act)
          </h2>
        </div>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              今日反思
              <span className="text-xs text-gray-500 ml-2">
                （什么做得好？什么可以改进？）
              </span>
            </label>
            <textarea
              value={reflection}
              onChange={(e) => setReflection(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent resize-none"
              rows={4}
              placeholder="例如：&#10;好的：上午效率高，完成了最重要的任务&#10;改进：下午容易被消息打断，明天试试关闭通知"
            />
          </div>

          <button
            onClick={handleSaveReflection}
            disabled={saving}
            className="w-full bg-purple-600 text-white py-2 rounded-lg hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed transition"
          >
            {saving ? '保存中...' : '💾 保存反思'}
          </button>
        </div>
      </div>

      {/* 科学提示 */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <h3 className="text-sm font-medium text-blue-800 mb-2">💡 为什么要这样设计？</h3>
        <ul className="text-xs text-blue-700 space-y-1">
          <li>• <strong>目标设定</strong>：研究表明书面目标达成率提高 42%</li>
          <li>• <strong>执行追踪</strong>：自我监控是最有效的学习策略之一</li>
          <li>• <strong>反思</strong>：每日复盘使效率提升 23% (哈佛商学院研究)</li>
        </ul>
      </div>
    </div>
  );
}
