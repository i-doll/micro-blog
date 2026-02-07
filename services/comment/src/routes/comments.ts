import { FastifyInstance } from 'fastify';
import { createCommentSchema, paginationSchema, USER_ID_HEADER, USER_ROLE_HEADER } from '@blog/shared';
import * as commentService from '../services/comment.js';

export async function commentRoutes(app: FastifyInstance) {
  // Create comment (post_id in body)
  app.post('/comments', async (request, reply) => {
    const authorId = request.headers[USER_ID_HEADER] as string;
    if (!authorId) return reply.status(401).send({ error: 'Missing user ID' });

    const body = createCommentSchema.parse(request.body);
    const comment = await commentService.createComment(body.post_id, authorId, body.content, body.parent_id);
    return reply.status(201).send(comment);
  });

  // List all comments (global, with optional post_ids filter)
  app.get('/comments', async (request, reply) => {
    const query = paginationSchema.parse(request.query);
    const { post_ids } = request.query as { post_ids?: string };
    const postIdArray = post_ids ? post_ids.split(',').filter(Boolean) : undefined;
    const result = await commentService.listComments(query.page, query.limit, postIdArray);
    return reply.send(result);
  });

  // Create comment on a post (nested route)
  app.post('/posts/:postId/comments', async (request, reply) => {
    const { postId } = request.params as { postId: string };
    const authorId = request.headers[USER_ID_HEADER] as string;
    if (!authorId) return reply.status(401).send({ error: 'Missing user ID' });

    const body = createCommentSchema.parse(request.body);
    const comment = await commentService.createComment(postId, authorId, body.content, body.parent_id);
    return reply.status(201).send(comment);
  });

  // List comments for a post
  app.get('/posts/:postId/comments', async (request, reply) => {
    const { postId } = request.params as { postId: string };
    const query = paginationSchema.parse(request.query);
    const result = await commentService.getCommentsByPost(postId, query.page, query.limit);
    return reply.send(result);
  });

  // Delete a comment
  app.delete('/comments/:id', async (request, reply) => {
    const { id } = request.params as { id: string };
    const authorId = request.headers[USER_ID_HEADER] as string;
    if (!authorId) return reply.status(401).send({ error: 'Missing user ID' });

    const userRole = request.headers[USER_ROLE_HEADER] as string | undefined;
    await commentService.deleteComment(id, authorId, userRole);
    return reply.status(204).send();
  });
}
