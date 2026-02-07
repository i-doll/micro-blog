import { apiFetch } from './client';
import type { NotificationsResponse } from '../types';

export function getNotifications(token: string): Promise<NotificationsResponse> {
  return apiFetch<NotificationsResponse>('/api/notifications', { token });
}

export function markAllRead(token: string): Promise<void> {
  return apiFetch('/api/notifications/read-all', { method: 'PUT', token });
}
