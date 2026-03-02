import request from 'supertest';
import express from 'express';
import { authRouter } from '../routes/auth';

// 创建测试用的 Express 应用
const app = express();
app.use(express.json());
app.use('/api/auth', authRouter);

describe('Auth Routes', () => {
  describe('POST /api/auth/login', () => {
    it('should return error when email is missing', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .send({});

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('邮箱');
    });

    it('should return error when email is not a string', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .send({ email: 123 });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
    });

    it('should create a new user and return session token', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .send({ email: 'newuser@test.com' });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toBeDefined();
      expect(response.body.data.user).toBeDefined();
      expect(response.body.data.user.email).toBe('newuser@test.com');
      expect(response.body.data.session_token).toBeDefined();
    });

    it('should return existing user on subsequent logins', async () => {
      // 第一次登录 - 创建用户
      const firstResponse = await request(app)
        .post('/api/auth/login')
        .send({ email: 'returning@test.com' });

      expect(firstResponse.status).toBe(200);
      const firstUserId = firstResponse.body.data.user.id;

      // 第二次登录 - 获取现有用户
      const secondResponse = await request(app)
        .post('/api/auth/login')
        .send({ email: 'returning@test.com' });

      expect(secondResponse.status).toBe(200);
      expect(secondResponse.body.data.user.id).toBe(firstUserId);
    });

    it('should handle email case-insensitively', async () => {
      const response1 = await request(app)
        .post('/api/auth/login')
        .send({ email: 'CaseSensitive@Test.com' });

      const response2 = await request(app)
        .post('/api/auth/login')
        .send({ email: 'casesensitive@test.com' });

      expect(response1.body.data.user.id).toBe(response2.body.data.user.id);
    });

    it('should generate different session tokens for same user', async () => {
      const response1 = await request(app)
        .post('/api/auth/login')
        .send({ email: 'tokenTest@test.com' });

      // 等待一小段时间以确保时间戳不同
      await new Promise(resolve => setTimeout(resolve, 10));

      const response2 = await request(app)
        .post('/api/auth/login')
        .send({ email: 'tokenTest@test.com' });

      expect(response1.body.data.session_token).not.toBe(response2.body.data.session_token);
    });
  });
});
