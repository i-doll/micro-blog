import React from 'react';
import * as stylex from '@stylexjs/stylex';
import { colors, fonts, radii, easings } from '../../theme/tokens.stylex';

const styles = stylex.create({
  base: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '0.375rem',
    borderRadius: radii.sm,
    fontWeight: 500,
    fontSize: '0.8125rem',
    textTransform: 'uppercase',
    letterSpacing: '0.04em',
    fontFamily: fonts.sans,
    cursor: 'pointer',
    border: 'none',
    background: 'none',
    transition: `all 0.2s ${easings.out}`,
    padding: '0.5rem 1rem',
    lineHeight: 1.4,
  },
  primary: {
    background: colors.accent,
    color: colors.textInverse,
    ':hover': {
      background: colors.accentHover,
      transform: 'translateY(-1px)',
    },
  },
  secondary: {
    background: colors.bgSecondary,
    color: colors.textPrimary,
    borderWidth: '1px',
    borderStyle: 'solid',
    borderColor: colors.border,
    ':hover': {
      borderColor: colors.borderHeavy,
    },
  },
  ghost: {
    color: colors.textSecondary,
    padding: '0.4rem 0.6rem',
    ':hover': {
      color: colors.textPrimary,
      background: colors.bgSecondary,
    },
  },
  icon: {
    width: '36px',
    height: '36px',
    padding: 0,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: '50%',
    position: 'relative',
    color: colors.textSecondary,
    ':hover': {
      color: colors.textPrimary,
    },
  },
  danger: {
    background: colors.error,
    color: 'white',
    ':hover': {
      opacity: 0.9,
    },
  },
  sm: {
    padding: '0.3rem 0.6rem',
    fontSize: '0.75rem',
  },
  deleteIcon: {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: '24px',
    height: '24px',
    padding: 0,
    borderRadius: '3px',
    background: 'transparent',
    color: colors.textMuted,
    borderWidth: '1px',
    borderStyle: 'solid',
    borderColor: 'transparent',
    cursor: 'pointer',
    transition: 'all 0.15s',
    flexShrink: 0,
    ':hover': {
      color: colors.error,
      borderColor: colors.error,
      background: 'rgba(192,57,43,0.08)',
    },
  },
  fullWidth: {
    width: '100%',
    justifyContent: 'center',
  },
  disabled: {
    opacity: 0.4,
    cursor: 'not-allowed',
  },
});

type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'icon' | 'danger' | 'deleteIcon';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: 'sm' | 'md';
  fullWidth?: boolean;
}

export function Button({
  variant = 'primary',
  size,
  fullWidth,
  disabled,
  children,
  ...props
}: ButtonProps) {
  return (
    <button
      disabled={disabled}
      {...stylex.props(
        styles.base,
        variant === 'primary' && styles.primary,
        variant === 'secondary' && styles.secondary,
        variant === 'ghost' && styles.ghost,
        variant === 'icon' && styles.icon,
        variant === 'danger' && styles.danger,
        variant === 'deleteIcon' && styles.deleteIcon,
        size === 'sm' && styles.sm,
        fullWidth && styles.fullWidth,
        disabled && styles.disabled,
      )}
      {...props}
    >
      {children}
    </button>
  );
}
