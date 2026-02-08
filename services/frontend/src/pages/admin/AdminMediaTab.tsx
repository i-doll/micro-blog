import React, { useState, useCallback } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import * as stylex from '@stylexjs/stylex';
import { colors, fonts, radii } from '../../theme/tokens.stylex';
import { useViewTransitionNavigate } from '../../hooks/useViewTransitionNavigate';
import { Button } from '../../components/ui/Button';
import { Pagination } from '../../components/ui/Pagination';
import { Skeleton } from '../../components/ui/Skeleton';
import { EmptyState } from '../../components/ui/EmptyState';
import { useAuth } from '../../hooks/useAuth';
import { useToast } from '../../hooks/useToast';
import {
  useMediaQuery,
  useUsernameQueries,
  useDeleteMediaMutation,
} from '../../hooks/queries';
import { queryKeys } from '../../lib/queryKeys';
import { formatFileSize } from '../../lib/formatFileSize';
import * as postsApi from '../../api/posts';
import * as mediaApi from '../../api/media';
import type { Post } from '../../types';

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
  tdWrap: {
    whiteSpace: 'pre-line', overflow: 'visible', textOverflow: 'unset', lineHeight: 1.45,
  },
  orphanRow: {
    background: 'color-mix(in srgb, var(--error, #c0392b) 8%, transparent)',
  },
  preview: {
    width: '40px', height: '40px', objectFit: 'cover', borderRadius: radii.sm,
    background: colors.bgSecondary, display: 'block',
  },
  toolbar: {
    display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '1rem',
    fontFamily: fonts.sans, fontSize: '0.8125rem',
  },
  toolbarLabel: {
    display: 'flex', alignItems: 'center', gap: '0.375rem', cursor: 'pointer',
    color: colors.textSecondary,
  },
  checkbox: { width: 'auto', accentColor: colors.accent },
  link: { color: colors.accent, fontWeight: 500, textDecoration: 'none', cursor: 'pointer' },
  orphanLabel: { color: colors.textMuted },
  actions: { whiteSpace: 'nowrap', overflow: 'visible' },
});

function extractAllMediaIds(content: string): string[] {
  const ids: string[] = [];
  const regex = /\/api\/media\/([a-f0-9-]+)/g;
  let m;
  while ((m = regex.exec(content)) !== null) ids.push(m[1]);
  return ids;
}

export function AdminMediaTab() {
  const navigate = useViewTransitionNavigate();
  const { token } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [orphansOnly, setOrphansOnly] = useState(false);
  const [page, setPage] = useState(1);
  const perPage = 20;

  const fetchAllPosts = useCallback(async (): Promise<Post[]> => {
    const all: Post[] = [];
    let p = 1;
    while (true) {
      const data = await postsApi.getPosts({ page: p, limit: 100 }, token);
      const items = data.posts || [];
      if (items.length === 0) break;
      all.push(...items);
      if (all.length >= (data.total || items.length)) break;
      p++;
    }
    return all;
  }, [token]);

  const { data: mediaData, isLoading: mediaLoading } = useMediaQuery(true);
  const allMedia = mediaData?.media || [];

  const { data: allPosts, isLoading: postsLoading } = useQuery({
    queryKey: [...queryKeys.posts.all, 'admin-media-all'],
    queryFn: fetchAllPosts,
    enabled: !!token,
  });

  const { getUsername } = useUsernameQueries(allMedia.map((m) => m.user_id).filter(Boolean));
  const deleteMediaMutation = useDeleteMediaMutation();

  const loading = mediaLoading || postsLoading;

  // Build reference maps
  const postMap: Record<string, { postId: string; title: string }[]> = {};
  const referencedIds = new Set<string>();
  if (allPosts) {
    for (const post of allPosts) {
      const ids = extractAllMediaIds(post.content || '');
      for (const mid of ids) {
        referencedIds.add(mid);
        if (!postMap[mid]) postMap[mid] = [];
        postMap[mid].push({ postId: post.id, title: post.title });
      }
    }
  }

  const handleDelete = async (mediaId: string) => {
    if (!confirm('Delete this media file?')) return;
    try {
      await deleteMediaMutation.mutateAsync(mediaId);
      toast('Media deleted', 'info');
    } catch (err: any) { toast(err.message || 'Delete failed', 'error'); }
  };

  const handleDeleteAllOrphans = async () => {
    const orphans = allMedia.filter((m) => !referencedIds.has(m.id));
    if (orphans.length === 0) { toast('No orphans to delete', 'info'); return; }
    if (!confirm(`Delete ${orphans.length} orphaned media file${orphans.length > 1 ? 's' : ''}?`)) return;

    let deleted = 0;
    for (const m of orphans) {
      try {
        await mediaApi.deleteMedia(m.id, token!);
        deleted++;
      } catch (err: any) {
        toast(`Failed to delete ${m.original_name}: ${err.message}`, 'error');
      }
    }
    toast(`Deleted ${deleted} orphan${deleted !== 1 ? 's' : ''}`, 'success');
    queryClient.invalidateQueries({ queryKey: queryKeys.media.all });
  };

  if (loading) return <Skeleton />;

  const items = orphansOnly ? allMedia.filter((m) => !referencedIds.has(m.id)) : allMedia;
  const totalPages = Math.ceil(items.length / perPage);
  const currentPage = Math.min(page, totalPages || 1);
  const pageItems = items.slice((currentPage - 1) * perPage, currentPage * perPage);

  if (items.length === 0) {
    return (
      <>
        <div {...stylex.props(tableStyles.toolbar)}>
          <label {...stylex.props(tableStyles.toolbarLabel)}>
            <input
              type="checkbox"
              checked={orphansOnly}
              onChange={(e) => setOrphansOnly(e.target.checked)}
              {...stylex.props(tableStyles.checkbox)}
            />
            Show orphans only
          </label>
          <Button variant="danger" size="sm" onClick={handleDeleteAllOrphans}>Delete All Orphans</Button>
        </div>
        <EmptyState text="No media found." />
      </>
    );
  }

  return (
    <>
      <div {...stylex.props(tableStyles.toolbar)}>
        <label {...stylex.props(tableStyles.toolbarLabel)}>
          <input
            type="checkbox"
            checked={orphansOnly}
            onChange={(e) => { setOrphansOnly(e.target.checked); setPage(1); }}
            {...stylex.props(tableStyles.checkbox)}
          />
          Show orphans only
        </label>
        <Button variant="danger" size="sm" onClick={handleDeleteAllOrphans}>Delete All Orphans</Button>
      </div>

      <div {...stylex.props(tableStyles.wrap)}>
        <table {...stylex.props(tableStyles.table)}>
          <colgroup>
            <col style={{ width: '50px' }} />
            <col style={{ width: '20%' }} />
            <col style={{ width: '12%' }} />
            <col style={{ width: '10%' }} />
            <col style={{ width: '8%' }} />
            <col style={{ width: '12%' }} />
            <col style={{ width: '20%' }} />
            <col style={{ width: '8%' }} />
          </colgroup>
          <thead>
            <tr>
              <th {...stylex.props(tableStyles.th)}></th>
              <th {...stylex.props(tableStyles.th)}>Filename</th>
              <th {...stylex.props(tableStyles.th)}>Owner</th>
              <th {...stylex.props(tableStyles.th)}>Type</th>
              <th {...stylex.props(tableStyles.th)}>Size</th>
              <th {...stylex.props(tableStyles.th)}>Uploaded</th>
              <th {...stylex.props(tableStyles.th)}>Referenced In</th>
              <th {...stylex.props(tableStyles.th)}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {pageItems.map((m) => {
              const isOrphan = !referencedIds.has(m.id);
              const isVideo = m.content_type?.startsWith('video/');
              const refs = postMap[m.id] || [];
              const date = new Date(m.created_at).toLocaleDateString('en-US', {
                month: 'short', day: 'numeric', year: 'numeric',
              });

              return (
                <tr key={m.id} style={isOrphan ? { background: 'color-mix(in srgb, var(--error, #c0392b) 8%, transparent)' } : undefined}>
                  <td {...stylex.props(tableStyles.td)}>
                    {isVideo ? (
                      <video src={`/api/media/${m.id}`} muted {...stylex.props(tableStyles.preview)} />
                    ) : (
                      <img src={`/api/media/${m.id}`} alt="" loading="lazy" {...stylex.props(tableStyles.preview)} />
                    )}
                  </td>
                  <td {...stylex.props(tableStyles.td)} title={m.original_name}>{m.original_name}</td>
                  <td {...stylex.props(tableStyles.td)}>{getUsername(m.user_id)}</td>
                  <td {...stylex.props(tableStyles.td)}>{m.content_type}</td>
                  <td {...stylex.props(tableStyles.td)}>{formatFileSize(m.size)}</td>
                  <td {...stylex.props(tableStyles.td)}>{date}</td>
                  <td {...stylex.props(tableStyles.td, tableStyles.tdWrap)}>
                    {refs.length > 0 ? refs.map((r, i) => (
                      <React.Fragment key={r.postId}>
                        {i > 0 && ', '}
                        <a {...stylex.props(tableStyles.link)} onClick={(e) => { e.stopPropagation(); navigate(`/post/${r.postId}`); }}>
                          {r.title}
                        </a>
                      </React.Fragment>
                    )) : (
                      <span {...stylex.props(tableStyles.orphanLabel)}>None (orphan)</span>
                    )}
                  </td>
                  <td {...stylex.props(tableStyles.td, tableStyles.actions)}>
                    <Button variant="danger" size="sm" onClick={() => handleDelete(m.id)}>Delete</Button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <Pagination page={currentPage} totalPages={totalPages} onPageChange={setPage} />
    </>
  );
}
