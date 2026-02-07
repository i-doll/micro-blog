// NATS JetStream subjects for the blog platform
// Pattern: blog.<entity>.<action>
// All subjects are on a single JetStream stream: BLOG_EVENTS (blog.>)

export const STREAM_NAME = 'BLOG_EVENTS';
export const STREAM_SUBJECTS = 'blog.>';

// User subjects
export const USER_CREATED = 'blog.user.created';
export const USER_UPDATED = 'blog.user.updated';
export const USER_DELETED = 'blog.user.deleted';

// Post subjects
export const POST_CREATED = 'blog.post.created';
export const POST_UPDATED = 'blog.post.updated';
export const POST_PUBLISHED = 'blog.post.published';
export const POST_DELETED = 'blog.post.deleted';

// Comment subjects
export const COMMENT_CREATED = 'blog.comment.created';
export const COMMENT_DELETED = 'blog.comment.deleted';

// Media subjects
export const MEDIA_UPLOADED = 'blog.media.uploaded';
export const MEDIA_DELETED = 'blog.media.deleted';
