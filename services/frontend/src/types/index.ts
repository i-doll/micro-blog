export interface User {
  id: string;
  username: string;
  email: string;
  role: 'user' | 'writer' | 'admin';
  bio?: string;
  created_at: string;
}

export interface Post {
  id: string;
  title: string;
  slug: string;
  content: string;
  author_id: string;
  status: 'draft' | 'published' | 'archived';
  tags: string[];
  published_at?: string;
  created_at: string;
  updated_at: string;
}

export interface Comment {
  id: string;
  post_id: string;
  author_id: string;
  content: string;
  parent_id: string | null;
  created_at: string;
}

export interface Notification {
  id: string;
  user_id: string;
  message: string;
  read: boolean;
  metadata?: {
    post_id?: string;
    comment_id?: string;
  };
  created_at: string;
}

export interface Media {
  id: string;
  user_id: string;
  original_name: string;
  content_type: string;
  size: number;
  created_at: string;
}

export interface HealthStatus {
  status: string;
  services: Record<string, string>;
}

export interface PaginatedResponse<T> {
  data?: T[];
  total: number;
  page: number;
  limit: number;
}

export interface PostsResponse {
  posts: Post[];
  total: number;
}

export interface CommentsResponse {
  comments: Comment[];
  total: number;
}

export interface NotificationsResponse {
  notifications: Notification[];
}

export interface MediaResponse {
  media: Media[];
}

export interface UsersResponse {
  users: User[];
  total: number;
}

export interface SearchResult {
  post_id: string;
  title: string;
  score: number;
  tags?: string[] | string;
}

export interface SearchResponse {
  results: SearchResult[];
}

export interface LoginResponse {
  access_token: string;
  user: User;
}

export interface CaptchaChallenge {
  id: string;
  image: string;
}

export interface CaptchaVerifyResponse {
  captcha_token: string;
}
