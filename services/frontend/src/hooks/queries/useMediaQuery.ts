import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { queryKeys } from '../../lib/queryKeys';
import { useAuth } from '../useAuth';
import * as mediaApi from '../../api/media';

export function useMediaQuery(all?: boolean) {
  const { token } = useAuth();
  return useQuery({
    queryKey: queryKeys.media.list({ all }),
    queryFn: () => mediaApi.getMedia(token!, all),
    enabled: !!token,
  });
}

export function useUploadMediaMutation() {
  const { token } = useAuth();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (file: File) => mediaApi.uploadMedia(file, token!),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.media.all });
    },
  });
}

export function useDeleteMediaMutation() {
  const { token } = useAuth();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => mediaApi.deleteMedia(id, token!),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.media.all });
    },
  });
}
