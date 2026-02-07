import { eq, desc, and, sql } from 'drizzle-orm';
import { db, schema } from '../db/index.js';
import { getJetStream } from './nats.js';
import {
  COMMENT_CREATED, COMMENT_DELETED,
  createEnvelope,
  type CommentCreated, type CommentDeleted,
  NotFoundError,
} from '@blog/shared';
import { StringCodec } from 'nats';

const sc = StringCodec();

export async function createComment(
  postId: string,
  authorId: string,
  content: string,
  parentId: string | null,
) {
  // If parentId is set, verify parent exists and belongs to the same post
  if (parentId) {
    const parent = await db.query.comments.findFirst({
      where: (comments, { eq }) => eq(comments.id, parentId),
    });
    if (!parent || parent.post_id !== postId) {
      throw new NotFoundError('Parent comment');
    }
  }

  const [comment] = await db.insert(schema.comments).values({
    post_id: postId,
    author_id: authorId,
    parent_id: parentId,
    content,
  }).returning();

  const js = getJetStream();
  const event = createEnvelope<CommentCreated>({
    comment_id: comment.id,
    post_id: postId,
    author_id: authorId,
    content,
    parent_id: parentId,
  });
  await js.publish(COMMENT_CREATED, sc.encode(JSON.stringify(event)));

  return comment;
}

export async function getCommentsByPost(postId: string, page: number, limit: number) {
  const offset = (page - 1) * limit;

  const [commentsResult, countResult] = await Promise.all([
    db.select()
      .from(schema.comments)
      .where(eq(schema.comments.post_id, postId))
      .orderBy(desc(schema.comments.created_at))
      .limit(limit)
      .offset(offset),
    db.select({ count: sql<number>`count(*)::int` })
      .from(schema.comments)
      .where(eq(schema.comments.post_id, postId)),
  ]);

  return {
    comments: commentsResult,
    total: countResult[0].count,
    page,
    limit,
  };
}

export async function deleteComment(id: string, authorId: string, userRole?: string) {
  const comment = await db.query.comments.findFirst({
    where: (comments, { eq }) => eq(comments.id, id),
  });
  if (!comment) throw new NotFoundError('Comment');

  if (comment.author_id !== authorId && userRole !== 'admin') {
    throw new NotFoundError('Comment'); // Don't leak info about existence
  }

  await db.delete(schema.comments).where(eq(schema.comments.id, id));

  const js = getJetStream();
  const event = createEnvelope<CommentDeleted>({
    comment_id: id,
    post_id: comment.post_id,
  });
  await js.publish(COMMENT_DELETED, sc.encode(JSON.stringify(event)));
}
