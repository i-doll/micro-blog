import React from 'react';
import * as stylex from '@stylexjs/stylex';
import { colors, fonts } from '../../theme/tokens.stylex';

const styles = stylex.create({
  base: {
    fontFamily: fonts.sans,
    fontSize: '0.5625rem',
    fontWeight: 700,
    textTransform: 'uppercase',
    letterSpacing: '0.06em',
    padding: '0.125rem 0.375rem',
    borderRadius: '2px',
    display: 'inline-block',
    lineHeight: 1.4,
  },
  admin: {
    background: colors.accent,
    color: colors.textInverse,
  },
  user: {
    background: colors.tagBg,
    color: colors.tagText,
  },
  writer: {
    background: colors.warning,
    color: '#000',
  },
  published: {
    background: colors.success,
    color: 'white',
  },
  draft: {
    background: colors.warning,
    color: '#000',
  },
  archived: {
    background: colors.textMuted,
    color: 'white',
  },
  you: {
    background: colors.bgSecondary,
    color: colors.textMuted,
    fontStyle: 'italic',
  },
});

type BadgeVariant = 'admin' | 'user' | 'writer' | 'published' | 'draft' | 'archived' | 'you';

export function Badge({ variant, children }: { variant: BadgeVariant; children: React.ReactNode }) {
  return (
    <span {...stylex.props(styles.base, styles[variant])}>
      {children}
    </span>
  );
}
