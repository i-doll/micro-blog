import { FastifyInstance } from 'fastify';
import { updateUserSchema, updateRoleSchema, paginationSchema, USER_ID_HEADER, USER_ROLE_HEADER } from '@blog/shared';
import * as userService from '../services/user.js';

function isAdmin(request: { headers: Record<string, string | string[] | undefined> }): boolean {
  return request.headers[USER_ROLE_HEADER] === 'admin';
}

export async function userRoutes(app: FastifyInstance) {
  // Admin: list all users (must be registered before GET /users/:id)
  app.get('/users', async (request, reply) => {
    if (!isAdmin(request)) {
      return reply.status(403).send({ error: 'Admin access required' });
    }
    const query = paginationSchema.parse(request.query);
    const result = await userService.listUsers(query.page, query.limit);
    return reply.send(result);
  });

  // Admin: update user role (must be registered before PUT /users/:id)
  app.put('/users/:id/role', async (request, reply) => {
    if (!isAdmin(request)) {
      return reply.status(403).send({ error: 'Admin access required' });
    }
    const { id } = request.params as { id: string };
    const body = updateRoleSchema.parse(request.body);
    const user = await userService.updateUserRole(id, body.role);
    return reply.send(user);
  });

  // Current user shorthand (must be registered before /users/:id)
  app.get('/users/me', async (request, reply) => {
    const userId = request.headers[USER_ID_HEADER] as string;
    if (!userId) {
      return reply.status(401).send({ error: 'Not authenticated' });
    }
    const user = await userService.getUserById(userId);
    return reply.send(user);
  });

  app.get('/users/:id', async (request, reply) => {
    const { id } = request.params as { id: string };
    const user = await userService.getUserById(id);
    return reply.send(user);
  });

  app.put('/users/:id', async (request, reply) => {
    const { id } = request.params as { id: string };
    const requesterId = request.headers[USER_ID_HEADER] as string;

    if (requesterId !== id && !isAdmin(request)) {
      return reply.status(403).send({ error: 'Can only update your own profile' });
    }

    const body = updateUserSchema.parse(request.body);
    const user = await userService.updateUser(id, body);
    return reply.send(user);
  });

  app.delete('/users/:id', async (request, reply) => {
    const { id } = request.params as { id: string };
    const requesterId = request.headers[USER_ID_HEADER] as string;

    if (requesterId !== id && !isAdmin(request)) {
      return reply.status(403).send({ error: 'Can only delete your own account' });
    }

    await userService.deleteUser(id);
    return reply.status(204).send();
  });
}
