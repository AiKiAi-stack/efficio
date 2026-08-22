/**
 * TaskLogs 路由测试
 *
 * 覆盖任务核心流程（创建 → 开始 → 完成 → 反思）、
 * 时间字段继承（防止更新时清空 start_time/用时）、
 * 以及跨用户越权（IDOR）防护。
 */

import request from 'supertest';
import express from 'express';
import { taskLogsRouter } from '../routes/taskLogs';
import { resetInMemoryStore } from '../lib/database-new';

const app = express();
app.use(express.json());
app.use('/api/task-logs', taskLogsRouter);

const USER_A = 'test-user-a';
const USER_B = 'test-user-b';

describe('TaskLogs Routes', () => {
  beforeEach(() => {
    resetInMemoryStore();
  });

  describe('授权', () => {
    it('缺少 X-User-Id 时应返回 401', async () => {
      const list = await request(app).get('/api/task-logs');
      expect(list.status).toBe(401);

      const create = await request(app)
        .post('/api/task-logs')
        .send({ task_title: 'test' });
      expect(create.status).toBe(401);
    });
  });

  describe('核心流程', () => {
    it('开始任务应自动设置 start_time', async () => {
      const created = await request(app)
        .post('/api/task-logs')
        .set('x-user-id', USER_A)
        .send({ task_title: '任务一', status: 'pending' });

      expect(created.status).toBe(200);
      expect(created.body.data.start_time).toBeNull();

      const started = await request(app)
        .post('/api/task-logs')
        .set('x-user-id', USER_A)
        .send({ id: created.body.data.id, task_title: '任务一', status: 'in_progress' });

      expect(started.status).toBe(200);
      expect(started.body.data.status).toBe('in_progress');
      expect(started.body.data.start_time).toBeTruthy();
    });

    it('完成任务时应保留 start_time 并计算用时（客户端不回传时间字段）', async () => {
      const thirtyMinAgo = new Date(Date.now() - 30 * 60 * 1000).toISOString();
      const created = await request(app)
        .post('/api/task-logs')
        .set('x-user-id', USER_A)
        .send({ task_title: '任务二', status: 'in_progress', start_time: thirtyMinAgo });

      expect(created.status).toBe(200);
      expect(created.body.data.start_time).toBe(thirtyMinAgo);

      // 模拟前端补丁更新：只回传 id/title/status/outcome，不带任何时间字段
      const completed = await request(app)
        .post('/api/task-logs')
        .set('x-user-id', USER_A)
        .send({
          id: created.body.data.id,
          task_title: '任务二',
          status: 'completed',
          outcome: '完成了'
        });

      expect(completed.status).toBe(200);
      const task = completed.body.data;
      expect(task.status).toBe('completed');
      expect(task.start_time).toBe(thirtyMinAgo);
      expect(task.end_time).toBeTruthy();
      expect(task.time_spent_minutes).toBeGreaterThanOrEqual(29);
      expect(task.time_spent_minutes).toBeLessThanOrEqual(31);
    });

    it('完成后保存反思不应漂移 end_time 和用时', async () => {
      const created = await request(app)
        .post('/api/task-logs')
        .set('x-user-id', USER_A)
        .send({ task_title: '任务三', status: 'in_progress' });

      const completed = await request(app)
        .post('/api/task-logs')
        .set('x-user-id', USER_A)
        .send({ id: created.body.data.id, task_title: '任务三', status: 'completed', outcome: 'done' });

      const endTime = completed.body.data.end_time;
      const timeSpent = completed.body.data.time_spent_minutes;
      expect(endTime).toBeTruthy();

      const reflected = await request(app)
        .post('/api/task-logs')
        .set('x-user-id', USER_A)
        .send({
          id: created.body.data.id,
          task_title: '任务三',
          status: 'completed',
          outcome: 'done',
          reflection: '下次可以更快'
        });

      expect(reflected.status).toBe(200);
      expect(reflected.body.data.reflection).toBe('下次可以更快');
      expect(reflected.body.data.end_time).toBe(endTime);
      expect(reflected.body.data.time_spent_minutes).toBe(timeSpent);
    });

    it('重新开始已完成任务应清空 end_time 和用时', async () => {
      const created = await request(app)
        .post('/api/task-logs')
        .set('x-user-id', USER_A)
        .send({ task_title: '任务四', status: 'in_progress' });

      await request(app)
        .post('/api/task-logs')
        .set('x-user-id', USER_A)
        .send({ id: created.body.data.id, task_title: '任务四', status: 'completed', outcome: 'done' });

      const restarted = await request(app)
        .post('/api/task-logs')
        .set('x-user-id', USER_A)
        .send({ id: created.body.data.id, task_title: '任务四', status: 'in_progress' });

      expect(restarted.status).toBe(200);
      expect(restarted.body.data.status).toBe('in_progress');
      expect(restarted.body.data.end_time).toBeNull();
      expect(restarted.body.data.time_spent_minutes).toBeNull();
      expect(restarted.body.data.start_time).toBeTruthy();
    });
  });

  describe('所有权（IDOR 防护）', () => {
    it('不能更新其他用户的任务', async () => {
      const created = await request(app)
        .post('/api/task-logs')
        .set('x-user-id', USER_A)
        .send({ task_title: 'A 的任务', status: 'pending' });

      const attack = await request(app)
        .post('/api/task-logs')
        .set('x-user-id', USER_B)
        .send({ id: created.body.data.id, task_title: '被篡改', status: 'completed' });

      expect(attack.status).toBe(404);

      const check = await request(app)
        .get(`/api/task-logs/${created.body.data.id}`)
        .set('x-user-id', USER_A);

      expect(check.body.data.task_title).toBe('A 的任务');
      expect(check.body.data.status).toBe('pending');
    });

    it('更新不存在的任务应返回 404', async () => {
      const response = await request(app)
        .post('/api/task-logs')
        .set('x-user-id', USER_A)
        .send({ id: 'no-such-id', task_title: 'x', status: 'pending' });

      expect(response.status).toBe(404);
    });

    it('任务列表应只返回当前用户的任务', async () => {
      await request(app)
        .post('/api/task-logs')
        .set('x-user-id', USER_A)
        .send({ task_title: 'A 的任务', status: 'pending' });

      const listB = await request(app)
        .get('/api/task-logs')
        .set('x-user-id', USER_B);

      expect(listB.body.data).toEqual([]);
    });

    it('删除其他用户的任务不应生效', async () => {
      const created = await request(app)
        .post('/api/task-logs')
        .set('x-user-id', USER_A)
        .send({ task_title: 'A 的任务', status: 'pending' });

      const del = await request(app)
        .delete(`/api/task-logs/${created.body.data.id}`)
        .set('x-user-id', USER_B);
      expect(del.status).toBe(200);

      const check = await request(app)
        .get(`/api/task-logs/${created.body.data.id}`)
        .set('x-user-id', USER_A);
      expect(check.body.data).not.toBeNull();
      expect(check.body.data.task_title).toBe('A 的任务');
    });
  });

  describe('Jira 绑定', () => {
    it('创建时可直接绑定 jira_key', async () => {
      const created = await request(app)
        .post('/api/task-logs')
        .set('x-user-id', USER_A)
        .send({ task_title: '对接登录', jira_key: 'PROJ-123' });

      expect(created.status).toBe(200);
      expect(created.body.data.jira_key).toBe('PROJ-123');
    });

    it('补丁更新未携带 jira_key 时应继承现有值（不清空）', async () => {
      const created = await request(app)
        .post('/api/task-logs')
        .set('x-user-id', USER_A)
        .send({ task_title: '带 Jira 的任务', jira_key: 'PROJ-1', status: 'in_progress' });

      const patched = await request(app)
        .post('/api/task-logs')
        .set('x-user-id', USER_A)
        .send({ id: created.body.data.id, task_title: '带 Jira 的任务', status: 'completed', outcome: '完成' });

      expect(patched.status).toBe(200);
      expect(patched.body.data.jira_key).toBe('PROJ-1');
    });

    it('显式传 null 可解绑 jira_key', async () => {
      const created = await request(app)
        .post('/api/task-logs')
        .set('x-user-id', USER_A)
        .send({ task_title: '要解绑的任务', jira_key: 'PROJ-2' });

      const unbound = await request(app)
        .post('/api/task-logs')
        .set('x-user-id', USER_A)
        .send({ id: created.body.data.id, task_title: '要解绑的任务', jira_key: null });

      expect(unbound.status).toBe(200);
      expect(unbound.body.data.jira_key).toBeNull();
    });
  });

  describe('子任务', () => {
    it('创建子任务并返回 parent_id；列表可见', async () => {
      const parent = await request(app)
        .post('/api/task-logs')
        .set('x-user-id', USER_A)
        .send({ task_title: '父任务：搭建登录' });

      const child = await request(app)
        .post('/api/task-logs')
        .set('x-user-id', USER_A)
        .send({ task_title: '子任务：写表单校验', parent_id: parent.body.data.id });

      expect(child.status).toBe(200);
      expect(child.body.data.parent_id).toBe(parent.body.data.id);

      const list = await request(app).get('/api/task-logs').set('x-user-id', USER_A);
      expect(list.body.data.some((t: any) => t.id === child.body.data.id && t.parent_id === parent.body.data.id)).toBe(true);
    });

    it('parent_id 指向不存在的任务应返回 400', async () => {
      const res = await request(app)
        .post('/api/task-logs')
        .set('x-user-id', USER_A)
        .send({ task_title: '孤儿子任务', parent_id: 'no-such-task' });

      expect(res.status).toBe(400);
    });

    it('parent_id 指向他人任务应返回 404（防越权挂载）', async () => {
      const others = await request(app)
        .post('/api/task-logs')
        .set('x-user-id', USER_B)
        .send({ task_title: 'B 的任务' });

      const res = await request(app)
        .post('/api/task-logs')
        .set('x-user-id', USER_A)
        .send({ task_title: '偷挂子任务', parent_id: others.body.data.id });

      expect(res.status).toBe(404);
    });

    it('禁止二级嵌套：parent 不能本身是子任务', async () => {
      const parent = await request(app)
        .post('/api/task-logs')
        .set('x-user-id', USER_A)
        .send({ task_title: '顶层任务' });

      const child = await request(app)
        .post('/api/task-logs')
        .set('x-user-id', USER_A)
        .send({ task_title: '一级子任务', parent_id: parent.body.data.id });

      const grandchild = await request(app)
        .post('/api/task-logs')
        .set('x-user-id', USER_A)
        .send({ task_title: '二级子任务', parent_id: child.body.data.id });

      expect(grandchild.status).toBe(400);
    });

    it('删除父任务后子任务提升为顶层（parent_id 置空）', async () => {
      const parent = await request(app)
        .post('/api/task-logs')
        .set('x-user-id', USER_A)
        .send({ task_title: '将被删除的父任务' });

      const child = await request(app)
        .post('/api/task-logs')
        .set('x-user-id', USER_A)
        .send({ task_title: '幸存的子任务', parent_id: parent.body.data.id });

      await request(app)
        .delete(`/api/task-logs/${parent.body.data.id}`)
        .set('x-user-id', USER_A);

      const check = await request(app)
        .get(`/api/task-logs/${child.body.data.id}`)
        .set('x-user-id', USER_A);
      expect(check.body.data).not.toBeNull();
      expect(check.body.data.parent_id).toBeNull();
    });
  });
});
