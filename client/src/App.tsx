import { useState, useEffect } from 'react';
import { login } from './api';
import Dashboard from './pages/Dashboard';
import TaskTracker from './pages/TaskTracker';
import RecordsHistory from './pages/RecordsHistory';

const enum Tab {
  DAILY = 'daily',
  RECORDS = 'records',
  DASHBOARD = 'dashboard'
}

function App() {
  const [user, setUser] = useState<{ id: string; email: string } | null>(null);
  const [email, setEmail] = useState('');
  const [activeTab, setActiveTab] = useState<Tab>(Tab.DAILY);

  // 天气状态
  const [weather, setWeather] = useState<{
    location: string;
    temperature: number;
    humidity: number;
    condition: string;
    icon: string;
  } | null>(null);

  // 检查本地存储的 session
  useEffect(() => {
    const savedUser = localStorage.getItem('user');
    const savedToken = localStorage.getItem('sessionToken');
    if (savedUser && savedToken) {
      setUser(JSON.parse(savedUser));
      fetchWeather();
    }
  }, []);

  // 获取天气
  const fetchWeather = async () => {
    try {
      // 使用浏览器 geolocation API 获取位置
      if ('geolocation' in navigator) {
        navigator.geolocation.getCurrentPosition(async (position) => {
          const { latitude, longitude } = position.coords;

          // 使用 Open-Meteo API 获取天气（无需 API key）
          const weatherRes = await fetch(
            `https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&current_weather=true&relativehumidity_2m=true`
          );
          const weatherData = await weatherRes.json();

          if (weatherData.current_weather) {
            // 获取天气图标
            const icon = getWeatherIcon(weatherData.current_weather.weathercode);

            setWeather({
              location: '当前位置',
              temperature: Math.round(weatherData.current_weather.temperature),
              humidity: weatherData.relativehumidity_2m?.value || 50,
              condition: getWeatherCondition(weatherData.current_weather.weathercode),
              icon
            });
          }
        });
      }
    } catch (error) {
      console.error('Failed to fetch weather:', error);
    }
  };

  const getWeatherIcon = (code: number): string => {
    if (code === 0) return '☀️';
    if (code <= 3) return '⛅';
    if (code <= 48) return '🌫️';
    if (code <= 67) return '🌧️';
    if (code <= 77) return '🌨️';
    if (code <= 82) return '🌦️';
    if (code <= 86) return '⛅';
    if (code <= 99) return '⛈️';
    return '🌡️';
  };

  const getWeatherCondition = (code: number): string => {
    if (code === 0) return '晴';
    if (code <= 3) return '多云';
    if (code <= 48) return '雾';
    if (code <= 67) return '雨';
    if (code <= 77) return '雪';
    if (code <= 82) return '阵雨';
    if (code <= 86) return '多云';
    if (code <= 99) return '雷暴';
    return '未知';
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();

    const result = await login(email);
    if (result.success && result.data) {
      const { user, session_token } = result.data;
      setUser(user);
      localStorage.setItem('user', JSON.stringify(user));
      localStorage.setItem('sessionToken', session_token);
    } else {
      alert(result.error || '登录失败');
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('user');
    localStorage.removeItem('sessionToken');
    setUser(null);
  };

  if (!user) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-white rounded-lg shadow-lg p-8">
          <h1 className="text-2xl font-bold text-center text-gray-800 mb-2">
            效率追踪器
          </h1>
          <p className="text-center text-gray-500 mb-8">
            目标追踪 · 工作记录 · 每日反思
          </p>

          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                邮箱
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="your@email.com"
                required
              />
            </div>

            <button
              type="submit"
              className="w-full bg-blue-600 text-white py-2 rounded-lg hover:bg-blue-700 transition"
            >
              登录
            </button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow">
        <div className="max-w-5xl mx-auto px-4 py-3">
          <div className="flex justify-between items-center">
            <div>
              <h1 className="text-xl font-bold text-gray-800">效率追踪器</h1>
              <p className="text-xs text-gray-500">基于 PDCA 循环的效率工具</p>
            </div>
            <div className="flex items-center gap-4">
              <nav className="flex gap-2">
                <button
                  onClick={() => setActiveTab(Tab.DAILY)}
                  className={`px-3 py-1.5 rounded-lg text-sm font-medium transition ${
                    activeTab === Tab.DAILY
                      ? 'bg-blue-100 text-blue-700'
                      : 'text-gray-600 hover:bg-gray-100'
                  }`}
                >
                  🎯 任务追踪
                </button>
                <button
                  onClick={() => setActiveTab(Tab.RECORDS)}
                  className={`px-3 py-1.5 rounded-lg text-sm font-medium transition ${
                    activeTab === Tab.RECORDS
                      ? 'bg-blue-100 text-blue-700'
                      : 'text-gray-600 hover:bg-gray-100'
                  }`}
                >
                  📝 历史记录
                </button>
                <button
                  onClick={() => setActiveTab(Tab.DASHBOARD)}
                  className={`px-3 py-1.5 rounded-lg text-sm font-medium transition ${
                    activeTab === Tab.DASHBOARD
                      ? 'bg-blue-100 text-blue-700'
                      : 'text-gray-600 hover:bg-gray-100'
                  }`}
                >
                  📊 仪表板
                </button>
              </nav>

              {/* 天气组件 */}
              {weather && (
                <div className="flex items-center gap-2 px-3 py-1.5 bg-gradient-to-r from-blue-50 to-blue-100 rounded-lg border border-blue-200">
                  <span className="text-lg">{weather.icon}</span>
                  <div className="text-xs">
                    <div className="font-medium text-gray-700">
                      {weather.temperature}°C {weather.condition}
                    </div>
                    <div className="text-gray-500">
                      湿度 {weather.humidity}%
                    </div>
                  </div>
                </div>
              )}

              <span className="text-sm text-gray-600">{user.email}</span>
              <button
                onClick={handleLogout}
                className="text-sm text-red-600 hover:text-red-700"
              >
                退出
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-5xl mx-auto px-4 py-6">
        {activeTab === Tab.DAILY && <TaskTracker />}

        {activeTab === Tab.RECORDS && <RecordsHistory />}

        {activeTab === Tab.DASHBOARD && <Dashboard />}
      </main>
    </div>
  );
}

export default App;
