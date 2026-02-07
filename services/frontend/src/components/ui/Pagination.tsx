import React from 'react';
import * as stylex from '@stylexjs/stylex';
import { colors, fonts, radii } from '../../theme/tokens.stylex';

const styles = stylex.create({
  container: {
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    gap: '0.5rem',
    marginTop: '2rem',
    fontFamily: fonts.sans,
    fontSize: '0.875rem',
  },
  button: {
    padding: '0.4rem 0.75rem',
    borderRadius: radii.sm,
    borderWidth: '1px',
    borderStyle: 'solid',
    borderColor: colors.border,
    background: colors.bgCard,
    color: colors.textSecondary,
    cursor: 'pointer',
    fontFamily: fonts.sans,
    fontSize: '0.875rem',
    transition: 'border-color 0.2s, color 0.2s',
    ':hover': {
      borderColor: colors.accent,
      color: colors.accent,
    },
  },
  disabled: {
    opacity: 0.4,
    cursor: 'not-allowed',
    ':hover': {
      borderColor: colors.border,
      color: colors.textSecondary,
    },
  },
  info: {
    color: colors.textMuted,
  },
});

interface PaginationProps {
  page: number;
  totalPages: number;
  onPageChange: (page: number) => void;
}

export function Pagination({ page, totalPages, onPageChange }: PaginationProps) {
  if (totalPages <= 1) return null;

  return (
    <div {...stylex.props(styles.container)}>
      <button
        {...stylex.props(styles.button, page <= 1 && styles.disabled)}
        disabled={page <= 1}
        onClick={() => onPageChange(page - 1)}
      >
        &larr; Prev
      </button>
      <span {...stylex.props(styles.info)}>
        Page {page} of {totalPages}
      </span>
      <button
        {...stylex.props(styles.button, page >= totalPages && styles.disabled)}
        disabled={page >= totalPages}
        onClick={() => onPageChange(page + 1)}
      >
        Next &rarr;
      </button>
    </div>
  );
}
