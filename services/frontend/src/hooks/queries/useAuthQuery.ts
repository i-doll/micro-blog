import { useMutation } from '@tanstack/react-query';
import { useAuth } from '../useAuth';
import * as authApi from '../../api/auth';

export function useChangePasswordMutation() {
  const { token } = useAuth();
  return useMutation({
    mutationFn: ({ currentPassword, newPassword }: { currentPassword: string; newPassword: string }) =>
      authApi.changePassword(currentPassword, newPassword, token!),
  });
}
