import React, { useState } from 'react';
import * as stylex from '@stylexjs/stylex';
import { colors, fonts } from '../../theme/tokens.stylex';
import { useViewTransitionNavigate } from '../../hooks/useViewTransitionNavigate';
import { Button } from '../../components/ui/Button';
import { Badge } from '../../components/ui/Badge';
import { Pagination } from '../../components/ui/Pagination';
import { Skeleton } from '../../components/ui/Skeleton';
import { EmptyState } from '../../components/ui/EmptyState';
import { XIcon } from '../../components/icons';
import { useToast } from '../../hooks/useToast';
import {
  usePostsQuery,
  useUsernameQueries,
  useUpdatePostMutation,
  useDeletePostMutation,
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
  actions: { whiteSpace: 'nowrap', overflow: 'visible', display: 'flex', alignItems: 'center', gap: '0.25rem' },
  link: { color: colors.textPrimary, fontWeight: 500, textDecoration: 'none', cursor: 'pointer' },
});

export function AdminPostsTab() {
  const navigate = useViewTransitionNavigate();
  const { toast } = useToast();
  const [page, setPage] = useState(1);

  const { data, isLoading } = usePostsQuery({ page, limit: 20 });
  const posts = data?.posts || [];
  const total = data?.total || 0;

  const { getUsername } = useUsernameQueries(posts.map((p) => p.author_id));

  const updatePost = useUpdatePostMutation();
  const deletePost = useDeletePostMutation();

  const handleDelete = async (postId: string) => {
    if (!confirm('Are you sure you want to delete this post?')) return;
    try {
      await deletePost.mutateAsync(postId);
      toast('Post deleted', 'info');
    } catch (err: any) { toast(err.message, 'error'); }
  };

  const handleStatusChange = async (postId: string, newStatus: string) => {
    try {
      await updatePost.mutateAsync({ id: postId, data: { status: newStatus } });
      toast(`Post ${newStatus}`, 'success');
    } catch (err: any) { toast(err.message, 'error'); }
  };

  if (isLoading) return <Skeleton />;
  if (posts.length === 0) return <EmptyState text="No posts found." />;

  return (
    <>
      <div {...stylex.props(tableStyles.wrap)}>
        <table {...stylex.props(tableStyles.table)}>
          <colgroup>
            <col style={{ width: '30%' }} />
            <col style={{ width: '16%' }} />
            <col style={{ width: '10%' }} />
            <col style={{ width: '14%' }} />
            <col style={{ width: '30%' }} />
          </colgroup>
          <thead>
            <tr>
              <th {...stylex.props(tableStyles.th)}>Title</th>
              <th {...stylex.props(tableStyles.th)}>Author</th>
              <th {...stylex.props(tableStyles.th)}>Status</th>
              <th {...stylex.props(tableStyles.th)}>Created</th>
              <th {...stylex.props(tableStyles.th)}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {posts.map((p) => {
              const date = new Date(p.created_at).toLocaleDateString('en-US', {
                month: 'short', day: 'numeric', year: 'numeric',
              });
              const statusVariant = p.status === 'published' ? 'published'
                : p.status === 'draft' ? 'draft' : 'archived';

              return (
                <tr key={p.id}>
                  <td {...stylex.props(tableStyles.td)} title={p.title}>
                    <a {...stylex.props(tableStyles.link)} onClick={() => navigate(`/post/${p.id}`)}>
                      {p.title}
                    </a>
                  </td>
                  <td {...stylex.props(tableStyles.td)}>{getUsername(p.author_id)}</td>
                  <td {...stylex.props(tableStyles.td)}><Badge variant={statusVariant}>{p.status}</Badge></td>
                  <td {...stylex.props(tableStyles.td)}>{date}</td>
                  <td {...stylex.props(tableStyles.td)}>
                    <div {...stylex.props(tableStyles.actions)}>
                      {p.status !== 'published' && (
                        <Button variant="secondary" size="sm" onClick={() => handleStatusChange(p.id, 'published')}>Publish</Button>
                      )}
                      {p.status !== 'archived' && (
                        <Button variant="secondary" size="sm" onClick={() => handleStatusChange(p.id, 'archived')}>Archive</Button>
                      )}
                      <Button variant="secondary" size="sm" onClick={() => navigate(`/edit/${p.id}`)}>Edit</Button>
                      <Button variant="deleteIcon" onClick={() => handleDelete(p.id)} title="Delete post">
                        <XIcon />
                      </Button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <Pagination page={page} totalPages={Math.ceil(total / 20)} onPageChange={setPage} />
    </>
  );
}
