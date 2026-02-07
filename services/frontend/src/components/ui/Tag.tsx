import React from 'react';
import * as stylex from '@stylexjs/stylex';
import { colors, fonts } from '../../theme/tokens.stylex';

const styles = stylex.create({
  tag: {
    fontFamily: fonts.sans,
    fontSize: '0.6875rem',
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
    padding: '0.2rem 0.5rem',
    background: colors.tagBg,
    color: colors.tagText,
    borderRadius: '2px',
    display: 'inline-block',
  },
});

export function Tag({ children }: { children: React.ReactNode }) {
  return <span {...stylex.props(styles.tag)}>{children}</span>;
}
