-- 效率追踪器数据库架构
-- 创建于 2026-02-27

-- Users 表 - 存储用户信息
CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email TEXT UNIQUE NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Work Records 表 - 存储工作记录
CREATE TABLE IF NOT EXISTS work_records (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    original_text TEXT NOT NULL,
    optimized_text TEXT,
    structured_data JSONB,  -- 结构化分析数据
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 索引 - 加速查询
CREATE INDEX IF NOT EXISTS idx_work_records_user_id ON work_records(user_id);
CREATE INDEX IF NOT EXISTS idx_work_records_created_at ON work_records(created_at DESC);

-- Weekly Summaries 表 - 存储周总结报告
CREATE TABLE IF NOT EXISTS weekly_summaries (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    week_start DATE NOT NULL,  -- 周一日期
    week_end DATE NOT NULL,    -- 周日日期
    summary_data JSONB NOT NULL,  -- 结构化总结数据
    markdown_content TEXT NOT NULL,  -- Markdown 格式报告
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id, week_start)  -- 每周一条记录
);

-- Monthly Trends 表 - 存储月趋势分析
CREATE TABLE IF NOT EXISTS monthly_trends (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    year INTEGER NOT NULL,
    month INTEGER NOT NULL,  -- 1-12
    trend_data JSONB NOT NULL,
    insights TEXT,  -- 文字洞察
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id, year, month)
);

-- Optimization Suggestions 表 - 存储优化建议
CREATE TABLE IF NOT EXISTS optimization_suggestions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    suggestion_type TEXT NOT NULL,  -- 'weekly' | 'monthly' | 'pattern'
    suggestion_data JSONB NOT NULL,
    is_actioned BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 索引
CREATE INDEX IF NOT EXISTS idx_weekly_summaries_user_id ON weekly_summaries(user_id);
CREATE INDEX IF NOT EXISTS idx_weekly_summaries_week_start ON weekly_summaries(week_start DESC);
CREATE INDEX IF NOT EXISTS idx_monthly_trends_user_id ON monthly_trends(user_id);
CREATE INDEX IF NOT EXISTS idx_monthly_trends_year_month ON monthly_trends(year, month DESC);
CREATE INDEX IF NOT EXISTS idx_optimization_suggestions_user_id ON optimization_suggestions(user_id);

-- RLS (Row Level Security) 策略
-- 注意：这里使用服务密钥 bypass RLS，应用层控制访问
-- 如果需要更严格的安全策略，可以启用 RLS
