import React from 'react';
import { stripMarkdown } from './stripMarkdown';
import { escapeHtml } from './escapeHtml';

export function renderExcerptHtml(content: string): string {
  const parts = content.split(/(!\[[^\]]*\]\(\/api\/media\/[a-f0-9-]+\))/);
  let result = '';
  let textLen = 0;
  const maxText = 250;

  for (const part of parts) {
    const imgMatch = part.match(/!\[[^\]]*\]\((\/api\/media\/[a-f0-9-]+)\)/);
    if (imgMatch) {
      result += `<img class="post-card__thumb" src="${imgMatch[1]}" alt="" loading="lazy">`;
    } else {
      const remaining = maxText - textLen;
      if (remaining <= 0) continue;
      const stripped = stripMarkdown(part);
      const text = stripped.slice(0, remaining);
      result += escapeHtml(text);
      textLen += text.length;
    }
  }

  return result;
}

export function RenderExcerpt({ content }: { content: string }) {
  return <span dangerouslySetInnerHTML={{ __html: renderExcerptHtml(content) }} />;
}
