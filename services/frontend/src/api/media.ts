import { apiFetch, apiUpload } from './client';
import type { Media, MediaResponse } from '../types';

export function getMedia(token: string, all?: boolean): Promise<MediaResponse> {
  const query = all ? '?all=true' : '';
  return apiFetch<MediaResponse>(`/api/media${query}`, { token });
}

export function uploadMedia(file: File, token: string): Promise<Media> {
  const formData = new FormData();
  formData.append('file', file);
  return apiUpload<Media>('/api/media', formData, token);
}

export function deleteMedia(id: string, token: string): Promise<void> {
  return apiFetch(`/api/media/${id}`, { method: 'DELETE', token });
}
