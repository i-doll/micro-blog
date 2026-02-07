import React from 'react';
import * as stylex from '@stylexjs/stylex';
import { colors, fonts } from '../../theme/tokens.stylex';

const styles = stylex.create({
  container: {
    display: 'inline-flex',
    borderWidth: '1px',
    borderStyle: 'solid',
    borderColor: colors.border,
    borderRadius: '3px',
    overflow: 'hidden',
    flexShrink: 0,
  },
  button: {
    fontFamily: fonts.sans,
    fontSize: '0.5625rem',
    fontWeight: 600,
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
    padding: '0.2rem 0.4rem',
    border: 'none',
    background: colors.bgInput,
    color: colors.textMuted,
    cursor: 'pointer',
    transition: 'all 0.15s',
    lineHeight: 1.3,
    borderRight: `1px solid ${colors.border}`,
  },
  buttonLast: {
    borderRight: 'none',
  },
  activeUser: {
    pointerEvents: 'none',
    background: colors.tagBg,
    color: colors.tagText,
  },
  activeWriter: {
    pointerEvents: 'none',
    background: colors.warning,
    color: '#000',
  },
  activeAdmin: {
    pointerEvents: 'none',
    background: colors.accent,
    color: colors.textInverse,
  },
});

interface RoleSwitcherProps {
  currentRole: string;
  onChangeRole: (role: string) => void;
}

export function RoleSwitcher({ currentRole, onChangeRole }: RoleSwitcherProps) {
  return (
    <div {...stylex.props(styles.container)}>
      <button
        {...stylex.props(styles.button, currentRole === 'user' && styles.activeUser)}
        onClick={() => onChangeRole('user')}
      >
        U
      </button>
      <button
        {...stylex.props(styles.button, currentRole === 'writer' && styles.activeWriter)}
        onClick={() => onChangeRole('writer')}
      >
        W
      </button>
      <button
        {...stylex.props(
          styles.button,
          styles.buttonLast,
          currentRole === 'admin' && styles.activeAdmin,
        )}
        onClick={() => onChangeRole('admin')}
      >
        A
      </button>
    </div>
  );
}
