import React, { useState } from 'react';
import { useParams } from 'react-router';
import * as stylex from '@stylexjs/stylex';
import { colors, fonts } from '../theme/tokens.stylex';
import { useViewTransitionNavigate } from '../hooks/useViewTransitionNavigate';
import { Container } from '../components/layout/Container';
import { SectionRule } from '../components/ui/SectionRule';
import { Button } from '../components/ui/Button';
import { Tag } from '../components/ui/Tag';
import { Skeleton } from '../components/ui/Skeleton';
import { EmptyState } from '../components/ui/EmptyState';
import { useAuth } from '../hooks/useAuth';
import { useToast } from '../hooks/useToast';
import {
  usePostQuery,
  usePostCommentsQuery,
  useUsernameQueries,
  useCreateCommentMutation,
  useDeleteCommentMutation,
  useDeletePostMutation,
} from '../hooks/queries';
import { renderMarkdown } from '../lib/markdown';
import { timeAgo } from '../lib/timeAgo';
import type { Comment } from '../types';

const styles = stylex.create({
  postHeader: {
    marginBottom: '2rem',
    paddingBottom: '1.5rem',
    borderBottom: `1px solid ${colors.ruleLight}`,
  },
  postTitle: {
    fontFamily: fonts.display,
    fontSize: 'clamp(2rem, 5vw, 3rem)',
    fontWeight: 900,
    lineHeight: 1.15,
    letterSpacing: '-0.02em',
    marginBottom: '1rem',
    color: colors.textPrimary,
  },
  postMeta: {
    fontFamily: fonts.sans,
    fontSize: '0.8125rem',
    color: colors.textMuted,
    display: 'flex',
    alignItems: 'center',
    gap: '1rem',
    flexWrap: 'wrap',
  },
  dot: { color: colors.borderHeavy },
  tags: {
    display: 'flex',
    gap: '0.375rem',
    marginTop: '0.5rem',
    flexWrap: 'wrap',
  },
  postActions: {
    display: 'flex',
    gap: '0.5rem',
    marginTop: '1rem',
  },
  commentsSection: {
    marginTop: '3rem',
    paddingTop: '2rem',
    borderTop: `2px solid ${colors.ruleColor}`,
  },
  commentsTitle: {
    fontFamily: fonts.display,
    fontSize: '1.5rem',
    fontWeight: 700,
    marginBottom: '1.5rem',
    color: colors.textPrimary,
  },
  commentForm: {
    marginBottom: '2rem',
  },
  commentTextarea: {
    fontFamily: fonts.body,
    marginBottom: '0.75rem',
    minHeight: '80px',
    width: '100%',
    padding: '0.625rem 0.875rem',
    border: `1px solid ${colors.border}`,
    borderRadius: '4px',
    background: colors.bgInput,
    color: colors.textPrimary,
    fontSize: '0.9375rem',
    lineHeight: 1.6,
    resize: 'vertical',
    outline: 'none',
  },
  commentFormFooter: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  replyIndicator: {
    fontFamily: fonts.sans,
    fontSize: '0.8125rem',
    color: colors.textMuted,
  },
  comment: {
    padding: '1rem 0',
    borderBottom: `1px solid ${colors.ruleLight}`,
  },
  commentReply: {
    marginLeft: '2rem',
    paddingLeft: '1rem',
    borderLeft: `2px solid ${colors.borderLight}`,
  },
  commentHeader: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.5rem',
    marginBottom: '0.375rem',
  },
  commentAuthor: {
    fontFamily: fonts.sans,
    fontWeight: 700,
    fontSize: '0.875rem',
    color: colors.textPrimary,
  },
  commentDate: {
    fontFamily: fonts.sans,
    fontSize: '0.75rem',
    color: colors.textMuted,
  },
  commentBody: {
    fontSize: '0.9375rem',
    lineHeight: 1.6,
    color: colors.textSecondary,
    whiteSpace: 'pre-line',
    wordBreak: 'break-word',
  },
  commentActions: {
    marginTop: '0.375rem',
  },
  commentActionBtn: {
    fontSize: '0.75rem',
    color: colors.textMuted,
    padding: '0.15rem 0',
    background: 'none',
    border: 'none',
    cursor: 'pointer',
    fontFamily: fonts.sans,
    ':hover': {
      color: colors.accent,
    },
  },
  noComments: {
    fontFamily: fonts.sans,
    fontSize: '0.875rem',
    color: colors.textMuted,
    marginTop: '1rem',
  },
});

export function PostPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useViewTransitionNavigate();
  const { user, token } = useAuth();
  const { toast } = useToast();
  const [commentText, setCommentText] = useState('');
  const [replyTo, setReplyTo] = useState<{ id: string; author: string } | null>(null);

  const { data: post, isLoading: postLoading } = usePostQuery(id);
  const { data: commentsData } = usePostCommentsQuery(id);
  const comments = commentsData?.comments || [];

  const allAuthorIds = [
    ...(post ? [post.author_id] : []),
    ...comments.map((c) => c.author_id),
  ];
  const { getUsername } = useUsernameQueries(allAuthorIds);

  const createComment = useCreateCommentMutation();
  const deleteComment = useDeleteCommentMutation();
  const deletePost = useDeletePostMutation();

  const handleSubmitComment = async () => {
    const content = commentText.trim();
    if (!content || !post) return;

    try {
      await createComment.mutateAsync({
        post_id: post.id,
        content,
        parent_id: replyTo?.id || null,
      });
      setCommentText('');
      setReplyTo(null);
      toast('Comment posted', 'success');
    } catch (err: any) {
      toast(err.message, 'error');
    }
  };

  const handleDeleteComment = async (commentId: string) => {
    try {
      await deleteComment.mutateAsync(commentId);
      toast('Comment deleted', 'info');
    } catch (err: any) {
      toast(err.message, 'error');
    }
  };

  const handleDeletePost = async () => {
    if (!post || !confirm('Are you sure you want to delete this story?')) return;
    try {
      await deletePost.mutateAsync(post.id);
      toast('Story deleted', 'info');
      navigate('/');
    } catch (err: any) {
      toast(err.message, 'error');
    }
  };

  // Build threaded comments
  const topLevel = comments.filter((c) => !c.parent_id);
  const replyMap = new Map<string, Comment[]>();
  comments.filter((c) => c.parent_id).forEach((r) => {
    const arr = replyMap.get(r.parent_id!) || [];
    arr.push(r);
    replyMap.set(r.parent_id!, arr);
  });

  const isOwner =
    user &&
    post &&
    ((user.role === 'writer' && user.id === post.author_id) || user.role === 'admin');

  function renderComment(comment: Comment): React.ReactNode {
    const canDelete =
      user && (user.id === comment.author_id || user.role === 'admin');
    const childReplies = replyMap.get(comment.id) || [];

    return (
      <div key={comment.id} {...stylex.props(styles.comment)}>
        <div {...stylex.props(styles.commentHeader)}>
          <span {...stylex.props(styles.commentAuthor)}>
            {getUsername(comment.author_id)}
          </span>
          <span {...stylex.props(styles.commentDate)}>
            {timeAgo(comment.created_at)}
          </span>
        </div>
        <div {...stylex.props(styles.commentBody)}>{comment.content}</div>
        <div {...stylex.props(styles.commentActions)}>
          {user && (
            <button
              {...stylex.props(styles.commentActionBtn)}
              onClick={() =>
                setReplyTo({
                  id: comment.id,
                  author: getUsername(comment.author_id),
                })
              }
            >
              Reply
            </button>
          )}
          {canDelete && (
            <button
              {...stylex.props(styles.commentActionBtn)}
              onClick={() => handleDeleteComment(comment.id)}
              style={{ marginLeft: '0.5rem' }}
            >
              Delete
            </button>
          )}
        </div>
        {childReplies.map((r) => (
          <div key={r.id} {...stylex.props(styles.commentReply)}>
            {renderComment(r)}
          </div>
        ))}
      </div>
    );
  }

  return (
    <Container variant="narrow">
      <Button variant="ghost" onClick={() => navigate('/')} style={{ marginBottom: '1rem' }}>
        &larr; Back to stories
      </Button>

      {postLoading ? (
        <>
          <Skeleton variant="title" />
          <Skeleton />
          <Skeleton />
          <Skeleton last />
        </>
      ) : !post ? (
        <EmptyState text="Post not found." />
      ) : (
        <>
          <article>
            <div {...stylex.props(styles.postHeader)}>
              <h1 {...stylex.props(styles.postTitle)} style={{ viewTransitionName: 'post-title' }}>{post.title}</h1>
              <div {...stylex.props(styles.postMeta)}>
                <span>{getUsername(post.author_id)}</span>
                <span {...stylex.props(styles.dot)}>&middot;</span>
                <span>
                  {new Date(
                    post.published_at || post.created_at,
                  ).toLocaleDateString('en-US', {
                    weekday: 'long',
                    month: 'long',
                    day: 'numeric',
                    year: 'numeric',
                  })}
                </span>
                {post.status !== 'published' && (
                  <Tag>{post.status}</Tag>
                )}
              </div>
              {post.tags && post.tags.length > 0 && (
                <div {...stylex.props(styles.tags)}>
                  {post.tags.map((t) => (
                    <Tag key={t}>{t}</Tag>
                  ))}
                </div>
              )}
              {isOwner && (
                <div {...stylex.props(styles.postActions)}>
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => navigate(`/edit/${post.id}`)}
                  >
                    Edit
                  </Button>
                  <Button variant="danger" size="sm" onClick={handleDeletePost}>
                    Delete
                  </Button>
                </div>
              )}
            </div>
            <div
              className="post-content"
              dangerouslySetInnerHTML={{
                __html: renderMarkdown(post.content || ''),
              }}
            />
          </article>

          <section {...stylex.props(styles.commentsSection)}>
            <h2 {...stylex.props(styles.commentsTitle)}>
              Comments ({comments.length})
            </h2>

            {user && (
              <div {...stylex.props(styles.commentForm)}>
                <textarea
                  {...stylex.props(styles.commentTextarea)}
                  value={commentText}
                  onChange={(e) => setCommentText(e.target.value)}
                  placeholder="Share your thoughts..."
                />
                <div {...stylex.props(styles.commentFormFooter)}>
                  {replyTo && (
                    <span {...stylex.props(styles.replyIndicator)}>
                      Replying to {replyTo.author}{' '}
                      <button
                        {...stylex.props(styles.commentActionBtn)}
                        onClick={() => setReplyTo(null)}
                      >
                        (cancel)
                      </button>
                    </span>
                  )}
                  {!replyTo && <span />}
                  <Button variant="primary" onClick={handleSubmitComment}>
                    Post Comment
                  </Button>
                </div>
              </div>
            )}

            {comments.length === 0 ? (
              <p {...stylex.props(styles.noComments)}>
                No comments yet. Be the first to share your thoughts.
              </p>
            ) : (
              topLevel.map(renderComment)
            )}
          </section>
        </>
      )}
    </Container>
  );
}
