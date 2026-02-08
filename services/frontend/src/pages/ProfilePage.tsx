import React, { useState } from 'react';
import * as stylex from '@stylexjs/stylex';
import { colors, fonts } from '../theme/tokens.stylex';
import { useViewTransitionNavigate } from '../hooks/useViewTransitionNavigate';
import { Container } from '../components/layout/Container';
import { SectionRule } from '../components/ui/SectionRule';
import { Button } from '../components/ui/Button';
import { Modal } from '../components/ui/Modal';
import { FormGroup } from '../components/ui/FormGroup';
import { Skeleton } from '../components/ui/Skeleton';
import { useAuth } from '../hooks/useAuth';
import { useToast } from '../hooks/useToast';
import { useUserQuery, usePostsQuery, useUpdateUserMutation, useChangePasswordMutation } from '../hooks/queries';

const styles = stylex.create({
  profileHeader: {
    display: 'flex',
    alignItems: 'flex-start',
    gap: '1.5rem',
    marginBottom: '2rem',
    flexWrap: 'wrap',
  },
  avatar: {
    width: '80px',
    height: '80px',
    borderRadius: '50%',
    background: colors.accent,
    color: colors.textInverse,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontFamily: fonts.display,
    fontSize: '2rem',
    fontWeight: 700,
    flexShrink: 0,
  },
  info: {
    flex: 1,
    minWidth: '200px',
  },
  role: {
    fontFamily: fonts.sans,
    fontSize: '0.75rem',
    textTransform: 'uppercase',
    letterSpacing: '0.06em',
    color: colors.accent,
    marginBottom: '0.25rem',
  },
  name: {
    fontFamily: fonts.display,
    fontSize: '1.75rem',
    fontWeight: 700,
    color: colors.textPrimary,
  },
  bio: {
    color: colors.textSecondary,
    marginTop: '0.5rem',
  },
  meta: {
    fontFamily: fonts.sans,
    fontSize: '0.8125rem',
    color: colors.textMuted,
    marginTop: '0.5rem',
  },
  actions: {
    display: 'flex',
    gap: '0.25rem',
  },
  sectionLabel: {
    fontFamily: fonts.sans,
    fontSize: '0.8125rem',
    textTransform: 'uppercase',
    letterSpacing: '0.06em',
    color: colors.textMuted,
    marginBottom: '1rem',
  },
  postCard: {
    padding: '1.5rem 0',
    borderBottom: `1px solid ${colors.ruleLight}`,
    cursor: 'pointer',
  },
  postCardMeta: {
    fontFamily: fonts.sans,
    fontSize: '0.75rem',
    textTransform: 'uppercase',
    letterSpacing: '0.06em',
    color: colors.textMuted,
    marginBottom: '0.375rem',
    display: 'flex',
    alignItems: 'center',
    gap: '0.5rem',
  },
  postCardTitle: {
    fontFamily: fonts.display,
    fontSize: '1.1rem',
    fontWeight: 700,
    lineHeight: 1.25,
    color: colors.textPrimary,
  },
  noPosts: {
    fontFamily: fonts.sans,
    fontSize: '0.875rem',
    color: colors.textMuted,
  },
  modalActions: {
    display: 'flex',
    gap: '0.5rem',
    justifyContent: 'flex-end',
    marginTop: '1rem',
  },
  input: {
    fontFamily: fonts.sans,
    fontSize: '0.9375rem',
    border: `1px solid ${colors.border}`,
    background: colors.bgInput,
    color: colors.textPrimary,
    padding: '0.625rem 0.875rem',
    borderRadius: '4px',
    outline: 'none',
    width: '100%',
  },
  textarea: {
    fontFamily: fonts.sans,
    fontSize: '0.9375rem',
    border: `1px solid ${colors.border}`,
    background: colors.bgInput,
    color: colors.textPrimary,
    padding: '0.625rem 0.875rem',
    borderRadius: '4px',
    outline: 'none',
    width: '100%',
    minHeight: '80px',
    resize: 'vertical',
  },
});

export function ProfilePage() {
  const navigate = useViewTransitionNavigate();
  const { user, token, updateUser } = useAuth();
  const { toast } = useToast();
  const [modalOpen, setModalOpen] = useState(false);
  const [passwordModalOpen, setPasswordModalOpen] = useState(false);
  const [editUsername, setEditUsername] = useState('');
  const [editEmail, setEditEmail] = useState('');
  const [editBio, setEditBio] = useState('');
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  const { data: profile, isLoading: profileLoading } = useUserQuery(user?.id);
  const { data: publishedData } = usePostsQuery(
    user ? { page: 1, limit: 50, author_id: user.id, status: 'published' } : {},
  );
  const { data: draftsData } = usePostsQuery(
    user ? { page: 1, limit: 50, author_id: user.id, status: 'draft' } : {},
  );

  const userPosts = [
    ...(draftsData?.posts || []),
    ...(publishedData?.posts || []),
  ];

  const updateUserMutation = useUpdateUserMutation();
  const changePasswordMutation = useChangePasswordMutation();

  const openPasswordModal = () => {
    setCurrentPassword('');
    setNewPassword('');
    setConfirmPassword('');
    setPasswordModalOpen(true);
  };

  const savePassword = async () => {
    if (newPassword.length < 8) {
      toast('New password must be at least 8 characters', 'error');
      return;
    }
    if (newPassword !== confirmPassword) {
      toast('New passwords do not match', 'error');
      return;
    }
    try {
      await changePasswordMutation.mutateAsync({
        currentPassword,
        newPassword,
      });
      setPasswordModalOpen(false);
      toast('Password changed successfully', 'success');
    } catch (err: any) {
      toast(err.message || 'Failed to change password', 'error');
    }
  };

  const openEdit = () => {
    if (!profile) return;
    setEditUsername(profile.username || '');
    setEditEmail(profile.email || '');
    setEditBio(profile.bio || '');
    setModalOpen(true);
  };

  const saveProfile = async () => {
    try {
      await updateUserMutation.mutateAsync({
        id: user!.id,
        data: { username: editUsername.trim(), email: editEmail.trim(), bio: editBio.trim() },
      });
      updateUser({ ...user!, username: editUsername.trim(), email: editEmail.trim(), bio: editBio.trim() });
      setModalOpen(false);
      toast('Profile updated', 'success');
    } catch (err: any) {
      toast(err.message, 'error');
    }
  };

  if (profileLoading) {
    return (
      <Container variant="narrow">
        <Skeleton variant="title" />
        <Skeleton />
        <Skeleton />
      </Container>
    );
  }

  return (
    <Container variant="narrow">
      {profile && (
        <>
          <div {...stylex.props(styles.profileHeader)}>
            <div {...stylex.props(styles.avatar)}>
              {(profile.username || '?')[0].toUpperCase()}
            </div>
            <div {...stylex.props(styles.info)}>
              <div {...stylex.props(styles.role)}>{profile.role || 'user'}</div>
              <div {...stylex.props(styles.name)}>{profile.username}</div>
              <div {...stylex.props(styles.bio)}>{profile.bio || 'No bio yet.'}</div>
              <div {...stylex.props(styles.meta)}>
                Joined{' '}
                {new Date(profile.created_at).toLocaleDateString('en-US', {
                  month: 'long',
                  year: 'numeric',
                })}
              </div>
            </div>
            <div {...stylex.props(styles.actions)}>
              <Button variant="secondary" size="sm" onClick={openEdit}>
                Edit Profile
              </Button>
              <Button variant="secondary" size="sm" onClick={openPasswordModal}>
                Change Password
              </Button>
            </div>
          </div>

          <LogoutButton />

          <SectionRule />

          <h3 {...stylex.props(styles.sectionLabel)}>Your Stories</h3>

          {userPosts.length === 0 ? (
            <p {...stylex.props(styles.noPosts)}>
              You haven&apos;t written any stories yet.
            </p>
          ) : (
            userPosts.map((post) => (
              <div
                key={post.id}
                {...stylex.props(styles.postCard)}
                onClick={() => navigate(`/post/${post.id}`)}
              >
                <div {...stylex.props(styles.postCardMeta)}>
                  <span>
                    {new Date(post.created_at).toLocaleDateString('en-US', {
                      month: 'short',
                      day: 'numeric',
                    })}
                  </span>
                  {post.status !== 'published' && (
                    <span
                      style={{
                        background: 'var(--x-warning, #d4a017)',
                        color: '#000',
                        fontSize: '0.6875rem',
                        padding: '0.2rem 0.5rem',
                        borderRadius: '2px',
                      }}
                    >
                      {post.status}
                    </span>
                  )}
                </div>
                <h2 {...stylex.props(styles.postCardTitle)}>{post.title}</h2>
              </div>
            ))
          )}
        </>
      )}

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title="Edit Profile">
        <FormGroup label="Username">
          <input
            {...stylex.props(styles.input)}
            type="text"
            value={editUsername}
            onChange={(e) => setEditUsername(e.target.value)}
          />
        </FormGroup>
        <FormGroup label="Email">
          <input
            {...stylex.props(styles.input)}
            type="text"
            inputMode="email"
            value={editEmail}
            onChange={(e) => setEditEmail(e.target.value)}
          />
        </FormGroup>
        <FormGroup label="Bio">
          <textarea
            {...stylex.props(styles.textarea)}
            value={editBio}
            onChange={(e) => setEditBio(e.target.value)}
          />
        </FormGroup>
        <div {...stylex.props(styles.modalActions)}>
          <Button variant="secondary" onClick={() => setModalOpen(false)}>
            Cancel
          </Button>
          <Button variant="primary" onClick={saveProfile}>
            Save
          </Button>
        </div>
      </Modal>

      <Modal open={passwordModalOpen} onClose={() => setPasswordModalOpen(false)} title="Change Password">
        <FormGroup label="Current Password">
          <input
            {...stylex.props(styles.input)}
            type="password"
            value={currentPassword}
            onChange={(e) => setCurrentPassword(e.target.value)}
          />
        </FormGroup>
        <FormGroup label="New Password">
          <input
            {...stylex.props(styles.input)}
            type="password"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
          />
        </FormGroup>
        <FormGroup label="Confirm New Password">
          <input
            {...stylex.props(styles.input)}
            type="password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
          />
        </FormGroup>
        <div {...stylex.props(styles.modalActions)}>
          <Button variant="secondary" onClick={() => setPasswordModalOpen(false)}>
            Cancel
          </Button>
          <Button variant="primary" onClick={savePassword}>
            Save
          </Button>
        </div>
      </Modal>
    </Container>
  );
}

function LogoutButton() {
  const { logout } = useAuth();
  const { toast } = useToast();
  const navigate = useViewTransitionNavigate();

  return (
    <Button
      variant="ghost"
      size="sm"
      onClick={() => {
        logout();
        toast('Signed out', 'info');
        navigate('/');
      }}
    >
      Sign Out
    </Button>
  );
}
