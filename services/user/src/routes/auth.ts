import { FastifyInstance } from 'fastify';
import { registerSchema, loginSchema, refreshSchema, AppError } from '@blog/shared';
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
}
