import { pgTable, uuid, varchar, boolean, timestamp, jsonb } from 'drizzle-orm/pg-core';

export const notifications = pgTable('notifications', {
  id: uuid('id').primaryKey().defaultRandom(),
  user_id: uuid('user_id').notNull(), // who receives the notification
  type: varchar('type', { length: 50 }).notNull(), // comment_on_post, post_published, etc.
  message: varchar('message', { length: 500 }).notNull(),
  metadata: jsonb('metadata').$type<Record<string, unknown>>().default({}),
  read: boolean('read').notNull().default(false),
  created_at: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});
