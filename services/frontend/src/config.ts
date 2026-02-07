export function getApiUrl(): string {
  return window.__CONFIG__?.API_URL || '';
}
