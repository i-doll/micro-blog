import React from 'react';
import * as stylex from '@stylexjs/stylex';
import { colors, fonts } from '../../theme/tokens.stylex';

const styles = stylex.create({
  group: {
    marginBottom: '1rem',
  },
  label: {
    display: 'block',
    fontFamily: fonts.sans,
    fontSize: '0.8125rem',
    fontWeight: 500,
    textTransform: 'uppercase',
    letterSpacing: '0.04em',
    color: colors.textSecondary,
    marginBottom: '0.375rem',
  },
  error: {
    fontFamily: fonts.sans,
    fontSize: '0.8125rem',
    color: colors.error,
    marginTop: '0.25rem',
  },
});

interface FormGroupProps {
  label?: string;
  error?: string;
  children: React.ReactNode;
  style?: React.CSSProperties;
}

export function FormGroup({ label, error, children, style }: FormGroupProps) {
  return (
    <div {...stylex.props(styles.group)} style={style}>
      {label && <label {...stylex.props(styles.label)}>{label}</label>}
      {children}
      {error && <div {...stylex.props(styles.error)}>{error}</div>}
    </div>
  );
}
