import { FastifyInstance } from 'fastify';
import { registerSchema, loginSchema, refreshSchema, changePasswordSchema, AppError, USER_ID_HEADER } from '@blog/shared';
import * as authService from '../services/auth.js';

export async function authRoutes(app: FastifyInstance) {
  app.post('/auth/register', async (request, reply) => {
    const body = registerSchema.parse(request.body);
    const user = await authService.register(body.username, body.email, body.password);
    return reply.status(201).send(user);
  });

  app.post('/auth/login', async (request, reply) => {
    const body = loginSchema.parse(request.body);
    const result = await authService.login(body.email, body.password);
    return reply.send(result);
  });

  app.post('/auth/refresh', async (request, reply) => {
    const body = refreshSchema.parse(request.body);
    const result = await authService.refresh(body.refresh_token);
    return reply.send(result);
  });

  app.put('/auth/password', async (request, reply) => {
    const userId = request.headers[USER_ID_HEADER] as string;
    if (!userId) {
      return reply.status(401).send({ error: 'Unauthorized' });
    }
    const body = changePasswordSchema.parse(request.body);
    await authService.changePassword(userId, body.current_password, body.new_password);
    return reply.send({ message: 'Password changed successfully' });
  });
}
