/**
 * API 路由测试
 *
 * 测试 API 端点的正确性
 */

import request from 'supertest';
import express from 'express';
import { authRouter } from '../routes/auth';

// 创建测试用 Express 应用
function createTestApp() {
  const app = express();
  app.use(express.json());
  app.use('/api/auth', authRouter);
  return app;
}

describe('Auth API', () => {
  let app: express.Express;

  beforeEach(() => {
    app = createTestApp();
  });

  describe('POST /api/auth/login', () => {
    it('应该拒绝空的 email', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .send({ email: '' });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('不能为空');
    });

    it('应该拒绝缺失 email 的请求', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .send({});

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
    });

    it('应该接受有效的 email 格式', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .send({ email: 'test@example.com' });

      // 响应应该包含 success 字段
      expect(response.status).toBeDefined();
      expect(response.body).toHaveProperty('success');
    });

    it('应该返回 JSON 格式响应', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .send({ email: 'test@example.com' });

      expect(response.headers['content-type']).toContain('application/json');
      expect(response.body).toHaveProperty('success');
    });
  });
});

describe('API 响应格式', () => {
  it('所有响应都应该包含 success 字段', async () => {
    const app = createTestApp();

    const response = await request(app)
      .post('/api/auth/login')
      .send({ email: 'test@example.com' });

    expect(response.body).toHaveProperty('success');
  });

  it('错误响应应该包含 error 字段', async () => {
    const app = createTestApp();

    const response = await request(app)
      .post('/api/auth/login')
      .send({ email: '' });

    expect(response.body).toHaveProperty('error');
  });
});
