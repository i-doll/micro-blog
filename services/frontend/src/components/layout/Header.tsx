import React from 'react';
import { useNavigate } from 'react-router';
import * as stylex from '@stylexjs/stylex';
import { colors, fonts, easings } from '../../theme/tokens.stylex';
import { Container } from './Container';
import { Nav } from './Nav';
import { HeaderActions } from './HeaderActions';

const styles = stylex.create({
  header: {
    position: 'sticky',
    top: 0,
    zIndex: 100,
    background: colors.bgPrimary,
    borderBottom: `1px solid ${colors.border}`,
    transition: `background 0.4s ${easings.out}`,
  },
  headerTop: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '0.75rem 0',
  },
  masthead: {
    fontFamily: fonts.display,
    fontWeight: 900,
    fontSize: 'clamp(1.5rem, 3vw, 2rem)',
    color: colors.textPrimary,
    letterSpacing: '-0.02em',
    cursor: 'pointer',
    userSelect: 'none',
  },
  mastheadAccent: {
    fontStyle: 'italic',
    fontWeight: 400,
    color: colors.accent,
  },
});

export function Header() {
  const navigate = useNavigate();

  return (
    <header {...stylex.props(styles.header)}>
      <Container>
        <div {...stylex.props(styles.headerTop)}>
          <div {...stylex.props(styles.masthead)} onClick={() => navigate('/')}>
            The <span {...stylex.props(styles.mastheadAccent)}>Broadsheet</span>
          </div>
          <HeaderActions />
        </div>
      </Container>
      <Container>
        <Nav />
      </Container>
    </header>
  );
}
