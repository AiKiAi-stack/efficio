import { useState, useEffect } from 'react';
import { login } from './api';
import Dashboard from './pages/Dashboard';
import TaskTracker from './pages/TaskTracker';
import RecordsHistory from './pages/RecordsHistory';
import Settings from './pages/Settings';

const enum Tab {
  DAILY = 'daily',
  RECORDS = 'records',
  DASHBOARD = 'dashboard',
  SETTINGS = 'settings'
}

function App() {
  const [user, setUser] = useState<{ id: string; email: string } | null>(null);
  const [email, setEmail] = useState('');
  const [activeTab, setActiveTab] = useState<Tab>(Tab.DAILY);

  // 错误提示状态
  const [loginError, setLoginError] = useState<string | null>(null);

  // 天气状态
  const [weather, setWeather] = useState<{
    location: string;
    temperature: number;
    humidity: number;
    condition: string;
    icon: string;
  } | null>(null);

  // 城市选择状态
  const [showCitySelector, setShowCitySelector] = useState(false);
  const [citySearch, setCitySearch] = useState('');
  const [cityResults, setCityResults] = useState<Array<{name: string; lat: number; lon: number}>>([]);
  const [searchingCities, setSearchingCities] = useState(false);

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
  const fetchWeather = async (latitude?: number, longitude?: number, locationName?: string) => {
    try {
      let lat = latitude;
      let lon = longitude;

      // 如果未提供坐标，使用浏览器 geolocation API
      if (lat === undefined || lon === undefined) {
        if ('geolocation' in navigator) {
          navigator.geolocation.getCurrentPosition(async (position) => {
            lat = position.coords.latitude;
            lon = position.coords.longitude;
            // 保存位置到 localStorage
            localStorage.setItem('userLocation', JSON.stringify({ lat, lon }));
            // 递归调用获取天气
            fetchWeather(lat, lon);
          }, (error) => {
            console.error('Geolocation error:', error);
            // 使用默认位置（北京）
            fetchWeather(39.9042, 116.4074);
          });
          return; // 等待 geolocation 回调
        } else {
          // 浏览器不支持 geolocation，使用默认位置
          lat = 39.9042;
          lon = 116.4074;
        }
      }

      // 使用 Open-Meteo API 获取天气（无需 API key）
      const weatherRes = await fetch(
        `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current_weather=true&relativehumidity_2m=true`
      );
      const weatherData = await weatherRes.json();

      if (weatherData.current_weather) {
        // 如果未提供位置名称，使用反向地理编码获取地名
        let displayName = locationName;
        if (!displayName) {
          try {
            // 使用 Nominatim 反向地理编码获取城市名称
            const geoRes = await fetch(
              `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lon}&accept-language=zh-CN,en`
            );
            const geoData = await geoRes.json();

            if (geoData?.address) {
              const addr = geoData.address;
              displayName = addr.city ||
                            addr.town ||
                            addr.village ||
                            addr.county ||
                            addr.state ||
                            addr.region ||
                            `${lat.toFixed(1)}°N, ${lon.toFixed(1)}°E`;
            }
          } catch (geoError) {
            console.error('Geocoding error:', geoError);
            displayName = `${lat.toFixed(1)}°N, ${lon.toFixed(1)}°E`;
          }
        }

        // 获取天气图标
        const icon = getWeatherIcon(weatherData.current_weather.weathercode);

        // 修复湿度显示 - 确保正确获取湿度数据
        const humidity = weatherData.relativehumidity_2m?.value;
        const currentWeatherHumidity = weatherData.current_weather?.humidity;

        setWeather({
          location: displayName || '当前位置',
          temperature: Math.round(weatherData.current_weather.temperature),
          humidity: humidity !== undefined ? Math.round(humidity) :
                    currentWeatherHumidity !== undefined ? Math.round(currentWeatherHumidity) : 50,
          condition: getWeatherCondition(weatherData.current_weather.weathercode),
          icon
        });
      }
    } catch (error) {
      console.error('Failed to fetch weather:', error);
    }
  };

  // 搜索城市
  const searchCities = async (query: string) => {
    if (!query.trim()) {
      setCityResults([]);
      return;
    }

    setSearchingCities(true);
    try {
      const res = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&accept-language=zh-CN,en&limit=5`
      );
      const data = await res.json();
      setCityResults(data.map((item: any) => ({
        name: item.display_name.split(',')[0],
        lat: parseFloat(item.lat),
        lon: parseFloat(item.lon)
      })));
    } catch (error) {
      console.error('Failed to search cities:', error);
      setCityResults([]);
    } finally {
      setSearchingCities(false);
    }
  };

  // 选择城市
  const handleSelectCity = (city: {name: string; lat: number; lon: number}) => {
    setCitySearch('');
    setCityResults([]);
    setShowCitySelector(false);
    fetchWeather(city.lat, city.lon, city.name);
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
    setLoginError(null);

    if (!email.trim()) {
      setLoginError('请输入邮箱地址');
      return;
    }

    try {
      const result = await login(email);
      if (result.success && result.data) {
        const { user, session_token } = result.data;
        setUser(user);
        localStorage.setItem('user', JSON.stringify(user));
        localStorage.setItem('sessionToken', session_token);
        fetchWeather();
      } else {
        setLoginError(result.error || '登录失败，请稍后重试');
      }
    } catch (error) {
      console.error('Login error:', error);
      setLoginError('网络错误，请检查服务器连接');
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
            {/* 错误提示 */}
            {loginError && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-700">
                ⚠️ {loginError}
              </div>
            )}

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
                <button
                  onClick={() => setActiveTab(Tab.SETTINGS)}
                  className={`px-3 py-1.5 rounded-lg text-sm font-medium transition ${
                    activeTab === Tab.SETTINGS
                      ? 'bg-blue-100 text-blue-700'
                      : 'text-gray-600 hover:bg-gray-100'
                  }`}
                >
                  ⚙️ 设置
                </button>
              </nav>

              {/* 天气组件 */}
              {weather && (
                <div className="relative">
                  <div className="flex items-center gap-2 px-3 py-1.5 bg-gradient-to-r from-blue-50 to-blue-100 rounded-lg border border-blue-200">
                    <span className="text-lg">{weather.icon}</span>
                    <div className="text-xs">
                      <div className="font-medium text-gray-700">
                        {weather.temperature}°C {weather.condition}
                      </div>
                      <div className="text-gray-500">
                        {weather.location} | 湿度 {weather.humidity}%
                      </div>
                    </div>
                    <button
                      onClick={() => setShowCitySelector(!showCitySelector)}
                      className="text-xs text-blue-600 hover:text-blue-800 ml-1"
                      title="选择城市"
                    >
                      🏙️
                    </button>
                  </div>

                  {/* 城市选择器 */}
                  {showCitySelector && (
                    <div className="absolute right-0 top-full mt-2 w-64 bg-white rounded-lg shadow-lg border border-gray-200 p-3 z-50">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-xs font-medium text-gray-700">选择城市</span>
                        <button
                          onClick={() => setShowCitySelector(false)}
                          className="text-xs text-gray-400 hover:text-gray-600"
                        >
                          ✕
                        </button>
                      </div>
                      <input
                        type="text"
                        value={citySearch}
                        onChange={(e) => {
                          setCitySearch(e.target.value);
                          searchCities(e.target.value);
                        }}
                        placeholder="搜索城市..."
                        className="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:ring-2 focus:ring-blue-500"
                        autoFocus
                      />
                      {searchingCities && (
                        <div className="text-xs text-gray-500 py-2">搜索中...</div>
                      )}
                      {cityResults.length > 0 && (
                        <div className="mt-2 space-y-1">
                          {cityResults.map((city, index) => (
                            <button
                              key={index}
                              onClick={() => handleSelectCity(city)}
                              className="w-full text-left text-sm px-2 py-1 hover:bg-blue-50 rounded"
                            >
                              {city.name}
                            </button>
                          ))}
                        </div>
                      )}
                      {citySearch && cityResults.length === 0 && !searchingCities && (
                        <div className="text-xs text-gray-500 py-2">未找到城市</div>
                      )}
                    </div>
                  )}
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

        {activeTab === Tab.SETTINGS && <Settings />}
      </main>
    </div>
  );
}

export default App;
