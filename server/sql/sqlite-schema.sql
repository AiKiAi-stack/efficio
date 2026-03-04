-- 效率追踪器数据库架构 - SQLite 版本
-- 适配 SQLite 类型系统
-- 创建于 2026-03-03

-- Users 表 - 存储用户信息
CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    email TEXT UNIQUE NOT NULL,
    created_at TEXT DEFAULT (datetime('now'))
);

-- Work Records 表 - 存储工作记录
CREATE TABLE IF NOT EXISTS work_records (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    original_text TEXT NOT NULL,
    optimized_text TEXT,
    structured_data TEXT,  -- JSON 字符串
    created_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Daily Logs 表 - 存储每日 PDCA 三段式记录
CREATE TABLE IF NOT EXISTS daily_logs (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    log_date TEXT NOT NULL,

    -- Plan - 目标设定
    goals TEXT,
    goal_priority TEXT,

    -- Do - 执行追踪
    start_time TEXT,
    end_time TEXT,
    accomplishments TEXT,

    -- Check/Act - 反思
    reflection TEXT,
    lessons_learned TEXT,  -- JSON 字符串
    improvement_plan TEXT,

    -- 元数据
    mood_score INTEGER CHECK (mood_score >= 1 AND mood_score <= 5),
    energy_level TEXT,

    structured_data TEXT,  -- JSON 字符串
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now')),

    UNIQUE(user_id, log_date)
);

-- Task Logs 表 - 存储单项任务追踪
CREATE TABLE IF NOT EXISTS task_logs (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,

    -- Plan - 任务设定
    task_title TEXT NOT NULL,
    task_description TEXT,
    task_category TEXT,

    -- Do - 执行追踪
    start_time TEXT,
    end_time TEXT,
    status TEXT DEFAULT 'pending',

    -- Check/Act - 反思
    outcome TEXT,
    reflection TEXT,
    time_spent_minutes INTEGER,

    -- 元数据
    priority TEXT,
    tags TEXT,  -- JSON 数组字符串

    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now')),

    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Weekly Summaries 表 - 存储周总结报告
CREATE TABLE IF NOT EXISTS weekly_summaries (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    week_start TEXT NOT NULL,
    week_end TEXT NOT NULL,
    summary_data TEXT NOT NULL,  -- JSON 字符串
    markdown_content TEXT NOT NULL,
    created_at TEXT DEFAULT (datetime('now')),
    UNIQUE(user_id, week_start),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Monthly Trends 表 - 存储月趋势分析
CREATE TABLE IF NOT EXISTS monthly_trends (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    year INTEGER NOT NULL,
    month INTEGER NOT NULL,
    trend_data TEXT NOT NULL,  -- JSON 字符串
    insights TEXT,
    created_at TEXT DEFAULT (datetime('now')),
    UNIQUE(user_id, year, month),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Optimization Suggestions 表 - 存储优化建议
CREATE TABLE IF NOT EXISTS optimization_suggestions (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    suggestion_type TEXT NOT NULL,
    suggestion_data TEXT NOT NULL,  -- JSON 字符串
    is_actioned INTEGER DEFAULT 0,  -- SQLite 使用 INTEGER 代替 BOOLEAN
    created_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- 索引 - 加速查询
CREATE INDEX IF NOT EXISTS idx_work_records_user_id ON work_records(user_id);
CREATE INDEX IF NOT EXISTS idx_work_records_created_at ON work_records(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_daily_logs_user_id ON daily_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_daily_logs_date ON daily_logs(log_date DESC);
CREATE INDEX IF NOT EXISTS idx_task_logs_user_id ON task_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_task_logs_created_at ON task_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_task_logs_status ON task_logs(status);
CREATE INDEX IF NOT EXISTS idx_weekly_summaries_user_id ON weekly_summaries(user_id);
CREATE INDEX IF NOT EXISTS idx_weekly_summaries_week_start ON weekly_summaries(week_start DESC);
CREATE INDEX IF NOT EXISTS idx_monthly_trends_user_id ON monthly_trends(user_id);
CREATE INDEX IF NOT EXISTS idx_monthly_trends_year_month ON monthly_trends(year, month DESC);
CREATE INDEX IF NOT EXISTS idx_optimization_suggestions_user_id ON optimization_suggestions(user_id);
