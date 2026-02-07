import { z } from 'zod';

// Auth schemas
export const registerSchema = z.object({
  username: z.string().min(3).max(50),
  email: z.string().email(),
  password: z.string().min(8).max(128),
});

export const loginSchema = z.object({
  email: z.string().email(),
  password: z.string(),
});

export const refreshSchema = z.object({
  refresh_token: z.string(),
});

// User schemas
export const updateUserSchema = z.object({
  username: z.string().min(3).max(50).optional(),
  bio: z.string().max(500).optional(),
});

export const updateRoleSchema = z.object({
  role: z.enum(['user', 'admin']),
});

// Post schemas
export const createPostSchema = z.object({
  title: z.string().min(1).max(200),
  content: z.string().min(1),
  tags: z.array(z.string().max(50)).max(10).default([]),
  status: z.enum(['draft', 'published']).default('draft'),
});

export const updatePostSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  content: z.string().min(1).optional(),
  tags: z.array(z.string().max(50)).max(10).optional(),
  status: z.enum(['draft', 'published', 'archived']).optional(),
});

// Comment schemas
export const createCommentSchema = z.object({
  post_id: z.string().uuid().optional(),
  content: z.string().min(1).max(5000),
  parent_id: z.string().uuid().nullable().default(null),
});

// Pagination
export const paginationSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

// Search
export const searchSchema = z.object({
  q: z.string().min(1).max(200),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});
