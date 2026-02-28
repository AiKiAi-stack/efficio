#!/bin/bash
# 清理端口占用脚本
# 用于关闭占用 5173, 5174, 3001 端口的进程

echo "🔍 检查并清理端口..."

# 清理端口 5173
echo "清理端口 5173..."
PID_5173=$(netstat -tlnp 2>/dev/null | grep ":5173" | awk '{print $7}' | cut -d'/' -f1)
if [ -n "$PID_5173" ]; then
  kill -9 $PID_5173 2>/dev/null && echo "✅ 已关闭端口 5173 的进程 ($PID_5173)" || echo "⚠️ 无法关闭端口 5173"
else
  echo "ℹ️  端口 5173 未被占用"
fi

# 清理端口 5174
echo "清理端口 5174..."
PID_5174=$(netstat -tlnp 2>/dev/null | grep ":5174" | awk '{print $7}' | cut -d'/' -f1)
if [ -n "$PID_5174" ]; then
  kill -9 $PID_5174 2>/dev/null && echo "✅ 已关闭端口 5174 的进程 ($PID_5174)" || echo "⚠️ 无法关闭端口 5174"
else
  echo "ℹ️  端口 5174 未被占用"
fi

# 清理端口 3001 (后端服务)
echo "清理端口 3001..."
PID_3001=$(netstat -tlnp 2>/dev/null | grep ":3001" | awk '{print $7}' | cut -d'/' -f1)
if [ -n "$PID_3001" ]; then
  kill -9 $PID_3001 2>/dev/null && echo "✅ 已关闭端口 3001 的进程 ($PID_3001)" || echo "⚠️ 无法关闭端口 3001"
else
  echo "ℹ️  端口 3001 未被占用"
fi

# 清理 tsx 和 node 进程
echo "清理 tsx/node 进程..."
pkill -f "tsx" 2>/dev/null && echo "✅ 已关闭 tsx 进程" || echo "ℹ️  无 tsx 进程"
pkill -f "node.*index" 2>/dev/null && echo "✅ 已关闭 node 进程" || echo "ℹ️  无 node 进程"

echo ""
echo "🎉 清理完成！"
sleep 1
