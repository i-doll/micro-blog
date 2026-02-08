import React, { useCallback, useState, useRef, useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import * as stylex from '@stylexjs/stylex';
import { colors, fonts, radii } from '../theme/tokens.stylex';
import { useViewTransitionNavigate } from '../hooks/useViewTransitionNavigate';
import { useAuth } from '../hooks/useAuth';
import { queryKeys } from '../lib/queryKeys';
import * as postsApi from '../api/posts';
import { Container } from '../components/layout/Container';
import { SectionRule } from '../components/ui/SectionRule';
import { Button } from '../components/ui/Button';
import { Tag } from '../components/ui/Tag';
import { Skeleton } from '../components/ui/Skeleton';
import { EmptyState } from '../components/ui/EmptyState';
import { useSearchQuery } from '../hooks/queries';

const styles = stylex.create({
  pageTitle: {
    fontFamily: fonts.display,
    fontSize: 'clamp(2rem, 5vw, 3.5rem)',
    fontWeight: 900,
    letterSpacing: '-0.03em',
    lineHeight: 1.1,
    marginBottom: '0.5rem',
    color: colors.textPrimary,
  },
  pageSubtitle: {
    fontFamily: fonts.body,
    fontSize: '1.125rem',
    color: colors.textSecondary,
    fontStyle: 'italic',
    marginBottom: '2rem',
  },
  searchBar: {
    display: 'flex',
    gap: '0.5rem',
    marginBottom: '2rem',
  },
  searchInput: {
    flex: 1,
    fontFamily: fonts.sans,
    fontSize: '0.9375rem',
    border: `1px solid ${colors.border}`,
    background: colors.bgInput,
    color: colors.textPrimary,
    padding: '0.625rem 0.875rem',
    borderRadius: radii.sm,
    outline: 'none',
    width: '100%',
  },
  postCard: {
    padding: '1.5rem 0',
    borderBottom: `1px solid ${colors.ruleLight}`,
    cursor: 'pointer',
    transition: 'background 0.2s',
  },
  postCardMeta: {
    fontFamily: fonts.sans,
    fontSize: '0.75rem',
    textTransform: 'uppercase',
    letterSpacing: '0.06em',
    color: colors.textMuted,
    marginBottom: '0.375rem',
  },
  postCardTitle: {
    fontFamily: fonts.display,
    fontSize: 'clamp(1.25rem, 2.5vw, 1.75rem)',
    fontWeight: 700,
    lineHeight: 1.25,
    color: colors.textPrimary,
  },
  postCardTags: {
    display: 'flex',
    gap: '0.375rem',
    marginTop: '0.75rem',
    flexWrap: 'wrap',
  },
});

interface SearchResultCardProps {
  result: { post_id: string; title: string; score?: number; tags?: string[] | string };
}

function SearchResultCard({ result }: SearchResultCardProps) {
  const navigate = useViewTransitionNavigate();
  const queryClient = useQueryClient();
  const { token } = useAuth();
  const titleRef = useRef<HTMLHeadingElement>(null);
  const href = `/post/${result.post_id}`;

  const prefetch = useCallback(() => {
    queryClient.prefetchQuery({
      queryKey: queryKeys.posts.detail(result.post_id),
      queryFn: () => postsApi.getPost(result.post_id, token),
      staleTime: 30_000,
    });
  }, [queryClient, result.post_id, token]);

  const tags = Array.isArray(result.tags)
    ? result.tags
    : typeof result.tags === 'string'
      ? result.tags.split(',').map((s) => s.trim()).filter(Boolean)
      : [];

  return (
    <div
      {...stylex.props(styles.postCard)}
      onMouseEnter={prefetch}
      onClick={() => {
        if (titleRef.current) {
          titleRef.current.style.viewTransitionName = 'post-title';
        }
        navigate(href);
      }}
    >
      <div {...stylex.props(styles.postCardMeta)}>
        Score: {(result.score || 0).toFixed(2)}
      </div>
      <h2 ref={titleRef} {...stylex.props(styles.postCardTitle)}>
        {result.title}
      </h2>
      {tags.length > 0 && (
        <div {...stylex.props(styles.postCardTags)}>
          {tags.map((t) => (
            <Tag key={t}>{t}</Tag>
          ))}
        </div>
      )}
    </div>
  );
}

export function SearchPage() {
  const [query, setQuery] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const { data, isLoading } = useSearchQuery(searchTerm);
  const results = data?.results ?? null;

  const doSearch = () => {
    const q = query.trim();
    if (!q) return;
    setSearchTerm(q);
  };

  return (
    <Container variant="narrow">
      <h1 {...stylex.props(styles.pageTitle)}>Search</h1>
      <p {...stylex.props(styles.pageSubtitle)}>Find stories across the archive</p>
      <SectionRule />

      <div {...stylex.props(styles.searchBar)}>
        <input
          ref={inputRef}
          {...stylex.props(styles.searchInput)}
          type="text"
          placeholder="Search for posts..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && doSearch()}
        />
        <Button variant="primary" onClick={doSearch}>
          Search
        </Button>
      </div>

      {isLoading ? (
        <>
          <Skeleton />
          <Skeleton />
        </>
      ) : results !== null && results.length === 0 ? (
        <EmptyState
          title="No results"
          text={`No posts matched "${searchTerm}"`}
        />
      ) : results !== null ? (
        results.map((r) => (
          <SearchResultCard key={r.post_id} result={r} />
        ))
      ) : null}
    </Container>
  );
}
