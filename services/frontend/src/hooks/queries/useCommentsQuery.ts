import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { queryKeys } from '../../lib/queryKeys';
import { useAuth } from '../useAuth';
import * as commentsApi from '../../api/comments';

export function usePostCommentsQuery(postId: string | undefined) {
  const { token } = useAuth();
  return useQuery({
    queryKey: queryKeys.comments.post(postId!),
    queryFn: () => commentsApi.getPostComments(postId!, token),
    enabled: !!postId,
  });
}

export function useCommentsQuery(params: { page?: number; limit?: number; post_ids?: string } = {}) {
  const { token } = useAuth();
  return useQuery({
    queryKey: queryKeys.comments.list(params),
    queryFn: () => commentsApi.getComments(params, token!),
    enabled: !!token,
  });
}

export function useCreateCommentMutation() {
  const { token } = useAuth();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: { post_id: string; content: string; parent_id?: string | null }) =>
      commentsApi.createComment(data, token!),
    onSuccess: (_result, { post_id }) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.comments.post(post_id) });
      queryClient.invalidateQueries({ queryKey: queryKeys.comments.all });
    },
  });
}

export function useDeleteCommentMutation() {
  const { token } = useAuth();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => commentsApi.deleteComment(id, token!),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.comments.all });
    },
  });
}
