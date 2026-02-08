import React, { useState } from 'react';
import * as stylex from '@stylexjs/stylex';
import { colors, fonts } from '../../theme/tokens.stylex';
import { useViewTransitionNavigate } from '../../hooks/useViewTransitionNavigate';
import { Button } from '../../components/ui/Button';
import { Pagination } from '../../components/ui/Pagination';
import { Skeleton } from '../../components/ui/Skeleton';
import { EmptyState } from '../../components/ui/EmptyState';
import { XIcon } from '../../components/icons';
import { useAuth } from '../../hooks/useAuth';
import { useToast } from '../../hooks/useToast';
import { timeAgo } from '../../lib/timeAgo';
import {
  useCommentsQuery,
  usePostsQuery,
  usePostQuery,
  useUsernameQueries,
  useCreateCommentMutation,
  useDeleteCommentMutation,
} from '../../hooks/queries';

const tableStyles = stylex.create({
  wrap: { overflowX: 'auto', scrollbarWidth: 'thin' },
  table: {
    width: '100%', borderCollapse: 'separate', borderSpacing: 0,
    fontFamily: fonts.sans, fontSize: '0.8125rem', tableLayout: 'fixed', minWidth: '640px',
  },
  th: {
    textAlign: 'left', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em',
    color: colors.textMuted, padding: '0 0.625rem 0.5rem', borderBottom: `1px solid ${colors.borderHeavy}`,
    fontSize: '0.625rem', whiteSpace: 'nowrap',
  },
  td: {
    padding: '0.5rem 0.625rem', borderBottom: `1px solid ${colors.borderLight}`, color: colors.textPrimary,
    verticalAlign: 'middle', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
  },
  cellWrap: {
    whiteSpace: 'pre-line',
    overflow: 'visible',
    textOverflow: 'unset',
    lineHeight: 1.45,
    maxHeight: '4.35em',
    overflowY: 'hidden',
  },
  actions: { whiteSpace: 'nowrap', overflow: 'visible', display: 'flex', alignItems: 'center', gap: '0.25rem' },
  link: { color: colors.accent, fontWeight: 500, textDecoration: 'none', cursor: 'pointer' },
  replyCell: {
    padding: '0.625rem 0.75rem 0.75rem',
    background: colors.bgSecondary,
    borderBottom: `1px solid ${colors.border}`,
    whiteSpace: 'normal',
  },
  replyTextarea: {
    width: '100%', minHeight: '56px', marginBottom: '0.4rem',
    padding: '0.5rem 0.625rem', border: `1px solid ${colors.border}`,
    borderRadius: '4px', fontFamily: fonts.body, fontSize: '0.8125rem',
    background: colors.bgInput, color: colors.textPrimary, resize: 'vertical', lineHeight: 1.5,
    outline: 'none',
  },
  replyActions: { display: 'flex', gap: '0.375rem', justifyContent: 'flex-end' },
});

function PostTitleCell({ postId }: { postId: string }) {
  const navigate = useViewTransitionNavigate();
  const { data: post } = usePostQuery(postId);
  const title = post?.title || 'Unknown Post';

  return (
    <a {...stylex.props(tableStyles.link)} onClick={() => navigate(`/post/${postId}`)}>
      {title}
    </a>
  );
}

export function AdminCommentsTab() {
  const navigate = useViewTransitionNavigate();
  const { user, token } = useAuth();
  const { toast } = useToast();
  const [page, setPage] = useState(1);
  const [replyOpen, setReplyOpen] = useState<string | null>(null);
  const [replyText, setReplyText] = useState('');

  // For writers, first fetch their posts to get post_ids filter
  const isWriter = user?.role === 'writer';
  const { data: writerPostsData } = usePostsQuery(
    isWriter ? { author_id: user!.id, limit: 100 } : { limit: 0 },
  );
  const writerPostIds = isWriter ? (writerPostsData?.posts || []).map((p) => p.id) : [];

  const commentsParams = isWriter
    ? { post_ids: writerPostIds.join(','), page, limit: 20 }
    : { page, limit: 20 };

  const shouldFetchComments = !isWriter || writerPostIds.length > 0;
  const { data: commentsData, isLoading } = useCommentsQuery(
    shouldFetchComments ? commentsParams : { limit: 0 },
  );

  const comments = shouldFetchComments ? (commentsData?.comments || []) : [];
  const total = shouldFetchComments ? (commentsData?.total || 0) : 0;

  const { getUsername } = useUsernameQueries(comments.map((c) => c.author_id));

  const createComment = useCreateCommentMutation();
  const deleteComment = useDeleteCommentMutation();

  const handleDelete = async (commentId: string) => {
    if (!confirm('Are you sure you want to delete this comment?')) return;
    try {
      await deleteComment.mutateAsync(commentId);
      toast('Comment deleted', 'info');
    } catch (err: any) { toast(err.message, 'error'); }
  };

  const handleReply = async (commentId: string, postId: string) => {
    const content = replyText.trim();
    if (!content) { toast('Reply cannot be empty', 'error'); return; }
    try {
      await createComment.mutateAsync({ post_id: postId, content, parent_id: commentId });
      toast('Reply posted', 'success');
      setReplyOpen(null);
      setReplyText('');
    } catch (err: any) { toast(err.message, 'error'); }
  };

  if (isLoading || (isWriter && !writerPostsData)) return <Skeleton />;
  if (comments.length === 0) return <EmptyState text="No comments found." />;

  const isAdmin = user?.role === 'admin';

  return (
    <>
      <div {...stylex.props(tableStyles.wrap)}>
        <table {...stylex.props(tableStyles.table)}>
          <colgroup>
            <col style={{ width: '34%' }} />
            <col style={{ width: '12%' }} />
            <col style={{ width: '18%' }} />
            <col style={{ width: '10%' }} />
            <col style={{ width: '26%' }} />
          </colgroup>
          <thead>
            <tr>
              <th {...stylex.props(tableStyles.th)}>Content</th>
              <th {...stylex.props(tableStyles.th)}>Author</th>
              <th {...stylex.props(tableStyles.th)}>Post</th>
              <th {...stylex.props(tableStyles.th)}>Date</th>
              <th {...stylex.props(tableStyles.th)}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {comments.map((c) => {
              const truncated = c.content.length > 200 ? c.content.slice(0, 200) + '...' : c.content;

              return (
                <React.Fragment key={c.id}>
                  <tr>
                    <td {...stylex.props(tableStyles.td, tableStyles.cellWrap)} title={c.content}>{truncated}</td>
                    <td {...stylex.props(tableStyles.td)}>{getUsername(c.author_id)}</td>
                    <td {...stylex.props(tableStyles.td)}>
                      <PostTitleCell postId={c.post_id} />
                    </td>
                    <td {...stylex.props(tableStyles.td)}>{timeAgo(c.created_at)}</td>
                    <td {...stylex.props(tableStyles.td)}>
                      <div {...stylex.props(tableStyles.actions)}>
                        <Button variant="secondary" size="sm" onClick={() => {
                          setReplyOpen(replyOpen === c.id ? null : c.id);
                          setReplyText('');
                        }}>
                          Reply
                        </Button>
                        {isAdmin && (
                          <Button variant="deleteIcon" onClick={() => handleDelete(c.id)} title="Delete comment">
                            <XIcon />
                          </Button>
                        )}
                      </div>
                    </td>
                  </tr>
                  {replyOpen === c.id && (
                    <tr>
                      <td colSpan={5} {...stylex.props(tableStyles.replyCell)}>
                        <textarea
                          {...stylex.props(tableStyles.replyTextarea)}
                          placeholder="Write a reply..."
                          value={replyText}
                          onChange={(e) => setReplyText(e.target.value)}
                        />
                        <div {...stylex.props(tableStyles.replyActions)}>
                          <Button variant="secondary" size="sm" onClick={() => setReplyOpen(null)}>Cancel</Button>
                          <Button variant="primary" size="sm" onClick={() => handleReply(c.id, c.post_id)}>Send Reply</Button>
                        </div>
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              );
            })}
          </tbody>
        </table>
      </div>
      <Pagination page={page} totalPages={Math.ceil(total / 20)} onPageChange={setPage} />
    </>
  );
}
