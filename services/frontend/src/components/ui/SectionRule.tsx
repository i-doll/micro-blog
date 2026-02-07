import React from 'react';
import * as stylex from '@stylexjs/stylex';
import { colors } from '../../theme/tokens.stylex';

const styles = stylex.create({
  rule: {
    border: 'none',
    borderTop: `2px solid ${colors.ruleColor}`,
    margin: '1.5rem 0',
  },
  light: {
    borderTop: `1px solid ${colors.ruleLight}`,
  },
});

export function SectionRule({ light }: { light?: boolean }) {
  return <hr {...stylex.props(styles.rule, light && styles.light)} />;
}
