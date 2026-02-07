import React, { useState } from 'react';
import * as stylex from '@stylexjs/stylex';
import { colors, fonts } from '../../theme/tokens.stylex';
import { Button } from '../../components/ui/Button';
import { Badge } from '../../components/ui/Badge';
import { RoleSwitcher } from '../../components/ui/RoleSwitcher';
import { Pagination } from '../../components/ui/Pagination';
import { Skeleton } from '../../components/ui/Skeleton';
import { EmptyState } from '../../components/ui/EmptyState';
import { XIcon } from '../../components/icons';
import { useAuth } from '../../hooks/useAuth';
import { useToast } from '../../hooks/useToast';
import {
  useUsersQuery,
  useUpdateUserRoleMutation,
  useDeleteUserMutation,
} from '../../hooks/queries';

const tableStyles = stylex.create({
  wrap: {
    overflowX: 'auto',
    scrollbarWidth: 'thin',
  },
  table: {
    width: '100%',
    borderCollapse: 'separate',
    borderSpacing: 0,
    fontFamily: fonts.sans,
    fontSize: '0.8125rem',
    tableLayout: 'fixed',
    minWidth: '640px',
  },
  th: {
    textAlign: 'left',
    fontWeight: 700,
    textTransform: 'uppercase',
    letterSpacing: '0.07em',
    color: colors.textMuted,
    padding: '0 0.625rem 0.5rem',
    borderBottom: `1px solid ${colors.borderHeavy}`,
    fontSize: '0.625rem',
    whiteSpace: 'nowrap',
  },
  td: {
    padding: '0.5rem 0.625rem',
    borderBottom: `1px solid ${colors.borderLight}`,
    color: colors.textPrimary,
    verticalAlign: 'middle',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
    transition: 'background 0.15s',
  },
  actions: {
    whiteSpace: 'nowrap',
    overflow: 'visible',
    display: 'flex',
    alignItems: 'center',
    gap: '0.25rem',
  },
});

export function AdminUsersTab() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [page, setPage] = useState(1);

  const { data, isLoading } = useUsersQuery({ page, limit: 20 });
  const users = data?.users || [];
  const total = data?.total || 0;

  const updateRole = useUpdateUserRoleMutation();
  const deleteUser = useDeleteUserMutation();

  const handleRoleChange = async (userId: string, newRole: string) => {
    try {
      await updateRole.mutateAsync({ id: userId, role: newRole });
      toast(`User role changed to ${newRole}`, 'success');
    } catch (err: any) {
      toast(err.message, 'error');
    }
  };

  const handleDelete = async (userId: string) => {
    if (!confirm('Are you sure you want to delete this user? This cannot be undone.')) return;
    try {
      await deleteUser.mutateAsync(userId);
      toast('User deleted', 'info');
    } catch (err: any) {
      toast(err.message, 'error');
    }
  };

  if (isLoading) return <Skeleton />;
  if (users.length === 0) return <EmptyState text="No users found." />;

  const totalPages = Math.ceil(total / 20);

  return (
    <>
      <div {...stylex.props(tableStyles.wrap)}>
        <table {...stylex.props(tableStyles.table)}>
          <colgroup>
            <col style={{ width: '20%' }} />
            <col style={{ width: '30%' }} />
            <col style={{ width: '8%' }} />
            <col style={{ width: '14%' }} />
            <col style={{ width: '28%' }} />
          </colgroup>
          <thead>
            <tr>
              <th {...stylex.props(tableStyles.th)}>Username</th>
              <th {...stylex.props(tableStyles.th)}>Email</th>
              <th {...stylex.props(tableStyles.th)}>Role</th>
              <th {...stylex.props(tableStyles.th)}>Joined</th>
              <th {...stylex.props(tableStyles.th)}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {users.map((u) => {
              const isSelf = user?.id === u.id;
              const date = new Date(u.created_at).toLocaleDateString('en-US', {
                month: 'short', day: 'numeric', year: 'numeric',
              });
              const roleBadge = u.role === 'admin'
                ? <Badge variant="admin">admin</Badge>
                : u.role === 'writer'
                ? <Badge variant="writer">writer</Badge>
                : <Badge variant="user">user</Badge>;

              return (
                <tr key={u.id}>
                  <td {...stylex.props(tableStyles.td)} title={u.username}>{u.username}</td>
                  <td {...stylex.props(tableStyles.td)} title={u.email}>{u.email}</td>
                  <td {...stylex.props(tableStyles.td)}>{roleBadge}</td>
                  <td {...stylex.props(tableStyles.td)}>{date}</td>
                  <td {...stylex.props(tableStyles.td)}>
                    <div {...stylex.props(tableStyles.actions)}>
                      {isSelf ? (
                        <Badge variant="you">You</Badge>
                      ) : (
                        <>
                          <RoleSwitcher
                            currentRole={u.role}
                            onChangeRole={(role) => handleRoleChange(u.id, role)}
                          />
                          <Button variant="deleteIcon" onClick={() => handleDelete(u.id)} title="Delete user">
                            <XIcon />
                          </Button>
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <Pagination page={page} totalPages={totalPages} onPageChange={setPage} />
    </>
  );
}
