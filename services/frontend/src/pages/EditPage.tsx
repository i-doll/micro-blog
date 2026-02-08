import React, { useState, useRef, useCallback, useEffect } from 'react';
import { useParams } from 'react-router';
import * as stylex from '@stylexjs/stylex';
import { colors, fonts, radii } from '../theme/tokens.stylex';
import { useViewTransitionNavigate } from '../hooks/useViewTransitionNavigate';
import { SectionRule } from '../components/ui/SectionRule';
import { Button } from '../components/ui/Button';
import { FormGroup } from '../components/ui/FormGroup';
import { MediaGrid } from '../components/ui/MediaGrid';
import { ImageIcon, GridIcon } from '../components/icons';
import { Skeleton } from '../components/ui/Skeleton';
import { useAuth } from '../hooks/useAuth';
import { useToast } from '../hooks/useToast';
import {
  usePostQuery,
  useUpdatePostMutation,
  useMediaQuery,
  useUploadMediaMutation,
  useDeleteMediaMutation,
} from '../hooks/queries';

const styles = stylex.create({
  pageTitle: {
    fontFamily: fonts.display,
    fontSize: 'clamp(2rem, 5vw, 3.5rem)',
    fontWeight: 900,
    letterSpacing: '-0.03em',
    lineHeight: 1.1,
    marginBottom: '1rem',
    color: colors.textPrimary,
  },
  compose: {
    maxWidth: '780px',
    margin: '0 auto',
  },
  titleInput: {
    fontFamily: fonts.display,
    fontSize: '2rem',
    fontWeight: 700,
    border: 'none',
    background: 'transparent',
    padding: 0,
    marginBottom: '0.5rem',
    lineHeight: 1.2,
    width: '100%',
    color: colors.textPrimary,
    outline: 'none',
  },
  contentInput: {
    fontFamily: fonts.body,
    fontSize: '1.0625rem',
    lineHeight: 1.7,
    border: 'none',
    background: 'transparent',
    padding: 0,
    minHeight: '400px',
    width: '100%',
    resize: 'vertical',
    color: colors.textPrimary,
    outline: 'none',
  },
  dragOver: {
    borderWidth: '2px',
    borderStyle: 'dashed',
    borderColor: colors.accent,
    borderRadius: radii.md,
  },
  mediaBar: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.5rem',
    padding: '0.25rem 0',
  },
  mediaBtn: {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: '32px',
    height: '32px',
    borderWidth: '1px',
    borderStyle: 'solid',
    borderColor: colors.ruleLight,
    borderRadius: radii.sm,
    background: 'transparent',
    color: colors.textMuted,
    cursor: 'pointer',
    transition: 'color 0.15s, border-color 0.15s',
    ':hover': {
      color: colors.accent,
      borderColor: colors.accent,
    },
  },
  mediaBtnActive: {
    color: colors.accent,
    borderColor: colors.accent,
    background: colors.accentMuted,
  },
  uploading: {
    pointerEvents: 'none',
    opacity: 0.5,
  },
  mediaHint: {
    fontFamily: fonts.sans,
    fontSize: '0.7rem',
    color: colors.textMuted,
  },
  panel: {
    borderWidth: '1px',
    borderStyle: 'solid',
    borderColor: colors.border,
    borderRadius: radii.md,
    padding: '0.75rem',
    marginBottom: '0.5rem',
    background: colors.bgSecondary,
    maxHeight: '300px',
    overflowY: 'auto',
  },
  panelHeader: {
    fontFamily: fonts.sans,
    fontSize: '0.75rem',
    fontWeight: 600,
    color: colors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: '0.04em',
    marginBottom: '0.5rem',
  },
  toolbar: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '1rem 0',
    borderTop: `1px solid ${colors.ruleLight}`,
    marginTop: '1rem',
    flexWrap: 'wrap',
    gap: '0.75rem',
  },
  toolbarRight: {
    display: 'flex',
    gap: '0.5rem',
    alignItems: 'center',
  },
  select: {
    fontFamily: fonts.sans,
    fontSize: '0.9375rem',
    border: `1px solid ${colors.border}`,
    background: colors.bgInput,
    color: colors.textPrimary,
    padding: '0.625rem 0.875rem',
    borderRadius: radii.sm,
    outline: 'none',
    width: 'auto',
  },
  tagsInput: {
    fontFamily: fonts.sans,
    fontSize: '0.9375rem',
    border: `1px solid ${colors.border}`,
    background: colors.bgInput,
    color: colors.textPrimary,
    padding: '0.625rem 0.875rem',
    borderRadius: radii.sm,
    outline: 'none',
    maxWidth: '300px',
    width: '100%',
  },
});

export function EditPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useViewTransitionNavigate();
  const { token } = useAuth();
  const { toast } = useToast();

  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [tags, setTags] = useState('');
  const [status, setStatus] = useState('draft');
  const [initialized, setInitialized] = useState(false);
  const [panelOpen, setPanelOpen] = useState(false);
  const [sessionMedia, setSessionMedia] = useState<string[]>([]);
  const [isDragging, setIsDragging] = useState(false);

  const contentRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { data: post, isLoading: postLoading, isError } = usePostQuery(id);
  const { data: mediaData } = useMediaQuery();
  const mediaItems = mediaData?.media || [];

  const uploadMedia = useUploadMediaMutation();
  const deleteMediaMutation = useDeleteMediaMutation();
  const updatePost = useUpdatePostMutation();

  // Populate form once post loads
  useEffect(() => {
    if (post && !initialized) {
      setTitle(post.title || '');
      setContent(post.content || '');
      setTags((post.tags || []).join(', '));
      setStatus(post.status || 'draft');
      setInitialized(true);
    }
  }, [post, initialized]);

  useEffect(() => {
    if (isError) {
      toast('Could not load post for editing', 'error');
      navigate('/');
    }
  }, [isError, toast, navigate]);

  const insertAtCursor = useCallback((text: string) => {
    const ta = contentRef.current;
    if (!ta) return;
    const start = ta.selectionStart;
    const end = ta.selectionEnd;
    const before = ta.value.substring(0, start);
    const after = ta.value.substring(end);
    const needBefore = before.length > 0 && !before.endsWith('\n') ? '\n' : '';
    const needAfter = after.length > 0 && !after.startsWith('\n') ? '\n' : '';
    const insert = needBefore + text + needAfter;
    const newValue = before + insert + after;
    setContent(newValue);
    requestAnimationFrame(() => {
      ta.selectionStart = ta.selectionEnd = start + insert.length;
      ta.focus();
    });
  }, []);

  const handleUpload = useCallback(
    async (file: File) => {
      if (!file.type.startsWith('image/') && !file.type.startsWith('video/')) {
        toast('Only image and video files are supported', 'error');
        return;
      }
      try {
        const resp = await uploadMedia.mutateAsync(file);
        const isVideo = resp.content_type?.startsWith('video/');
        const name = file.name.replace(/\[|\]/g, '');
        const altText = isVideo ? `video:${name}` : name;
        insertAtCursor(`![${altText}](/api/media/${resp.id})`);
        setSessionMedia((prev) => [...prev, resp.id]);
        toast('Media uploaded', 'success');
      } catch (err: any) {
        toast(err.message || 'Upload failed', 'error');
      }
    },
    [toast, insertAtCursor, uploadMedia],
  );

  const referencedIds = new Set<string>();
  const refRegex = /\/api\/media\/([a-f0-9-]+)/g;
  let m;
  while ((m = refRegex.exec(content)) !== null) referencedIds.add(m[1]);

  const handleUpdate = async () => {
    if (!title.trim() || !content.trim()) {
      toast('Title and content are required', 'error');
      return;
    }
    try {
      await updatePost.mutateAsync({
        id: id!,
        data: {
          title: title.trim(),
          content: content.trim(),
          tags: tags.split(',').map((t) => t.trim()).filter(Boolean),
          status,
        },
      });
      toast('Story updated!', 'success');
      navigate(`/post/${id}`);
    } catch (err: any) {
      toast(err.message, 'error');
    }
  };

  const handleDeleteMedia = async (mediaId: string) => {
    if (!confirm('Delete this media file?')) return;
    try {
      await deleteMediaMutation.mutateAsync(mediaId);
      toast('Media deleted', 'info');
    } catch (err: any) {
      toast(err.message || 'Delete failed', 'error');
    }
  };

  if (postLoading) {
    return (
      <div {...stylex.props(styles.compose)}>
        <Skeleton variant="title" />
        <Skeleton />
        <Skeleton />
      </div>
    );
  }

  return (
    <div {...stylex.props(styles.compose)}>
      <h1 {...stylex.props(styles.pageTitle)}>Edit Story</h1>
      <SectionRule />

      <input
        {...stylex.props(styles.titleInput)}
        type="text"
        placeholder="Title"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
      />

      <textarea
        ref={contentRef}
        {...stylex.props(styles.contentInput, isDragging && styles.dragOver)}
        placeholder="Write your story..."
        value={content}
        onChange={(e) => setContent(e.target.value)}
        onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
        onDragEnter={(e) => { e.preventDefault(); setIsDragging(true); }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setIsDragging(false);
          const file = e.dataTransfer.files[0];
          if (file) handleUpload(file);
        }}
        onPaste={(e) => {
          const items = e.clipboardData?.items;
          if (!items) return;
          for (const item of items) {
            if (item.kind === 'file' && (item.type.startsWith('image/') || item.type.startsWith('video/'))) {
              e.preventDefault();
              handleUpload(item.getAsFile()!);
              return;
            }
          }
        }}
      />

      <div {...stylex.props(styles.mediaBar)}>
        <button
          {...stylex.props(styles.mediaBtn, uploadMedia.isPending && styles.uploading)}
          onClick={() => fileInputRef.current?.click()}
          title="Upload image or video"
        >
          <ImageIcon />
        </button>
        <button
          {...stylex.props(styles.mediaBtn, panelOpen && styles.mediaBtnActive)}
          onClick={() => setPanelOpen((o) => !o)}
          title="Media library"
        >
          <GridIcon />
        </button>
        <span {...stylex.props(styles.mediaHint)}>Drop files to upload</span>
      </div>

      {panelOpen && (
        <div {...stylex.props(styles.panel)}>
          <div {...stylex.props(styles.panelHeader)}>Media Library</div>
          <MediaGrid
            items={mediaItems}
            sessionMediaIds={sessionMedia}
            referencedIds={referencedIds}
            onInsert={(media) => {
              const isVideo = media.content_type?.startsWith('video/');
              const name = media.original_name.replace(/\[|\]/g, '');
              const altText = isVideo ? `video:${name}` : name;
              insertAtCursor(`![${altText}](/api/media/${media.id})`);
            }}
            onDelete={handleDeleteMedia}
          />
        </div>
      )}

      <div {...stylex.props(styles.toolbar)}>
        <div>
          <FormGroup label="Tags (comma-separated)" style={{ marginBottom: 0 }}>
            <input
              {...stylex.props(styles.tagsInput)}
              type="text"
              placeholder="rust, web, tutorial"
              value={tags}
              onChange={(e) => setTags(e.target.value)}
            />
          </FormGroup>
        </div>
        <div {...stylex.props(styles.toolbarRight)}>
          <select
            {...stylex.props(styles.select)}
            value={status}
            onChange={(e) => setStatus(e.target.value)}
          >
            <option value="draft">Draft</option>
            <option value="published">Published</option>
            <option value="archived">Archived</option>
          </select>
          <Button variant="secondary" onClick={() => navigate(`/post/${id}`)}>
            Cancel
          </Button>
          <Button variant="primary" onClick={handleUpdate}>
            Update
          </Button>
        </div>
      </div>

      <input
        ref={fileInputRef}
        type="file"
        accept="image/*,video/*"
        style={{ display: 'none' }}
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) handleUpload(file);
          e.target.value = '';
        }}
      />
    </div>
  );
}
