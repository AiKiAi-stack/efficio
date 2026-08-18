# RIL — Repository Intelligence Layer

Efficio 仓库的长期工程记忆。每轮自主迭代的重要发现、根因、决策、验证结果、
已知风险和后续方向记录于此，按时间倒序追加。

---

## 2026-08-19 · ci: 测试门禁 + lint 修复（commit 8602b3e）

### 发现
- CI 只有 main 的二进制打包工作流，**无任何测试门禁**。
- 根/server/client 三处 `lint` 脚本全部损坏：client 有 eslint 依赖但无配置；
  server 与根连 eslint 依赖都没有，运行必然失败。

### 决策
- 新增 ci.yml：所有分支 push/PR 跑 server jest+tsc、client vitest+eslint+build。
- client 补 .eslintrc.cjs（Vite 模板规则）；any/未用变量设 warn。
- 根 lint 委托 client；删除 server 必然失败的 lint 脚本。

### 验证
CI 各步骤本地全部跑通（148 server 测试、17 client 测试、eslint 0 errors、双构建）。

### 后续
- 首次真实 CI 运行关注 better-sqlite3 预编译二进制是否可用。
- **本地分支 feat/multi-task-tracker 领先远端 8 个提交未推送**（本机 GitHub
  网络受限；push/合并 main 需用户确认后在网络可用环境执行）。

---

## 2026-08-19 · fix: Jira 401 + 日志时间漂移（commit ef33722）

- JiraPage 的 /jira/tasks、/jira/sync 从未发送 X-User-Id → 同步功能完全不可用。
- DailyTracker 保存反思用 new Date() 覆盖 end_time → 完成时间漂移；
  server dailyLogs 同步补上"未回传字段继承"（同 task-logs 模式）。
- 测试：daily-logs.test.ts 5 例 + DailyTracker.test.tsx 2 例。

## 2026-08-19 · fix: CLI --init 覆盖配置 + 启动横幅崩溃（commit d749277）

- `config --init` 静默覆盖已有 efficio.json → 改为拒绝（exit 1）。
- printStartupInfo：turso/supabase URL 未配置显示 "undefined..."；
  Cron 行 weeklySummary 为 null 时 TypeError。

## 2026-08-19 · fix: UTC 日期误用致日历跳错月（commit 9b67584）

- RecordsHistory 日历 5 处 + Dashboard 今日总结用 toISOString().split('T')[0]
  取 UTC 日期：UTC+8 凌晨翻月跳错月、"今天"差一天。改为本地日期格式化。
- RecordsHistory.test.tsx 用 fake timers 固定本地 00:30 验证逐月翻页。
- **注意**：server 端 daily-logs 的 log_date 仍按 UTC（toISOString）划分，
  GET/POST 一致暂未改；如按本地日界需统一设计后处理。

---

## 会话总结（2026-08-19，9 轮修复 + 3 次 RIL 提交）

- 修复 12+ 个 bug：2 个安全（IDOR/无鉴权）、3 个数据丢失/漂移、
  3 个日期边界（12 月空区间、漏周日、UTC 误用）、适配器语义分叉、
  cron 存根、Jira 同步不可用、CLI 覆盖配置、计时不刷新等。
- 新增测试 53 个（server 114→153、client 12→21），建立 CI 测试门禁。
- 全库代码审计完成：路由、适配器、lib、CLI、全部 8 个前端页面。
- 遗留（低优先级/需人工）：分支未推送（网络）、settings 用户隔离（架构决策）、
  daily-logs 本地日界、20 个 eslint warning、uitemplate/selectModel.png。

---

## 2026-08-19 · feat: cron 报告生成落地 + 三个日期/查询 bug（commit 36fda05）

### 发现
1. cron 周/月任务是**存根**：只打日志"有待生成的周总结"，从不生成。
   README 宣称 Phase 3/4（周报/月报）已完成。
2. 月趋势 12 月 bug：`endDate = Math.min(month+1, 12)` → 12 月区间
   [12-01, 12-01) 恒空，12 月永远 404。
3. 周总结漏周日：`lt: week_end` 排除周日整天。
4. **InMemoryAdapter.matches() 多操作符 bug**：if 链命中第一个操作符即返回，
   `{ gte, lt }` 只应用 gte —— 内存模式（DATABASE_MODE=memory 与测试惰性 DB）
   所有范围查询上界失效；SQLite 适配器是 AND 语义，两适配器行为分叉。

### 决策
- 生成逻辑提取为 `lib/report-generator.ts`（路由与 cron 共用）；
  cron 用 `skipIfExists: true` 幂等，路由保持可重复生成（upsert）。
- 周范围改含首尾（lte weekEnd 23:59:59.999Z）；月边界正确处理跨年。
- matches() 改为全操作符 AND；月趋势补降级生成（原来 AI 缺失时存空）。
- 测试 mock `isAiAvailable` 为 false：开发机 shell 导出了 DEEPSEEK_API_KEY，
  不 mock 会走真实 AI 请求。

### 验证
report-generator.test.ts 15 例；server jest 148/148、client 17/17、tsc 通过。

### 后续
- `/summaries/weekly/generate`、`/trends/monthly*` 端点当前无前端消费
  （Dashboard 用 /summaries/range）；如未来 UI 接回，注意 week_end 为含当日。

---

## 2026-08-19 · chore: client api.ts 死代码清理（commit 5855497）

删除 11 个从未被调用的 API 函数（仅保留 getUserId/login）。这些死函数沿用
"token 直接作 X-User-Id"的已修复错误模式，存在被误用重新引入 bug 的风险。

---

## 2026-08-19 · fix: 全路由越权审计（commit fe1e333）

### 发现
- `records.ts` GET /:id、DELETE /:id **完全无鉴权**：匿名可读/删任意用户工作记录。
- `suggestions.ts` PATCH /:id/action 无鉴权，可篡改任意用户建议状态。
- 审计通过：dailyLogs / summaries / trends 的更新均先用
  `where: { user_id, ... }` 定位既有记录再按内部 id 更新，无 IDOR。
- settings 路由是服务器级配置（config-manager，非按用户的 DB 数据），
  属于部署管理面，未纳入用户隔离。

### 决策
- 单条接口统一模式：X-User-Id 缺失 → 401；按 (id, user_id) 查无 → 404。
- DELETE 不存在记录语义从 200/success 改为 404（grep 确认 Web/CLI 均无消费方）。

### 验证
server jest 133/133（新增 records 4 例 + suggestions.test.ts 4 例），tsc 通过。

### 后续
- records 删除、suggestions action 目前无任何客户端消费（死端点），
  后续如前端要接入需注意 401/404 处理。

---

## 2026-08-19 · fix: TaskTracker 计时不刷新（commit 6ace6ef）

### 发现
多任务重写宣称"进行中实时计时"，但 `elapsedSince` 只在渲染时计算，
无定时器 → 页面静止时计时永远停在初始值。

### 决策
存在进行中任务时每 30 秒强制重渲染（无进行中任务不启动定时器）。
显示粒度为分钟，30s 滞后可接受。

### 验证
新增 `client/src/__tests__/TaskTracker.test.tsx`（5 例，含 fake-timers
计时回归：5 分钟 → 推进 90s → 6 分钟）。client vitest 17/17、build 通过。

---

## 2026-08-19 · fix: task-logs 计时数据丢失 + IDOR（commit b000df3）

### 发现
1. **严重数据 bug**：多任务重写（82c3126）后，前端 `TaskCard.save()` 补丁更新
   不回传 `start_time/end_time/time_spent_minutes`，而 `taskLogs.ts` POST 更新
   用全量对象覆盖（适配器 update 会写入所有传入键，含 null），导致：
   - 完成任务时 `start_time` 被置 null；
   - `time_spent_minutes` 永远无法计算（完成卡片的"实际用时"始终为空）。
2. **安全（IDOR）**：POST 更新分支无所有权校验，任意用户可携带他人任务 id
   篡改任务（DELETE / GET /:id 已有校验，唯独 POST 缺失）。
3. 次要：完成任务后每次保存反思都会刷新 `end_time` 并重算用时（完成时间漂移）。

### 根因
- 路由把 POST 同时用作 create 与 update，但 update 路径没有
  "读取现有记录 → 合并" 的步骤，直接构造完整对象覆盖；
- 时间字段是服务端计算的派生数据，前端从不回传，覆盖即丢失。

### 决策
- update 分支先 `selectSingle({id, user_id})` 校验所有权，404 拒绝越权；
- 请求中 `undefined` 的字段（start_time/end_time/time_spent_minutes/tags）
  从现有记录继承；显式传值（含 null）仍尊重请求；
- 仅 pending/completed → in_progress 的转移重置 start_time 并清空完成态字段，
  已在进行中的保存保留原 start_time（计时不重置）；
- completed 保留已有 end_time，二次保存不漂移。

### 验证
- 新增 `server/src/__tests__/task-logs.test.ts`（9 用例）；
- server jest 125/125，client vitest 12/12，`tsc --noEmit` 通过。

### 已知风险 / 后续
- update 语义从"全量覆盖"变为"未提供字段继承"。当前客户端（Web、CLI）
  均不依赖显式置 null，安全；新增客户端时需注意。
- ~~待办：计时不刷新~~ → 已在 6ace6ef 修复。
- ~~待办：其他路由 IDOR 审计~~ → 已完成（fe1e333），records/suggestions 已修。
- 待办：根 `package.json` 有 `lint` 脚本但仓库无 eslint 配置，属技术债。
- 待办：`client/src/api.ts` 除 login/getUserId 外 11 个函数为死代码，
  且沿用已被修复的 sessionToken 传参模式，存在被误用重新引入 bug 的风险。

### 环境事实
- 分支 feat/multi-task-tracker（领先本地 main 数个提交；远端 PR #21 已合并）。
- 测试约定：supertest + express 挂载单路由，中文 describe/it；
  内存适配器隔离用 `resetInMemoryStore()`（来自 `lib/database-new` 再导出）。
- 提交身份：AiKiAi-stack <karsonwan@foxmail.com>（仓库 git config 已配置）。
