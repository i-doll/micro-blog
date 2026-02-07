import React from 'react';
import * as stylex from '@stylexjs/stylex';

const styles = stylex.create({
  base: {
    maxWidth: '1200px',
    margin: '0 auto',
    padding: '0 1.5rem',
  },
  narrow: {
    maxWidth: '780px',
  },
  wide: {
    maxWidth: '1400px',
  },
});

interface ContainerProps {
  variant?: 'default' | 'narrow' | 'wide';
  children: React.ReactNode;
}

export function Container({ variant = 'default', children }: ContainerProps) {
  return (
    <div
      {...stylex.props(
        styles.base,
        variant === 'narrow' && styles.narrow,
        variant === 'wide' && styles.wide,
      )}
    >
      {children}
    </div>
  );
}
