/**
 * Suggestions 路由测试
 *
 * 覆盖 PATCH /:id/action 的鉴权与所有权（IDOR 防护）。
 */

import request from 'supertest';
import express from 'express';
import { suggestionsRouter } from '../routes/suggestions';
import { getDatabase, resetInMemoryStore } from '../lib/database-new';

const app = express();
app.use(express.json());
app.use('/api/suggestions', suggestionsRouter);

const USER_A = 'test-user-a';
const USER_B = 'test-user-b';

async function seedSuggestion(userId: string): Promise<string> {
  const { data } = await getDatabase().insert('optimization_suggestions', {
    user_id: userId,
    suggestion_type: 'pattern',
    suggestion_data: { title: '减少会议打断' },
    is_actioned: false
  });
  return (data as any).id;
}

describe('Suggestions Routes', () => {
  beforeEach(() => {
    resetInMemoryStore();
  });

  describe('PATCH /api/suggestions/:id/action', () => {
    it('缺少 X-User-Id 时应返回 401', async () => {
      const response = await request(app).patch('/api/suggestions/any-id/action');

      expect(response.status).toBe(401);
      expect(response.body.success).toBe(false);
    });

    it('本人标记建议为已执行应成功', async () => {
      const id = await seedSuggestion(USER_A);

      const response = await request(app)
        .patch(`/api/suggestions/${id}/action`)
        .set('x-user-id', USER_A);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);

      const { data } = await getDatabase().selectSingle('optimization_suggestions', {
        where: { id }
      });
      expect((data as any).is_actioned).toBe(true);
    });

    it('不能标记其他用户的建议', async () => {
      const id = await seedSuggestion(USER_A);

      const response = await request(app)
        .patch(`/api/suggestions/${id}/action`)
        .set('x-user-id', USER_B);

      expect(response.status).toBe(404);

      const { data } = await getDatabase().selectSingle('optimization_suggestions', {
        where: { id }
      });
      expect((data as any).is_actioned).toBe(false);
    });

    it('标记不存在的建议应返回 404', async () => {
      const response = await request(app)
        .patch('/api/suggestions/no-such-id/action')
        .set('x-user-id', USER_A);

      expect(response.status).toBe(404);
      expect(response.body.success).toBe(false);
    });
  });
});
