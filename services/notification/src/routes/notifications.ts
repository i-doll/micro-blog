import { FastifyInstance } from 'fastify';
import { paginationSchema, USER_ID_HEADER } from '@blog/shared';
import * as notificationService from '../services/notification.js';

export async function notificationRoutes(app: FastifyInstance) {
  app.get('/notifications', async (request, reply) => {
    const userId = request.headers[USER_ID_HEADER] as string;
    if (!userId) return reply.status(401).send({ error: 'Missing user ID' });

    const query = paginationSchema.parse(request.query);
    const result = await notificationService.getNotifications(userId, query.page, query.limit);
    return reply.send(result);
  });

  app.put('/notifications/:id/read', async (request, reply) => {
    const { id } = request.params as { id: string };
    const userId = request.headers[USER_ID_HEADER] as string;
    if (!userId) return reply.status(401).send({ error: 'Missing user ID' });

    const notification = await notificationService.markAsRead(id, userId);
    if (!notification) return reply.status(404).send({ error: 'Notification not found' });
    return reply.send(notification);
  });

  app.put('/notifications/read-all', async (request, reply) => {
    const userId = request.headers[USER_ID_HEADER] as string;
    if (!userId) return reply.status(401).send({ error: 'Missing user ID' });

    await notificationService.markAllAsRead(userId);
    return reply.send({ success: true });
  });
}
