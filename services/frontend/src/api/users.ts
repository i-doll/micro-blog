import { apiFetch } from './client';
import type { User, UsersResponse } from '../types';

export function getUser(id: string, token?: string | null): Promise<User> {
  return apiFetch<User>(`/api/users/${id}`, { token });
}

export function getUsers(
  params: { page?: number; limit?: number } = {},
  token: string,
): Promise<UsersResponse> {
  const searchParams = new URLSearchParams();
  if (params.page) searchParams.set('page', String(params.page));
  if (params.limit) searchParams.set('limit', String(params.limit));
  return apiFetch<UsersResponse>(`/api/users?${searchParams}`, { token });
}

export function updateUser(
  id: string,
  data: Partial<{ username: string; email: string; bio: string }>,
  token: string,
): Promise<User> {
  return apiFetch<User>(`/api/users/${id}`, {
    method: 'PUT',
    body: JSON.stringify(data),
    token,
  });
}

export function updateUserRole(id: string, role: string, token: string): Promise<void> {
  return apiFetch(`/api/users/${id}/role`, {
    method: 'PUT',
    body: JSON.stringify({ role }),
    token,
  });
}

export function changePassword(
  id: string,
  currentPassword: string,
  newPassword: string,
  token: string,
): Promise<void> {
  return apiFetch(`/api/users/${id}/password`, {
    method: 'PUT',
    body: JSON.stringify({ current_password: currentPassword, new_password: newPassword }),
    token,
  });
}

export function deleteUser(id: string, token: string): Promise<void> {
  return apiFetch(`/api/users/${id}`, { method: 'DELETE', token });
}
