import React from 'react';
import * as stylex from '@stylexjs/stylex';
import { colors, radii } from '../../theme/tokens.stylex';

const styles = stylex.create({
  base: {
    background: `linear-gradient(90deg, ${colors.bgSecondary} 25%, ${colors.borderLight} 50%, ${colors.bgSecondary} 75%)`,
    backgroundSize: '200% 100%',
    animationName: 'shimmer',
    animationDuration: '1.5s',
    animationIterationCount: 'infinite',
    borderRadius: radii.sm,
  },
  title: {
    height: '2rem',
    width: '70%',
    marginBottom: '0.75rem',
  },
  text: {
    height: '1rem',
    width: '100%',
    marginBottom: '0.5rem',
  },
  textLast: {
    width: '60%',
  },
});

interface SkeletonProps {
  variant?: 'title' | 'text';
  last?: boolean;
}

export function Skeleton({ variant = 'text', last }: SkeletonProps) {
  return (
    <div
      {...stylex.props(
        styles.base,
        variant === 'title' && styles.title,
        variant === 'text' && styles.text,
        last && styles.textLast,
      )}
    />
  );
}
