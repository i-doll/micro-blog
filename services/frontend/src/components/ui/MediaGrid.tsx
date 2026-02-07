import React from 'react';
import * as stylex from '@stylexjs/stylex';
import { colors, fonts, radii } from '../../theme/tokens.stylex';
import type { Media } from '../../types';

const styles = stylex.create({
  grid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(80px, 1fr))',
    gap: '0.5rem',
  },
  item: {
    position: 'relative',
    aspectRatio: '1',
    borderWidth: '2px',
    borderStyle: 'solid',
    borderColor: colors.border,
    borderRadius: radii.sm,
    overflow: 'hidden',
    cursor: 'pointer',
    transition: 'border-color 0.15s',
    ':hover': {
      borderColor: colors.accent,
    },
  },
  itemSession: {
    borderColor: colors.accent,
  },
  itemReferenced: {
    boxShadow: `inset 0 0 0 2px ${colors.success}`,
  },
  media: {
    width: '100%',
    height: '100%',
    objectFit: 'cover',
    display: 'block',
  },
  deleteBtn: {
    position: 'absolute',
    top: '2px',
    right: '2px',
    width: '18px',
    height: '18px',
    borderRadius: '50%',
    background: colors.error,
    color: 'white',
    fontSize: '10px',
    lineHeight: '18px',
    textAlign: 'center',
    opacity: 0,
    transition: 'opacity 0.15s',
    cursor: 'pointer',
    border: 'none',
    padding: 0,
    fontFamily: fonts.sans,
  },
  videoBadge: {
    position: 'absolute',
    bottom: '2px',
    left: '2px',
    background: 'rgba(0,0,0,0.7)',
    color: 'white',
    fontSize: '9px',
    padding: '1px 4px',
    borderRadius: '2px',
    fontFamily: fonts.sans,
  },
  empty: {
    gridColumn: '1 / -1',
    textAlign: 'center',
    fontFamily: fonts.sans,
    fontSize: '0.8rem',
    color: colors.textMuted,
    padding: '1rem',
  },
  clickOverlay: {
    position: 'absolute',
    inset: 0,
    cursor: 'pointer',
  },
});

// Hover styles for delete button visibility need a wrapper
const itemHoverStyles = stylex.create({
  wrapper: {
    ':hover > button': {
      opacity: 1,
    },
  },
});

interface MediaGridProps {
  items: Media[];
  sessionMediaIds?: string[];
  referencedIds?: Set<string>;
  onInsert?: (media: Media) => void;
  onDelete?: (mediaId: string) => void;
  emptyMessage?: string;
}

export function MediaGrid({
  items,
  sessionMediaIds = [],
  referencedIds,
  onInsert,
  onDelete,
  emptyMessage = 'No media yet. Upload files above.',
}: MediaGridProps) {
  if (items.length === 0) {
    return (
      <div {...stylex.props(styles.grid)}>
        <div {...stylex.props(styles.empty)}>{emptyMessage}</div>
      </div>
    );
  }

  return (
    <div {...stylex.props(styles.grid)}>
      {items.map((item) => {
        const isVideo = item.content_type?.startsWith('video/');
        const isSession = sessionMediaIds.includes(item.id);
        const isRef = referencedIds?.has(item.id);

        return (
          <div
            key={item.id}
            {...stylex.props(
              styles.item,
              isSession && styles.itemSession,
              isRef && styles.itemReferenced,
            )}
            title={item.original_name}
          >
            {isVideo ? (
              <>
                <video src={`/api/media/${item.id}`} muted {...stylex.props(styles.media)} />
                <span {...stylex.props(styles.videoBadge)}>VIDEO</span>
              </>
            ) : (
              <img
                src={`/api/media/${item.id}`}
                alt={item.original_name}
                loading="lazy"
                {...stylex.props(styles.media)}
              />
            )}
            {onDelete && (
              <button
                {...stylex.props(styles.deleteBtn)}
                onClick={(e) => {
                  e.stopPropagation();
                  onDelete(item.id);
                }}
                title="Delete"
              >
                &times;
              </button>
            )}
            {onInsert && (
              <div
                {...stylex.props(styles.clickOverlay)}
                onClick={() => onInsert(item)}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}
