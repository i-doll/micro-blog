import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { queryKeys } from '../../lib/queryKeys';
import { useAuth } from '../useAuth';
import * as notificationsApi from '../../api/notifications';

export function useNotificationsQuery() {
  const { token } = useAuth();
  return useQuery({
    queryKey: queryKeys.notifications.list,
    queryFn: () => notificationsApi.getNotifications(token!),
    enabled: !!token,
    refetchInterval: 30000,
    select: (data) => {
      const all = data.notifications || [];
      const unread = all.filter((n) => !n.read);
      return { notifications: unread, unreadCount: unread.length };
    },
  });
}

export function useMarkNotificationsReadMutation() {
  const { token } = useAuth();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => notificationsApi.markAllRead(token!),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.notifications.all });
    },
  });
}
