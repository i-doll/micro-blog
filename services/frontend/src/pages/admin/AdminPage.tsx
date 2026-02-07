import React, { useState, useEffect } from 'react';
import * as stylex from '@stylexjs/stylex';
import { colors, fonts, easings } from '../../theme/tokens.stylex';
import { Container } from '../../components/layout/Container';
import { SectionRule } from '../../components/ui/SectionRule';
import { useAuth } from '../../hooks/useAuth';
import { AdminUsersTab } from './AdminUsersTab';
import { AdminPostsTab } from './AdminPostsTab';
import { AdminCommentsTab } from './AdminCommentsTab';
import { AdminMediaTab } from './AdminMediaTab';

const styles = stylex.create({
  pageTitle: {
    fontFamily: fonts.display,
    fontSize: 'clamp(2rem, 5vw, 3.5rem)',
    fontWeight: 900,
    letterSpacing: '-0.03em',
    lineHeight: 1.1,
    marginBottom: '0.5rem',
    color: colors.textPrimary,
  },
  pageSubtitle: {
    fontFamily: fonts.body,
    fontSize: '1.125rem',
    color: colors.textSecondary,
    fontStyle: 'italic',
    marginBottom: '2rem',
  },
  tabs: {
    display: 'flex',
    gap: 0,
    borderBottom: `1px solid ${colors.border}`,
    marginBottom: '1.5rem',
  },
  tab: {
    fontFamily: fonts.sans,
    fontSize: '0.75rem',
    fontWeight: 600,
    textTransform: 'uppercase',
    letterSpacing: '0.08em',
    color: colors.textMuted,
    padding: '0.75rem 1.25rem 0.625rem',
    cursor: 'pointer',
    borderBottom: '2px solid transparent',
    marginBottom: '-1px',
    transition: `color 0.25s ${easings.out}, border-color 0.25s ${easings.out}`,
    background: 'none',
    border: 'none',
    borderBottomWidth: '2px',
    borderBottomStyle: 'solid',
    borderBottomColor: 'transparent',
    ':hover': {
      color: colors.textPrimary,
    },
  },
  tabActive: {
    color: colors.accent,
    borderBottomColor: colors.accent,
  },
  tabHidden: {
    display: 'none',
  },
});

type AdminTab = 'users' | 'posts' | 'comments' | 'media';

export function AdminPage() {
  const { user } = useAuth();
  const isWriter = user?.role === 'writer';
  const isAdmin = user?.role === 'admin';

  const [activeTab, setActiveTab] = useState<AdminTab>(isAdmin ? 'users' : 'comments');

  const tabs: { key: AdminTab; label: string; adminOnly: boolean }[] = [
    { key: 'users', label: 'Users', adminOnly: true },
    { key: 'posts', label: 'Posts', adminOnly: true },
    { key: 'comments', label: 'Comments', adminOnly: false },
    { key: 'media', label: 'Media', adminOnly: true },
  ];

  return (
    <Container>
      <h1 {...stylex.props(styles.pageTitle)}>Admin Panel</h1>
      <p {...stylex.props(styles.pageSubtitle)}>Manage users and content</p>
      <SectionRule />

      <div {...stylex.props(styles.tabs)}>
        {tabs.map((tab) => (
          <button
            key={tab.key}
            {...stylex.props(
              styles.tab,
              activeTab === tab.key && styles.tabActive,
              isWriter && tab.adminOnly && styles.tabHidden,
            )}
            onClick={() => setActiveTab(tab.key)}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {activeTab === 'users' && isAdmin && <AdminUsersTab />}
      {activeTab === 'posts' && isAdmin && <AdminPostsTab />}
      {activeTab === 'comments' && <AdminCommentsTab />}
      {activeTab === 'media' && isAdmin && <AdminMediaTab />}
    </Container>
  );
}
