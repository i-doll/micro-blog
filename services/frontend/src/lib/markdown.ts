import { marked } from 'marked';
import DOMPurify from 'dompurify';

const PURIFY_CONFIG = {
  ALLOWED_TAGS: [
    'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
    'p', 'a', 'strong', 'em', 'code', 'pre',
    'blockquote', 'ul', 'ol', 'li', 'hr', 'img', 'br', 'video',
  ],
  ALLOWED_ATTR: ['href', 'target', 'rel', 'src', 'alt', 'controls', 'preload'],
  ALLOW_DATA_ATTR: false,
};

// Configure marked
marked.setOptions({
  gfm: true,
  breaks: false,
});

// Custom renderer: handle video:alt images as <video> tags
const renderer = new marked.Renderer();

renderer.image = ({ href, text }) => {
  const safeSrc = (href || '').replace(/["']/g, '');
  if (!/^https?:\/\//.test(safeSrc) && !safeSrc.startsWith('/')) {
    return '';
  }
  if (text && text.startsWith('video:')) {
    return `<video src="${safeSrc}" controls preload="metadata"></video>`;
  }
  const safeAlt = (text || '').replace(/["']/g, '');
  return `<img src="${safeSrc}" alt="${safeAlt}">`;
};

renderer.link = ({ href, text }) => {
  const safeUrl = (href || '').replace(/["']/g, '');
  if (
    /^https?:\/\//.test(safeUrl) ||
    safeUrl.startsWith('/') ||
    safeUrl.startsWith('#') ||
    safeUrl.startsWith('mailto:')
  ) {
    return `<a href="${safeUrl}" target="_blank" rel="noopener">${text}</a>`;
  }
  return text || '';
};

marked.use({ renderer });

export function renderMarkdown(text: string): string {
  if (!text) return '';
  const html = marked.parse(text, { async: false }) as string;
  return DOMPurify.sanitize(html, PURIFY_CONFIG);
}
