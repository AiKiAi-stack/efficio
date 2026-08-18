# RIL — Repository Intelligence Layer

Efficio 仓库的长期工程记忆。每轮自主迭代的重要发现、根因、决策、验证结果、
已知风险和后续方向记录于此，按时间倒序追加。

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
- 待办：TaskTracker 进行中任务的"已进行 X 分钟"仅在重渲染时更新，
  无定时器（前端 UX 缺陷，计划下一轮修复）。
- 待办：根 `package.json` 有 `lint` 脚本但仓库无 eslint 配置，属技术债。
- 待办：task-logs 之外其他路由（records、dailyLogs、summaries 等）
  是否存在同类 IDOR/覆盖问题，尚未全面审计。

### 环境事实
- 分支 feat/multi-task-tracker（领先本地 main 数个提交；远端 PR #21 已合并）。
- 测试约定：supertest + express 挂载单路由，中文 describe/it；
  内存适配器隔离用 `resetInMemoryStore()`（来自 `lib/database-new` 再导出）。
- 提交身份：AiKiAi-stack <karsonwan@foxmail.com>（仓库 git config 已配置）。
