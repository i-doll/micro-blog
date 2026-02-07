export const queryKeys = {
  users: {
    all: ['users'] as const,
    list: (params: { page?: number; limit?: number }) =>
      ['users', 'list', params] as const,
    detail: (id: string) => ['users', 'detail', id] as const,
  },
  posts: {
    all: ['posts'] as const,
    list: (params: { page?: number; limit?: number; author_id?: string; status?: string }) =>
      ['posts', 'list', params] as const,
    detail: (id: string) => ['posts', 'detail', id] as const,
  },
  comments: {
    all: ['comments'] as const,
    list: (params: { page?: number; limit?: number; post_ids?: string }) =>
      ['comments', 'list', params] as const,
    post: (postId: string) => ['comments', 'post', postId] as const,
  },
  notifications: {
    all: ['notifications'] as const,
    list: ['notifications', 'list'] as const,
  },
  media: {
    all: ['media'] as const,
    list: (params: { all?: boolean }) => ['media', 'list', params] as const,
  },
  search: {
    query: (q: string) => ['search', q] as const,
  },
  health: {
    status: ['health', 'status'] as const,
  },
};
