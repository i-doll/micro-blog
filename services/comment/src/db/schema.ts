import { pgTable, uuid, text, timestamp } from 'drizzle-orm/pg-core';

export const comments = pgTable('comments', {
  id: uuid('id').primaryKey().defaultRandom(),
  post_id: uuid('post_id').notNull(),
  author_id: uuid('author_id').notNull(),
  parent_id: uuid('parent_id'), // null for top-level comments, set for replies
  content: text('content').notNull(),
  created_at: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updated_at: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});
