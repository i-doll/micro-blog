import { FastifyInstance } from 'fastify';
import { createPostSchema, updatePostSchema, paginationSchema, USER_ID_HEADER, USER_ROLE_HEADER } from '@blog/shared';
import * as postService from '../services/post.js';

export async function postRoutes(app: FastifyInstance) {
  app.post('/posts', async (request, reply) => {
    const authorId = request.headers[USER_ID_HEADER] as string;
    if (!authorId) return reply.status(401).send({ error: 'Missing user ID' });

    const body = createPostSchema.parse(request.body);
    const post = await postService.createPost(authorId, body);
    return reply.status(201).send(post);
  });

  app.get('/posts', async (request, reply) => {
    const query = paginationSchema.parse(request.query);
    const { status, author_id } = request.query as { status?: string; author_id?: string };
    const userRole = request.headers[USER_ROLE_HEADER] as string | undefined;
    const allStatuses = userRole === 'admin' && !status;
    const result = await postService.listPosts(query.page, query.limit, status, author_id, allStatuses);
    return reply.send(result);
  });

  app.get('/posts/:id', async (request, reply) => {
    const { id } = request.params as { id: string };
    const post = await postService.getPostById(id);
    return reply.send(post);
  });

  app.get('/posts/by-slug/:slug', async (request, reply) => {
    const { slug } = request.params as { slug: string };
    const post = await postService.getPostBySlug(slug);
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
