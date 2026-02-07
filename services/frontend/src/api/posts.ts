import { apiFetch } from './client';
import type { Post, PostsResponse } from '../types';

export function getPosts(
  params: {
    page?: number;
    limit?: number;
    author_id?: string;
    status?: string;
  } = {},
  token?: string | null,
): Promise<PostsResponse> {
  const searchParams = new URLSearchParams();
  if (params.page) searchParams.set('page', String(params.page));
  if (params.limit) searchParams.set('limit', String(params.limit));
  if (params.author_id) searchParams.set('author_id', params.author_id);
  if (params.status) searchParams.set('status', params.status);
  return apiFetch<PostsResponse>(`/api/posts?${searchParams}`, { token });
}

export function getPost(id: string, token?: string | null): Promise<Post> {
  return apiFetch<Post>(`/api/posts/${id}`, { token });
}

export function createPost(
  data: { title: string; content: string; tags: string[]; status: string },
  token: string,
): Promise<Post> {
  return apiFetch<Post>('/api/posts', {
    method: 'POST',
    body: JSON.stringify(data),
    token,
  });
}

export function updatePost(
  id: string,
  data: Partial<{ title: string; content: string; tags: string[]; status: string }>,
  token: string,
): Promise<Post> {
  return apiFetch<Post>(`/api/posts/${id}`, {
    method: 'PUT',
    body: JSON.stringify(data),
    token,
  });
}

export function deletePost(id: string, token: string): Promise<void> {
  return apiFetch(`/api/posts/${id}`, { method: 'DELETE', token });
}
