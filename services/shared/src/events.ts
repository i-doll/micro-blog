export interface EventEnvelope<T> {
  event_id: string;
  timestamp: string;
  payload: T;
}

// User events
export interface UserCreated {
  user_id: string;
  username: string;
  email: string;
}

export interface UserUpdated {
  user_id: string;
  username?: string;
  bio?: string;
}

export interface UserDeleted {
  user_id: string;
}

// Post events
export interface PostCreated {
  post_id: string;
  author_id: string;
  title: string;
  slug: string;
  content: string;
  tags: string[];
  status: string;
}

export interface PostUpdated {
  post_id: string;
  title: string;
  slug: string;
  content: string;
  tags: string[];
  status: string;
}

export interface PostPublished {
  post_id: string;
  author_id: string;
  title: string;
  slug: string;
}

export interface PostDeleted {
  post_id: string;
}

// Comment events
export interface CommentCreated {
  comment_id: string;
  post_id: string;
  author_id: string;
  content: string;
  parent_id: string | null;
}

export interface CommentDeleted {
  comment_id: string;
  post_id: string;
}

// Media events
export interface MediaUploaded {
  media_id: string;
  user_id: string;
  filename: string;
  content_type: string;
  size: number;
}

export interface MediaDeleted {
  media_id: string;
}

export function createEnvelope<T>(payload: T): EventEnvelope<T> {
  return {
    event_id: crypto.randomUUID(),
    timestamp: new Date().toISOString(),
    payload,
  };
}
