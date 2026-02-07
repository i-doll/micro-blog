import { getApiUrl } from '../config';

export interface ApiError {
  status: number;
  message: string;
}

export async function apiFetch<T>(
  path: string,
  options: RequestInit & { token?: string | null } = {},
): Promise<T> {
  const { token, ...init } = options;
  const headers: Record<string, string> = {};

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  if (init.body && typeof init.body === 'string') {
    headers['Content-Type'] = 'application/json';
  }

  const resp = await fetch(getApiUrl() + path, {
    ...init,
    headers: { ...headers, ...(init.headers as Record<string, string>) },
  });

  if (resp.status === 204) return null as T;

  const data = await resp.json().catch(() => null);

  if (!resp.ok) {
    if (resp.status === 401 && token) {
      window.dispatchEvent(new Event('auth:expired'));
    }
    const error: ApiError = {
      status: resp.status,
      message: data?.error || data?.message || 'Request failed',
    };
    throw error;
  }

  return data as T;
}

export async function apiUpload<T>(
  path: string,
  formData: FormData,
  token?: string | null,
): Promise<T> {
  const headers: Record<string, string> = {};
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const resp = await fetch(getApiUrl() + path, {
    method: 'POST',
    headers,
    body: formData,
  });

  const data = await resp.json().catch(() => null);

  if (!resp.ok) {
    const error: ApiError = {
      status: resp.status,
      message: data?.error || 'Upload failed',
    };
    throw error;
  }

  return data as T;
}
