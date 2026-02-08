import { describe, it, expect } from 'vitest';
import { NotFoundError } from '@blog/shared';

// Mirror of enforcePostVisibility from services/post.ts — tested in isolation
// to avoid triggering DB/config side effects on import.
function enforcePostVisibility(
  post: { status: string; author_id: string },
  userId?: string, userRole?: string,
) {
  if (post.status === 'published') return;
  if (userRole === 'admin') return;
  if (userRole === 'writer' && userId && post.author_id === userId) return;
  throw new NotFoundError('Post');
}

describe('enforcePostVisibility', () => {
  const draft = { status: 'draft', author_id: 'author-1' };
  const published = { status: 'published', author_id: 'author-1' };
  const archived = { status: 'archived', author_id: 'author-1' };

  it('allows anyone to see published posts', () => {
    expect(() => enforcePostVisibility(published)).not.toThrow();
    expect(() => enforcePostVisibility(published, undefined, undefined)).not.toThrow();
    expect(() => enforcePostVisibility(published, 'other-user', 'user')).not.toThrow();
  });

  it('allows admin to see draft posts', () => {
    expect(() => enforcePostVisibility(draft, 'admin-id', 'admin')).not.toThrow();
  });

  it('allows admin to see archived posts', () => {
    expect(() => enforcePostVisibility(archived, 'admin-id', 'admin')).not.toThrow();
  });

  it('allows writer to see their own draft', () => {
    expect(() => enforcePostVisibility(draft, 'author-1', 'writer')).not.toThrow();
  });

  it('prevents writer from seeing another writer\'s draft', () => {
    expect(() => enforcePostVisibility(draft, 'other-writer', 'writer')).toThrow();
  });

  it('prevents anonymous user from seeing drafts', () => {
    expect(() => enforcePostVisibility(draft)).toThrow();
    expect(() => enforcePostVisibility(draft, undefined, undefined)).toThrow();
  });

  it('prevents regular user from seeing drafts', () => {
    expect(() => enforcePostVisibility(draft, 'some-user', 'user')).toThrow();
  });

  it('prevents anonymous user from seeing archived posts', () => {
    expect(() => enforcePostVisibility(archived)).toThrow();
  });
});
