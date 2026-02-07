import { QueryClient } from '@tanstack/react-query';

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000,
      gcTime: 30 * 60 * 1000,
      retry: (failureCount, error) => {
        if ((error as { status?: number }).status === 401) return false;
        return failureCount < 1;
      },
      refetchOnWindowFocus: false,
    },
  },
});
