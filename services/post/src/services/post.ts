import { eq, desc, and, inArray, sql } from 'drizzle-orm';
import { db, schema } from '../db/index.js';
import { getJetStream } from './nats.js';
import {
  POST_CREATED, POST_UPDATED, POST_PUBLISHED, POST_DELETED,
  createEnvelope,
  type PostCreated, type PostUpdated, type PostPublished, type PostDeleted,
  NotFoundError, ForbiddenError,
} from '@blog/shared';
import { StringCodec } from 'nats';

const sc = StringCodec();

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^\w\s-]/g, '')
    .replace(/[\s_]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 200);
}

async function ensureUniquSlug(slug: string, excludeId?: string): Promise<string> {
  let candidate = slug;
  let counter = 1;
  while (true) {
    const existing = await db.query.posts.findFirst({
      where: (posts, { eq, and, ne }) =>
        excludeId
          ? and(eq(posts.slug, candidate), ne(posts.id, excludeId))
          : eq(posts.slug, candidate),
    });
    if (!existing) return candidate;
    candidate = `${slug}-${counter++}`;
  }
}

async function ensureTags(tagNames: string[]): Promise<string[]> {
  if (tagNames.length === 0) return [];

  const tagIds: string[] = [];
  for (const name of tagNames) {
    const existing = await db.query.tags.findFirst({
      where: (tags, { eq }) => eq(tags.name, name.toLowerCase()),
    });
    if (existing) {
      tagIds.push(existing.id);
    } else {
      const [created] = await db.insert(schema.tags).values({ name: name.toLowerCase() }).returning();
      tagIds.push(created.id);
    }
  }
  return tagIds;
}

async function getPostTags(postId: string): Promise<string[]> {
  const rows = await db
    .select({ name: schema.tags.name })
    .from(schema.postTags)
    .innerJoin(schema.tags, eq(schema.postTags.tag_id, schema.tags.id))
    .where(eq(schema.postTags.post_id, postId));
  return rows.map((r) => r.name);
}

export async function createPost(authorId: string, data: {
  title: string; content: string; tags: string[]; status: string;
}) {
  const slug = await ensureUniquSlug(slugify(data.title));
  const publishedAt = data.status === 'published' ? new Date() : null;

  const [post] = await db.insert(schema.posts).values({
    author_id: authorId,
    title: data.title,
    slug,
    content: data.content,
    status: data.status,
    published_at: publishedAt,
  }).returning();

  // Handle tags
  const tagIds = await ensureTags(data.tags);
  if (tagIds.length > 0) {
    await db.insert(schema.postTags).values(
      tagIds.map((tag_id) => ({ post_id: post.id, tag_id })),
    );
  }

  const tags = await getPostTags(post.id);

  // Publish event
  const js = getJetStream();
  const event = createEnvelope<PostCreated>({
    post_id: post.id, author_id: authorId,
    title: post.title, slug: post.slug, content: post.content,
    tags, status: post.status,
  });
  await js.publish(POST_CREATED, sc.encode(JSON.stringify(event)));

  if (data.status === 'published') {
    const pubEvent = createEnvelope<PostPublished>({
      post_id: post.id, author_id: authorId, title: post.title, slug: post.slug,
    });
    await js.publish(POST_PUBLISHED, sc.encode(JSON.stringify(pubEvent)));
  }

  return { ...post, tags };
}

export function enforcePostVisibility(
  post: { status: string; author_id: string },
  userId?: string, userRole?: string,
) {
  if (post.status === 'published') return;
  if (userRole === 'admin') return;
  if (userRole === 'writer' && userId && post.author_id === userId) return;
  throw new NotFoundError('Post');
}

export async function getPostById(id: string, userId?: string, userRole?: string) {
  const post = await db.query.posts.findFirst({
    where: (posts, { eq }) => eq(posts.id, id),
  });
  if (!post) throw new NotFoundError('Post');
  enforcePostVisibility(post, userId, userRole);
  const tags = await getPostTags(post.id);
  return { ...post, tags };
}

export async function getPostBySlug(slug: string, userId?: string, userRole?: string) {
  const post = await db.query.posts.findFirst({
    where: (posts, { eq }) => eq(posts.slug, slug),
  });
  if (!post) throw new NotFoundError('Post');
  enforcePostVisibility(post, userId, userRole);
  const tags = await getPostTags(post.id);
  return { ...post, tags };
}

export async function listPosts(page: number, limit: number, status?: string, authorId?: string, allStatuses?: boolean, userId?: string, userRole?: string) {
  const offset = (page - 1) * limit;
  const conditions = [];

  // Enforce visibility: non-published statuses only visible to admins or own-posts writers
  let effectiveStatus = status;
  let effectiveAllStatuses = allStatuses;
  if (effectiveStatus && effectiveStatus !== 'published') {
    const isAdmin = userRole === 'admin';
    const isOwnWriter = userRole === 'writer' && authorId && userId && authorId === userId;
    if (!isAdmin && !isOwnWriter) {
      effectiveStatus = 'published';
      effectiveAllStatuses = false;
    }
  }

  // Default to published unless a specific status is requested or admin requests all
  if (!effectiveAllStatuses || effectiveStatus) {
    conditions.push(eq(schema.posts.status, effectiveStatus || 'published'));
  }
  if (authorId) conditions.push(eq(schema.posts.author_id, authorId));
  const where = conditions.length === 1 ? conditions[0] : and(...conditions);

  const [postsResult, countResult] = await Promise.all([
    db.select().from(schema.posts).where(where).orderBy(desc(schema.posts.created_at)).limit(limit).offset(offset),
    db.select({ count: sql<number>`count(*)::int` }).from(schema.posts).where(where),
  ]);

  const postsWithTags = await Promise.all(
    postsResult.map(async (post) => {
      const tags = await getPostTags(post.id);
      return { ...post, tags };
    }),
  );

  return {
    posts: postsWithTags,
    total: countResult[0].count,
    page,
    limit,
  };
}

export async function updatePost(id: string, authorId: string, data: {
  title?: string; content?: string; tags?: string[]; status?: string;
}, userRole?: string) {
  if (userRole !== 'writer' && userRole !== 'admin') throw new ForbiddenError('Writer or admin role required');

  const existing = await db.query.posts.findFirst({
    where: (posts, { eq }) => eq(posts.id, id),
  });
  if (!existing) throw new NotFoundError('Post');
  if (existing.author_id !== authorId && userRole !== 'admin') throw new ForbiddenError('Not the author of this post');

  const wasPublished = existing.status === 'published';
  const updates: Record<string, unknown> = { updated_at: new Date() };
  if (data.title) {
    updates.title = data.title;
    updates.slug = await ensureUniquSlug(slugify(data.title), id);
  }
  if (data.content) updates.content = data.content;
  if (data.status) {
    updates.status = data.status;
    if (data.status === 'published' && !existing.published_at) {
      updates.published_at = new Date();
    }
  }

  const [updated] = await db.update(schema.posts).set(updates).where(eq(schema.posts.id, id)).returning();

  // Update tags if provided
  if (data.tags) {
    await db.delete(schema.postTags).where(eq(schema.postTags.post_id, id));
    const tagIds = await ensureTags(data.tags);
    if (tagIds.length > 0) {
      await db.insert(schema.postTags).values(
        tagIds.map((tag_id) => ({ post_id: id, tag_id })),
      );
    }
  }

  const tags = await getPostTags(id);

  // Publish events
  const js = getJetStream();
  const event = createEnvelope<PostUpdated>({
    post_id: id, title: updated.title, slug: updated.slug,
    content: updated.content, tags, status: updated.status,
  });
  await js.publish(POST_UPDATED, sc.encode(JSON.stringify(event)));

  if (!wasPublished && updated.status === 'published') {
    const pubEvent = createEnvelope<PostPublished>({
      post_id: id, author_id: updated.author_id, title: updated.title, slug: updated.slug,
    });
    await js.publish(POST_PUBLISHED, sc.encode(JSON.stringify(pubEvent)));
  }

  return { ...updated, tags };
}

export async function deletePost(id: string, authorId: string, userRole?: string) {
  if (userRole !== 'writer' && userRole !== 'admin') throw new ForbiddenError('Writer or admin role required');

  const existing = await db.query.posts.findFirst({
    where: (posts, { eq }) => eq(posts.id, id),
  });
  if (!existing) throw new NotFoundError('Post');
  if (existing.author_id !== authorId && userRole !== 'admin') throw new ForbiddenError('Not the author of this post');

  await db.delete(schema.posts).where(eq(schema.posts.id, id));

  const js = getJetStream();
  const event = createEnvelope<PostDeleted>({ post_id: id });
  await js.publish(POST_DELETED, sc.encode(JSON.stringify(event)));
}
