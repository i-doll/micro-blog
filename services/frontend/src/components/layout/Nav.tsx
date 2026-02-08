import React from 'react';
import { useLocation } from 'react-router';
import * as stylex from '@stylexjs/stylex';
import { colors, fonts } from '../../theme/tokens.stylex';
import { useViewTransitionNavigate } from '../../hooks/useViewTransitionNavigate';
import { useAuth } from '../../hooks/useAuth';

const styles = stylex.create({
  nav: {
    display: 'flex',
    gap: 0,
    borderTop: `2px solid ${colors.ruleColor}`,
    borderBottom: `1px solid ${colors.border}`,
    overflowX: 'auto',
    scrollbarWidth: 'none',
  },
  link: {
    fontFamily: fonts.sans,
    fontSize: '0.8125rem',
    fontWeight: 500,
    textTransform: 'uppercase',
    letterSpacing: '0.08em',
    color: colors.textSecondary,
    padding: '0.6rem 1rem',
    whiteSpace: 'nowrap',
    borderRight: `1px solid ${colors.borderLight}`,
    transition: 'color 0.2s, background 0.2s',
    cursor: 'pointer',
    textDecoration: 'none',
    ':hover': {
      color: colors.textPrimary,
      background: colors.bgSecondary,
    },
  },
  active: {
    color: colors.accent,
  },
});

export function Nav() {
  const navigate = useViewTransitionNavigate();
  const location = useLocation();
  const { user } = useAuth();

  const isActive = (path: string) => {
    const hash = location.pathname;
    return hash === path;
  };

  const canWrite = user && (user.role === 'writer' || user.role === 'admin');

  return (
    <nav {...stylex.props(styles.nav)}>
      <a
        {...stylex.props(styles.link, isActive('/') && styles.active)}
        onClick={() => navigate('/')}
      >
        Latest
      </a>
      <a
        {...stylex.props(styles.link, isActive('/search') && styles.active)}
        onClick={() => navigate('/search')}
      >
        Search
      </a>
      {user && (
        <a
          {...stylex.props(styles.link, isActive('/profile') && styles.active)}
          onClick={() => navigate('/profile')}
        >
          Profile
        </a>
      )}
      {canWrite && (
        <a
          {...stylex.props(styles.link, isActive('/admin') && styles.active)}
          onClick={() => navigate('/admin')}
        >
          Admin
        </a>
      )}
      <a
        {...stylex.props(styles.link, isActive('/health') && styles.active)}
        onClick={() => navigate('/health')}
      >
        System
      </a>
    </nav>
  );
}
