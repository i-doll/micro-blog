import React from 'react';
import * as stylex from '@stylexjs/stylex';
import { colors, fonts, radii, shadows } from '../../theme/tokens.stylex';
import { useToast } from '../../hooks/useToast';

const styles = stylex.create({
  container: {
    position: 'fixed',
    bottom: '1.5rem',
    right: '1.5rem',
    zIndex: 999,
    display: 'flex',
    flexDirection: 'column',
    gap: '0.5rem',
  },
  toast: {
    fontFamily: fonts.sans,
    fontSize: '0.8125rem',
    padding: '0.75rem 1.25rem',
    borderRadius: radii.sm,
    background: colors.bgCard,
    color: colors.textPrimary,
    borderWidth: '1px',
    borderStyle: 'solid',
    borderColor: colors.border,
    boxShadow: shadows.lg,
    animationName: 'toastIn',
    animationDuration: '0.3s',
    animationTimingFunction: 'cubic-bezier(0.16, 1, 0.3, 1)',
    maxWidth: '360px',
  },
  error: {
    borderLeft: `3px solid ${colors.error}`,
  },
  success: {
    borderLeft: `3px solid ${colors.success}`,
  },
  info: {
    borderLeft: `3px solid ${colors.accent}`,
  },
});

export function ToastContainer() {
  const { toasts } = useToast();

  return (
    <div {...stylex.props(styles.container)}>
      {toasts.map((t) => (
        <div
          key={t.id}
          {...stylex.props(
            styles.toast,
            t.type === 'error' && styles.error,
            t.type === 'success' && styles.success,
            t.type === 'info' && styles.info,
          )}
        >
          {t.message}
        </div>
      ))}
    </div>
  );
}
