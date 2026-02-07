import { useQuery } from '@tanstack/react-query';
import { queryKeys } from '../../lib/queryKeys';
import * as healthApi from '../../api/health';

export function useHealthQuery() {
  return useQuery({
    queryKey: queryKeys.health.status,
    queryFn: () => healthApi.getHealth(),
  });
}
