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
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 索引 - 加速查询
CREATE INDEX IF NOT EXISTS idx_work_records_user_id ON work_records(user_id);
CREATE INDEX IF NOT EXISTS idx_work_records_created_at ON work_records(created_at DESC);

-- RLS (Row Level Security) 策略
-- 注意：这里使用服务密钥 bypass RLS，应用层控制访问
-- 如果需要更严格的安全策略，可以启用 RLS
