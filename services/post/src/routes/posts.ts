import { FastifyInstance } from 'fastify';
import { createPostSchema, updatePostSchema, paginationSchema, USER_ID_HEADER, USER_ROLE_HEADER } from '@blog/shared';
import * as postService from '../services/post.js';

export async function postRoutes(app: FastifyInstance) {
  app.post('/posts', async (request, reply) => {
    const authorId = request.headers[USER_ID_HEADER] as string;
    if (!authorId) return reply.status(401).send({ error: 'Missing user ID' });

    const userRole = request.headers[USER_ROLE_HEADER] as string | undefined;
    if (userRole !== 'writer' && userRole !== 'admin') {
      return reply.status(403).send({ error: 'Writer or admin role required to create posts' });
    }

    const body = createPostSchema.parse(request.body);
    const post = await postService.createPost(authorId, body);
    return reply.status(201).send(post);
  });

  app.get('/posts', async (request, reply) => {
    const query = paginationSchema.parse(request.query);
    const { status, author_id } = request.query as { status?: string; author_id?: string };
    const userRole = request.headers[USER_ROLE_HEADER] as string | undefined;
    const userId = request.headers[USER_ID_HEADER] as string | undefined;
    const writerOwnPosts = userRole === 'writer' && author_id && author_id === userId;
    const allStatuses = ((userRole === 'admin' && !status) || writerOwnPosts) as boolean;
    const result = await postService.listPosts(query.page, query.limit, status, author_id, allStatuses, userId, userRole);
    return reply.send(result);
  });

  app.get('/posts/:id', async (request, reply) => {
    const { id } = request.params as { id: string };
    const userId = request.headers[USER_ID_HEADER] as string | undefined;
    const userRole = request.headers[USER_ROLE_HEADER] as string | undefined;
    const post = await postService.getPostById(id, userId, userRole);
    return reply.send(post);
  });

  app.get('/posts/by-slug/:slug', async (request, reply) => {
    const { slug } = request.params as { slug: string };
    const userId = request.headers[USER_ID_HEADER] as string | undefined;
    const userRole = request.headers[USER_ROLE_HEADER] as string | undefined;
    const post = await postService.getPostBySlug(slug, userId, userRole);
    return reply.send(post);
  });

  app.put('/posts/:id', async (request, reply) => {
    const { id } = request.params as { id: string };
    const authorId = request.headers[USER_ID_HEADER] as string;
    if (!authorId) return reply.status(401).send({ error: 'Missing user ID' });

    const userRole = request.headers[USER_ROLE_HEADER] as string | undefined;
    const body = updatePostSchema.parse(request.body);
    const post = await postService.updatePost(id, authorId, body, userRole);
    return reply.send(post);
  });

  app.delete('/posts/:id', async (request, reply) => {
    const { id } = request.params as { id: string };
    const authorId = request.headers[USER_ID_HEADER] as string;
    if (!authorId) return reply.status(401).send({ error: 'Missing user ID' });

    const userRole = request.headers[USER_ROLE_HEADER] as string | undefined;
    await postService.deletePost(id, authorId, userRole);
    return reply.status(204).send();
  });
}
