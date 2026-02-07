import { apiFetch } from './client';
import type { SearchResponse } from '../types';

export function searchPosts(query: string): Promise<SearchResponse> {
  return apiFetch<SearchResponse>(`/api/search?q=${encodeURIComponent(query)}`);
}
