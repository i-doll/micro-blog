import { eq, desc, and, sql } from 'drizzle-orm';
import { db, schema } from '../db/index.js';

export async function createNotification(
  userId: string,
  type: string,
  message: string,
  metadata: Record<string, unknown> = {},
) {
  const [notification] = await db.insert(schema.notifications).values({
    user_id: userId,
    type,
    message,
    metadata,
  }).returning();
  return notification;
}

export async function getNotifications(userId: string, page: number, limit: number) {
  const offset = (page - 1) * limit;

  const [results, countResult] = await Promise.all([
    db.select()
      .from(schema.notifications)
      .where(eq(schema.notifications.user_id, userId))
      .orderBy(desc(schema.notifications.created_at))
      .limit(limit)
      .offset(offset),
    db.select({ count: sql<number>`count(*)::int` })
      .from(schema.notifications)
      .where(eq(schema.notifications.user_id, userId)),
  ]);

  return {
    notifications: results,
    total: countResult[0].count,
    page,
    limit,
  };
}

export async function markAsRead(id: string, userId: string) {
  const [updated] = await db
    .update(schema.notifications)
    .set({ read: true })
    .where(and(eq(schema.notifications.id, id), eq(schema.notifications.user_id, userId)))
    .returning();
  return updated;
}

export async function markAllAsRead(userId: string) {
  await db
    .update(schema.notifications)
    .set({ read: true })
    .where(and(eq(schema.notifications.user_id, userId), eq(schema.notifications.read, false)));
}

export async function deleteUserNotifications(userId: string) {
  await db.delete(schema.notifications).where(eq(schema.notifications.user_id, userId));
}
