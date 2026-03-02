import request from 'supertest';
import express from 'express';
import { recordsRouter } from '../routes/records';

// 创建测试用的 Express 应用
const app = express();
app.use(express.json());
app.use('/api/records', recordsRouter);

// 模拟用户 ID
const TEST_USER_ID = 'test-user-123';

describe('Records Routes', () => {
  describe('GET /api/records', () => {
    it('should return 401 when user ID is missing', async () => {
      const response = await request(app).get('/api/records');

      expect(response.status).toBe(401);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('未授权');
    });

    it('should return empty array when no records exist', async () => {
      const response = await request(app)
        .get('/api/records')
        .set('x-user-id', TEST_USER_ID);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toEqual(expect.any(Array));
    });

    it('should return user records', async () => {
      // 先创建记录
      const createResponse = await request(app)
        .post('/api/records')
        .set('x-user-id', TEST_USER_ID)
        .send({ original_text: 'Test record' });

      expect(createResponse.status).toBe(200);

      // 获取记录
      const getResponse = await request(app)
        .get('/api/records')
        .set('x-user-id', TEST_USER_ID);

      expect(getResponse.status).toBe(200);
      expect(getResponse.body.data).toHaveLength(1);
      expect(getResponse.body.data[0].original_text).toBe('Test record');
    });
  });

  describe('POST /api/records', () => {
    it('should return 401 when user ID is missing', async () => {
      const response = await request(app)
        .post('/api/records')
        .send({ original_text: 'Test' });

      expect(response.status).toBe(401);
      expect(response.body.success).toBe(false);
    });

    it('should return 400 when original_text is missing', async () => {
      const response = await request(app)
        .post('/api/records')
        .set('x-user-id', TEST_USER_ID)
        .send({});

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('原始内容不能为空');
    });

    it('should create a record with original_text only', async () => {
      const response = await request(app)
        .post('/api/records')
        .set('x-user-id', TEST_USER_ID)
        .send({ original_text: 'Today I worked on bug fixes' });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toBeDefined();
      expect(response.body.data.original_text).toBe('Today I worked on bug fixes');
      expect(response.body.data.structured_data).toBeDefined();
      expect(response.body.data.structured_data.task_category).toBeDefined();
    });

    it('should create a record with optimized_text', async () => {
      const response = await request(app)
        .post('/api/records')
        .set('x-user-id', TEST_USER_ID)
        .send({
          original_text: 'Fixed bugs',
          optimized_text: 'Resolved critical bugs in the authentication module'
        });

      expect(response.status).toBe(200);
      expect(response.body.data.original_text).toBe('Fixed bugs');
      expect(response.body.data.optimized_text).toBe('Resolved critical bugs in the authentication module');
    });

    it('should analyze content and extract structured data', async () => {
      const response = await request(app)
        .post('/api/records')
        .set('x-user-id', TEST_USER_ID)
        .send({ original_text: '开发了新功能，使用 VSCode 和 Git 编写代码' });

      expect(response.status).toBe(200);
      expect(response.body.data.structured_data).toBeDefined();
      expect(response.body.data.structured_data.task_category).toBe('development');
      expect(response.body.data.structured_data.tools_used).toContain('VSCode');
      expect(response.body.data.structured_data.tools_used).toContain('Git');
    });

    it('should handle Chinese content', async () => {
      const response = await request(app)
        .post('/api/records')
        .set('x-user-id', TEST_USER_ID)
        .send({ original_text: '今天参加了项目评审会议，讨论了新功能的设计方案' });

      expect(response.status).toBe(200);
      expect(response.body.data.structured_data.task_category).toBe('meeting');
    });
  });

  describe('GET /api/records/:id', () => {
    it('should return a single record by id', async () => {
      // 先创建记录
      const createResponse = await request(app)
        .post('/api/records')
        .set('x-user-id', TEST_USER_ID)
        .send({ original_text: 'Single record test' });

      const recordId = createResponse.body.data.id;

      // 获取单条记录
      const getResponse = await request(app)
        .get(`/api/records/${recordId}`);

      expect(getResponse.status).toBe(200);
      expect(getResponse.body.data.id).toBe(recordId);
      expect(getResponse.body.data.original_text).toBe('Single record test');
    });
  });

  describe('DELETE /api/records/:id', () => {
    it('should delete a record', async () => {
      // 先创建记录
      const createResponse = await request(app)
        .post('/api/records')
        .set('x-user-id', TEST_USER_ID)
        .send({ original_text: 'To be deleted' });

      const recordId = createResponse.body.data.id;

      // 删除记录
      const deleteResponse = await request(app)
        .delete(`/api/records/${recordId}`);

      expect(deleteResponse.status).toBe(200);
      expect(deleteResponse.body.success).toBe(true);

      // 验证已删除
      const getResponse = await request(app)
        .get(`/api/records/${recordId}`);

      // 应该返回空或错误
      expect(getResponse.body.data).toBeNull();
    });

    it('should handle deleting non-existent record', async () => {
      const deleteResponse = await request(app)
        .delete('/api/records/non-existent-id');

      expect(deleteResponse.status).toBe(200);
      expect(deleteResponse.body.success).toBe(true);
    });
  });
});
