# RIL — Repository Intelligence Layer

Efficio 仓库的长期工程记忆。每轮自主迭代的重要发现、根因、决策、验证结果、
已知风险和后续方向记录于此，按时间倒序追加。

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
