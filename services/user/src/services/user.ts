import { eq, desc, sql } from 'drizzle-orm';
import { db, schema } from '../db/index.js';
import { getJetStream } from './nats.js';
import {
  USER_UPDATED,
  USER_DELETED,
  createEnvelope,
  type UserUpdated,
  type UserDeleted,
  NotFoundError,
} from '@blog/shared';
import { StringCodec } from 'nats';

const sc = StringCodec();

export async function listUsers(page: number, limit: number) {
  const offset = (page - 1) * limit;

  const [usersResult, countResult] = await Promise.all([
    db.select({
      id: schema.users.id,
      username: schema.users.username,
      email: schema.users.email,
      bio: schema.users.bio,
      role: schema.users.role,
      active: schema.users.active,
      created_at: schema.users.created_at,
      updated_at: schema.users.updated_at,
    }).from(schema.users).orderBy(desc(schema.users.created_at)).limit(limit).offset(offset),
    db.select({ count: sql<number>`count(*)::int` }).from(schema.users),
  ]);

  return {
    users: usersResult,
    total: countResult[0].count,
    page,
    limit,
  };
}

export async function updateUserRole(id: string, role: string) {
  const existing = await db.query.users.findFirst({
    where: (users, { eq }) => eq(users.id, id),
  });
  if (!existing) throw new NotFoundError('User');

  const [updated] = await db
    .update(schema.users)
    .set({ role, updated_at: new Date() })
    .where(eq(schema.users.id, id))
    .returning({
      id: schema.users.id,
      username: schema.users.username,
      email: schema.users.email,
      bio: schema.users.bio,
      role: schema.users.role,
      created_at: schema.users.created_at,
      updated_at: schema.users.updated_at,
    });

  return updated;
}

export async function getUserById(id: string) {
  const user = await db.query.users.findFirst({
    where: (users, { eq }) => eq(users.id, id),
    columns: { password_hash: false },
  });
  if (!user) throw new NotFoundError('User');
  return user;
}

export async function updateUser(id: string, data: { username?: string; bio?: string }) {
  const existing = await db.query.users.findFirst({
    where: (users, { eq }) => eq(users.id, id),
  });
  if (!existing) throw new NotFoundError('User');

  const [updated] = await db
    .update(schema.users)
    .set({ ...data, updated_at: new Date() })
    .where(eq(schema.users.id, id))
    .returning({
      id: schema.users.id,
      username: schema.users.username,
      email: schema.users.email,
      bio: schema.users.bio,
      role: schema.users.role,
      created_at: schema.users.created_at,
      updated_at: schema.users.updated_at,
    });

  // Publish user.updated event
  const js = getJetStream();
  const event = createEnvelope<UserUpdated>({
    user_id: updated.id,
    username: data.username,
    bio: data.bio,
  });
  await js.publish(USER_UPDATED, sc.encode(JSON.stringify(event)));

  return updated;
}

export async function deleteUser(id: string) {
  const existing = await db.query.users.findFirst({
    where: (users, { eq }) => eq(users.id, id),
  });
  if (!existing) throw new NotFoundError('User');

  await db.delete(schema.users).where(eq(schema.users.id, id));

  // Publish user.deleted event
  const js = getJetStream();
  const event = createEnvelope<UserDeleted>({ user_id: id });
  await js.publish(USER_DELETED, sc.encode(JSON.stringify(event)));
}
