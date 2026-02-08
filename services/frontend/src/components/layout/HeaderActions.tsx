import React, { useState, useRef, useEffect } from 'react';
import * as stylex from '@stylexjs/stylex';
import { colors, fonts, radii, shadows, easings } from '../../theme/tokens.stylex';
import { useViewTransitionNavigate } from '../../hooks/useViewTransitionNavigate';
import { useAuth } from '../../hooks/useAuth';
import { useTheme } from '../../hooks/useTheme';
import { useToast } from '../../hooks/useToast';
import {
  useNotificationsQuery,
  useMarkNotificationsReadMutation,
  usePostQuery,
} from '../../hooks/queries';
import { SearchIcon, BellIcon, SunIcon, MoonIcon } from '../icons';
import { Button } from '../ui/Button';
import { timeAgo } from '../../lib/timeAgo';
import type { Notification } from '../../types';

const styles = stylex.create({
  actions: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.5rem',
  },
  themeToggle: {
    width: '36px',
    height: '36px',
    borderRadius: '50%',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    color: colors.textSecondary,
    cursor: 'pointer',
    transition: 'color 0.2s',
    border: 'none',
    background: 'none',
    ':hover': {
      color: colors.textPrimary,
    },
  },
  notifWrapper: {
    position: 'relative',
  },
  notifBadge: {
    position: 'absolute',
    top: '-2px',
    right: '-2px',
    background: colors.error,
    color: 'white',
    fontSize: '0.625rem',
    fontWeight: 700,
    width: '18px',
    height: '18px',
    borderRadius: '50%',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontFamily: fonts.sans,
  },
  notifPanel: {
    position: 'absolute',
    top: 'calc(100% + 8px)',
    right: 0,
    width: '360px',
    maxHeight: '480px',
    overflowY: 'auto',
    background: colors.bgCard,
    borderWidth: '1px',
    borderStyle: 'solid',
    borderColor: colors.border,
    borderRadius: radii.md,
    boxShadow: shadows.xl,
    zIndex: 200,
    animationName: 'fadeIn',
    animationDuration: '0.2s',
    animationTimingFunction: easings.out,
  },
  notifHeader: {
    fontFamily: fonts.sans,
    fontSize: '0.8125rem',
    fontWeight: 700,
    textTransform: 'uppercase',
    letterSpacing: '0.06em',
    padding: '0.75rem 1rem',
    borderBottom: `1px solid ${colors.borderLight}`,
    color: colors.textSecondary,
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  notifClearBtn: {
    fontFamily: fonts.sans,
    fontSize: '0.6875rem',
    fontWeight: 600,
    color: colors.accent,
    background: 'none',
    border: 'none',
    cursor: 'pointer',
    padding: '0.125rem 0.375rem',
    borderRadius: '3px',
    transition: 'background 0.15s',
    ':hover': {
      background: colors.accentMuted,
    },
  },
  notifItem: {
    padding: '0.75rem 1rem',
    borderBottom: `1px solid ${colors.borderLight}`,
    cursor: 'pointer',
    transition: 'background 0.15s',
    ':hover': {
      background: colors.bgSecondary,
    },
  },
  notifUnread: {
    background: colors.accentMuted,
  },
  notifMessage: {
    fontFamily: fonts.sans,
    fontSize: '0.8125rem',
    color: colors.textPrimary,
    lineHeight: 1.4,
  },
  notifTime: {
    fontFamily: fonts.sans,
    fontSize: '0.6875rem',
    color: colors.textMuted,
    marginTop: '0.25rem',
  },
  notifEmpty: {
    padding: '2rem 1rem',
    textAlign: 'center',
    fontFamily: fonts.sans,
    fontSize: '0.8125rem',
    color: colors.textMuted,
  },
  userMenu: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.5rem',
  },
  avatarWrapper: {
    position: 'relative',
  },
  avatarBtn: {
    fontFamily: fonts.display,
    fontWeight: 700,
    fontSize: '0.875rem',
    background: colors.accent,
    color: colors.textInverse,
    width: '32px',
    height: '32px',
    borderRadius: '50%',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    cursor: 'pointer',
    border: 'none',
  },
  avatarPanel: {
    position: 'absolute',
    top: 'calc(100% + 8px)',
    right: 0,
    width: '160px',
    background: colors.bgCard,
    borderWidth: '1px',
    borderStyle: 'solid',
    borderColor: colors.border,
    borderRadius: radii.md,
    boxShadow: shadows.xl,
    zIndex: 200,
    animationName: 'fadeIn',
    animationDuration: '0.2s',
    animationTimingFunction: easings.out,
    overflow: 'hidden',
  },
  avatarMenuItem: {
    fontFamily: fonts.sans,
    fontSize: '0.8125rem',
    color: colors.textPrimary,
    padding: '0.625rem 1rem',
    cursor: 'pointer',
    background: 'none',
    border: 'none',
    width: '100%',
    textAlign: 'left',
    transition: 'background 0.15s',
    ':hover': {
      background: colors.bgSecondary,
    },
  },
});

function NotificationPostTitle({ notification }: { notification: Notification }) {
  const postId = notification.metadata?.post_id;
  const { data: post } = usePostQuery(postId || undefined);

  let message = notification.message;
  if (post?.title && message === 'New comment on post') {
    message = `New comment on "${post.title}"`;
  }
  return <>{message}</>;
}

export function HeaderActions() {
  const navigate = useViewTransitionNavigate();
  const { user, logout } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const { toast } = useToast();
  const { data: notifData } = useNotificationsQuery();
  const markAllRead = useMarkNotificationsReadMutation();
  const [notifOpen, setNotifOpen] = useState(false);
  const notifRef = useRef<HTMLDivElement>(null);
  const [avatarOpen, setAvatarOpen] = useState(false);
  const avatarRef = useRef<HTMLDivElement>(null);

  const notifications = notifData?.notifications || [];
  const unreadCount = notifData?.unreadCount || 0;

  const canWrite = user && (user.role === 'writer' || user.role === 'admin');

  // Close panels on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (notifRef.current && !notifRef.current.contains(e.target as Node)) {
        setNotifOpen(false);
      }
      if (avatarRef.current && !avatarRef.current.contains(e.target as Node)) {
        setAvatarOpen(false);
      }
    }
    document.addEventListener('click', handleClick);
    return () => document.removeEventListener('click', handleClick);
  }, []);

  return (
    <div {...stylex.props(styles.actions)}>
      <Button variant="icon" onClick={() => navigate('/search')} title="Search">
        <SearchIcon />
      </Button>

      {user && (
        <div {...stylex.props(styles.notifWrapper)} ref={notifRef}>
          <Button
            variant="icon"
            onClick={() => setNotifOpen((o) => !o)}
            title="Notifications"
          >
            <BellIcon />
            {unreadCount > 0 && (
              <span {...stylex.props(styles.notifBadge)}>
                {unreadCount > 99 ? '99+' : unreadCount}
              </span>
            )}
          </Button>

          {notifOpen && (
            <div {...stylex.props(styles.notifPanel)}>
              <div {...stylex.props(styles.notifHeader)}>
                <span>Notifications</span>
                {unreadCount > 0 && (
                  <button
                    {...stylex.props(styles.notifClearBtn)}
                    onClick={(e) => {
                      e.stopPropagation();
                      markAllRead.mutate();
                    }}
                  >
                    Mark all read
                  </button>
                )}
              </div>
              {notifications.length === 0 ? (
                <div {...stylex.props(styles.notifEmpty)}>No new notifications</div>
              ) : (
                notifications.slice(0, 20).map((n) => {
                  const postId = n.metadata?.post_id;
                  return (
                    <div
                      key={n.id}
                      {...stylex.props(styles.notifItem, styles.notifUnread)}
                      onClick={() => {
                        if (postId) {
                          navigate(`/post/${postId}`);
                          setNotifOpen(false);
                        }
                      }}
                    >
                      <div {...stylex.props(styles.notifMessage)}>
                        <NotificationPostTitle notification={n} />
                      </div>
                      <div {...stylex.props(styles.notifTime)}>{timeAgo(n.created_at)}</div>
                    </div>
                  );
                })
              )}
            </div>
          )}
        </div>
      )}

      <button {...stylex.props(styles.themeToggle)} onClick={toggleTheme} title="Toggle theme">
        {theme === 'light' ? <SunIcon /> : <MoonIcon />}
      </button>

      {!user ? (
        <>
          <Button variant="ghost" onClick={() => navigate('/login')}>
            Sign in
          </Button>
          <Button variant="primary" onClick={() => navigate('/register')}>
            Join
          </Button>
        </>
      ) : (
        <div {...stylex.props(styles.userMenu)}>
          {canWrite && (
            <Button variant="primary" size="sm" onClick={() => navigate('/compose')}>
              Write
            </Button>
          )}
          <div {...stylex.props(styles.avatarWrapper)} ref={avatarRef}>
            <button
              {...stylex.props(styles.avatarBtn)}
              onClick={() => setAvatarOpen((o) => !o)}
              title="Profile"
            >
              {user.username[0].toUpperCase()}
            </button>
            {avatarOpen && (
              <div {...stylex.props(styles.avatarPanel)}>
                <button
                  {...stylex.props(styles.avatarMenuItem)}
                  onClick={() => {
                    navigate('/profile');
                    setAvatarOpen(false);
                  }}
                >
                  Profile
                </button>
                <button
                  {...stylex.props(styles.avatarMenuItem)}
                  onClick={() => {
                    logout();
                    setAvatarOpen(false);
                    toast('Signed out', 'info');
                    navigate('/');
                  }}
                >
                  Sign Out
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
