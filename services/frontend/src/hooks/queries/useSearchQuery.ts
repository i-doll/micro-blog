import { useQuery } from '@tanstack/react-query';
import { queryKeys } from '../../lib/queryKeys';
import * as searchApi from '../../api/search';

export function useSearchQuery(query: string) {
  return useQuery({
    queryKey: queryKeys.search.query(query),
    queryFn: () => searchApi.searchPosts(query),
    enabled: query.trim().length > 0,
  });
}
