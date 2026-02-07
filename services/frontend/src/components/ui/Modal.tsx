import React, { useEffect, useCallback } from 'react';
import * as stylex from '@stylexjs/stylex';
import { colors, fonts, radii, shadows } from '../../theme/tokens.stylex';

const styles = stylex.create({
  overlay: {
    position: 'fixed',
    inset: 0,
    background: colors.bgOverlay,
    zIndex: 300,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '1rem',
  },
  modal: {
    background: colors.bgCard,
    borderRadius: radii.md,
    width: '100%',
    maxWidth: '500px',
    padding: '2rem',
    boxShadow: shadows.xl,
    animationName: 'fadeIn',
    animationDuration: '0.25s',
    animationTimingFunction: 'cubic-bezier(0.16, 1, 0.3, 1)',
  },
  title: {
    fontFamily: fonts.display,
    fontSize: '1.25rem',
    fontWeight: 700,
    marginBottom: '1rem',
    color: colors.textPrimary,
  },
});

interface ModalProps {
  open: boolean;
  onClose: () => void;
  title?: string;
  children: React.ReactNode;
}

export function Modal({ open, onClose, title, children }: ModalProps) {
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    },
    [onClose],
  );

  useEffect(() => {
    if (open) {
      document.addEventListener('keydown', handleKeyDown);
      return () => document.removeEventListener('keydown', handleKeyDown);
    }
  }, [open, handleKeyDown]);

  if (!open) return null;

  return (
    <div {...stylex.props(styles.overlay)} onClick={onClose}>
      <div {...stylex.props(styles.modal)} onClick={(e) => e.stopPropagation()}>
        {title && <h3 {...stylex.props(styles.title)}>{title}</h3>}
        {children}
      </div>
    </div>
  );
}
