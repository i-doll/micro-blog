import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { queryKeys } from '../../lib/queryKeys';
import { useAuth } from '../useAuth';
import * as postsApi from '../../api/posts';

export function usePostsQuery(params: {
  page?: number;
  limit?: number;
  author_id?: string;
  status?: string;
} = {}) {
  const { token } = useAuth();
  return useQuery({
    queryKey: queryKeys.posts.list(params),
    queryFn: () => postsApi.getPosts(params, token),
  });
}

export function usePostQuery(id: string | undefined) {
  const { token } = useAuth();
  return useQuery({
    queryKey: queryKeys.posts.detail(id!),
    queryFn: () => postsApi.getPost(id!, token),
    enabled: !!id,
  });
}

export function useCreatePostMutation() {
  const { token } = useAuth();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: { title: string; content: string; tags: string[]; status: string }) =>
      postsApi.createPost(data, token!),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.posts.all });
    },
  });
}

export function useUpdatePostMutation() {
  const { token } = useAuth();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<{ title: string; content: string; tags: string[]; status: string }> }) =>
      postsApi.updatePost(id, data, token!),
    onSuccess: (_result, { id }) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.posts.detail(id) });
      queryClient.invalidateQueries({ queryKey: queryKeys.posts.all });
    },
  });
}

export function useDeletePostMutation() {
  const { token } = useAuth();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => postsApi.deletePost(id, token!),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.posts.all });
      queryClient.invalidateQueries({ queryKey: queryKeys.comments.all });
    },
  });
}
