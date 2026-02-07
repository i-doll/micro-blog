import React from 'react';
import * as stylex from '@stylexjs/stylex';
import { colors, fonts } from '../../theme/tokens.stylex';

const styles = stylex.create({
  container: {
    textAlign: 'center',
    padding: '4rem 2rem',
    color: colors.textMuted,
  },
  icon: {
    fontSize: '3rem',
    marginBottom: '1rem',
  },
  title: {
    fontFamily: fonts.display,
    fontSize: '1.25rem',
    fontWeight: 700,
    color: colors.textSecondary,
    marginBottom: '0.5rem',
  },
  text: {
    fontSize: '0.9375rem',
  },
});

interface EmptyStateProps {
  icon?: string;
  title?: string;
  text?: string;
}

export function EmptyState({ icon, title, text }: EmptyStateProps) {
  return (
    <div {...stylex.props(styles.container)}>
      {icon && <div {...stylex.props(styles.icon)}>{icon}</div>}
      {title && <div {...stylex.props(styles.title)}>{title}</div>}
      {text && <div {...stylex.props(styles.text)}>{text}</div>}
    </div>
  );
}
