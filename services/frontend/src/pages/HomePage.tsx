import React, { useCallback, useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import * as stylex from '@stylexjs/stylex';
import { colors, fonts } from '../theme/tokens.stylex';
import { useViewTransitionNavigate } from '../hooks/useViewTransitionNavigate';
import { Container } from '../components/layout/Container';
import { SectionRule } from '../components/ui/SectionRule';
import { Tag } from '../components/ui/Tag';
import { Skeleton } from '../components/ui/Skeleton';
import { EmptyState } from '../components/ui/EmptyState';
import { Pagination } from '../components/ui/Pagination';
import { usePostsQuery, useUsernameQueries } from '../hooks/queries';
import { useAuth } from '../hooks/useAuth';
import { queryKeys } from '../lib/queryKeys';
import * as postsApi from '../api/posts';
import { renderExcerptHtml } from '../lib/renderExcerpt';

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
  postGrid: {
    display: 'grid',
    gridTemplateColumns: '1fr',
    gap: 0,
  },
  postCard: {
    padding: '1.5rem 0',
    borderBottom: `1px solid ${colors.ruleLight}`,
    cursor: 'pointer',
    transition: 'background 0.2s',
  },
  postCardFeatured: {
    padding: '2rem 0',
    borderBottom: `2px solid ${colors.ruleColor}`,
  },
  postCardMeta: {
    fontFamily: fonts.sans,
    fontSize: '0.75rem',
    textTransform: 'uppercase',
    letterSpacing: '0.06em',
    color: colors.textMuted,
    marginBottom: '0.375rem',
    display: 'flex',
    alignItems: 'center',
    gap: '0.5rem',
  },
  postCardTitle: {
    fontFamily: fonts.display,
    fontSize: 'clamp(1.25rem, 2.5vw, 1.75rem)',
    fontWeight: 700,
    lineHeight: 1.25,
    marginBottom: '0.5rem',
    color: colors.textPrimary,
  },
  postCardTitleFeatured: {
    fontSize: 'clamp(1.75rem, 4vw, 2.75rem)',
    fontWeight: 900,
  },
  postCardExcerpt: {
    fontSize: '0.9375rem',
    color: colors.textSecondary,
    lineHeight: 1.6,
    display: '-webkit-box',
    WebkitLineClamp: 3,
    WebkitBoxOrient: 'vertical',
    overflow: 'hidden',
  },
  postCardExcerptFeatured: {
    fontSize: '1.0625rem',
    WebkitLineClamp: 5,
  },
  postCardTags: {
    display: 'flex',
    gap: '0.375rem',
    marginTop: '0.75rem',
    flexWrap: 'wrap',
  },
});

interface PostCardProps {
  post: { id: string; title: string; content?: string; author_id: string; status: string; tags?: string[]; published_at?: string; created_at: string };
  featured: boolean;
  getUsername: (id: string) => string;
}

function PostCard({ post, featured, getUsername }: PostCardProps) {
  const navigate = useViewTransitionNavigate();
  const queryClient = useQueryClient();
  const { token } = useAuth();
  const titleRef = useRef<HTMLHeadingElement>(null);
  const href = `/post/${post.id}`;

  const prefetch = useCallback(() => {
    queryClient.prefetchQuery({
      queryKey: queryKeys.posts.detail(post.id),
      queryFn: () => postsApi.getPost(post.id, token),
      staleTime: 30_000,
    });
  }, [queryClient, post.id, token]);

  const date = new Date(
    post.published_at || post.created_at,
  ).toLocaleDateString('en-US', {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  });

  return (
    <div
      {...stylex.props(
        styles.postCard,
        featured && styles.postCardFeatured,
      )}
      onMouseEnter={prefetch}
      onClick={() => {
        if (titleRef.current) {
          titleRef.current.style.viewTransitionName = 'post-title';
        }
        navigate(href);
      }}
    >
      <div {...stylex.props(styles.postCardMeta)}>
        <span>{getUsername(post.author_id)}</span>
        <span>&middot;</span>
        <span>{date}</span>
        {post.status === 'draft' && (
          <span
            style={{
              background: 'var(--x-warning, #d4a017)',
              color: '#000',
              fontSize: '0.6875rem',
              padding: '0.2rem 0.5rem',
              borderRadius: '2px',
            }}
          >
            Draft
          </span>
        )}
      </div>
      <h2
        ref={titleRef}
        {...stylex.props(
          styles.postCardTitle,
          featured && styles.postCardTitleFeatured,
        )}
      >
        {post.title}
      </h2>
      <div
        {...stylex.props(
          styles.postCardExcerpt,
          featured && styles.postCardExcerptFeatured,
        )}
        dangerouslySetInnerHTML={{
          __html: renderExcerptHtml(post.content || ''),
        }}
      />
      {post.tags && post.tags.length > 0 && (
        <div {...stylex.props(styles.postCardTags)}>
          {post.tags.map((t) => (
            <Tag key={t}>{t}</Tag>
          ))}
        </div>
      )}
    </div>
  );
}

export function HomePage() {
  const [page, setPage] = useState(1);
  const limit = 20;

  const { data, isLoading } = usePostsQuery({ page, limit });
  const posts = data?.posts || [];
  const total = data?.total || 0;

  const { getUsername } = useUsernameQueries(posts.map((p) => p.author_id));

  const totalPages = Math.ceil(total / limit);

  return (
    <Container variant="narrow">
      <h1 {...stylex.props(styles.pageTitle)}>Latest Stories</h1>
      <p {...stylex.props(styles.pageSubtitle)}>Ideas, essays, and explorations</p>
      <SectionRule />

      {isLoading ? (
        <div>
          <Skeleton variant="title" />
          <Skeleton />
          <Skeleton />
          <Skeleton last />
        </div>
      ) : posts.length === 0 ? (
        <EmptyState
          icon={"\u270D"}
          title="No stories yet"
          text="Be the first to write something."
        />
      ) : (
        <div {...stylex.props(styles.postGrid)}>
          {posts.map((post, i) => (
            <PostCard
              key={post.id}
              post={post}
              featured={i === 0 && page === 1}
              getUsername={getUsername}
            />
          ))}
        </div>
      )}

      <Pagination
        page={page}
        totalPages={totalPages}
        onPageChange={setPage}
      />
    </Container>
  );
}
