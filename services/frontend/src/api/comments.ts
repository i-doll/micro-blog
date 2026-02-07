import { apiFetch } from './client';
import type { Comment, CommentsResponse } from '../types';

export function getPostComments(postId: string, token?: string | null): Promise<CommentsResponse> {
  return apiFetch<CommentsResponse>(`/api/comments/posts/${postId}/comments`, { token });
}

export function getComments(
  params: { page?: number; limit?: number; post_ids?: string },
  token: string,
): Promise<CommentsResponse> {
  const searchParams = new URLSearchParams();
  if (params.page) searchParams.set('page', String(params.page));
  if (params.limit) searchParams.set('limit', String(params.limit));
  if (params.post_ids) searchParams.set('post_ids', params.post_ids);
  return apiFetch<CommentsResponse>(`/api/comments?${searchParams}`, { token });
}

export function createComment(
  data: { post_id: string; content: string; parent_id?: string | null },
  token: string,
): Promise<Comment> {
  return apiFetch<Comment>('/api/comments', {
    method: 'POST',
    body: JSON.stringify(data),
    token,
  });
}

export function deleteComment(id: string, token: string): Promise<void> {
  return apiFetch(`/api/comments/${id}`, { method: 'DELETE', token });
}
