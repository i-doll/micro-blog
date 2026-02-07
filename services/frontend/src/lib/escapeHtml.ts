const escapeMap: Record<string, string> = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;',
};

export function escapeHtml(str: string): string {
  if (!str) return '';
  return str.replace(/[&<>"']/g, (ch) => escapeMap[ch]);
}
