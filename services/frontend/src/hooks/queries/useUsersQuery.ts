import { useQuery, useQueries, useMutation, useQueryClient } from '@tanstack/react-query';
import { useMemo } from 'react';
import { queryKeys } from '../../lib/queryKeys';
import { useAuth } from '../useAuth';
import * as usersApi from '../../api/users';

export function useUsersQuery(params: { page?: number; limit?: number } = {}) {
  const { token } = useAuth();
  return useQuery({
    queryKey: queryKeys.users.list(params),
    queryFn: () => usersApi.getUsers(params, token!),
    enabled: !!token,
  });
}

export function useUserQuery(id: string | undefined) {
  const { token } = useAuth();
  return useQuery({
    queryKey: queryKeys.users.detail(id!),
    queryFn: () => usersApi.getUser(id!, token),
    enabled: !!id,
  });
}

export function useUsernameQueries(ids: string[]) {
  const { token } = useAuth();
  const uniqueIds = useMemo(
    () => [...new Set(ids.filter(Boolean))],
    [ids.join(',')],
  );

  const queries = useQueries({
    queries: uniqueIds.map((id) => ({
      queryKey: queryKeys.users.detail(id),
      queryFn: () => usersApi.getUser(id, token),
      staleTime: 10 * 60 * 1000,
    })),
  });

  const getUsername = useMemo(() => {
    const map = new Map<string, string>();
    uniqueIds.forEach((id, i) => {
      const q = queries[i];
      if (q.data) map.set(id, q.data.username);
    });
    return (id: string) => map.get(id) || 'Anonymous';
  }, [uniqueIds, queries]);

  return { getUsername };
}

export function useUpdateUserMutation() {
  const { token } = useAuth();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<{ username: string; bio: string }> }) =>
      usersApi.updateUser(id, data, token!),
    onSuccess: (_result, { id }) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.users.detail(id) });
    },
  });
}

export function useUpdateUserRoleMutation() {
  const { token } = useAuth();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, role }: { id: string; role: string }) =>
      usersApi.updateUserRole(id, role, token!),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.users.all });
    },
  });
}

export function useDeleteUserMutation() {
  const { token } = useAuth();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => usersApi.deleteUser(id, token!),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.users.all });
    },
  });
}
