// NATS JetStream subjects for the blog platform
// Pattern: blog.<entity>.<action>
// All subjects are on a single JetStream stream: BLOG_EVENTS (blog.>)

pub const STREAM_NAME: &str = "BLOG_EVENTS";
pub const STREAM_SUBJECTS: &str = "blog.>";

// User subjects
pub const USER_CREATED: &str = "blog.user.created";
pub const USER_UPDATED: &str = "blog.user.updated";
pub const USER_DELETED: &str = "blog.user.deleted";

// Post subjects
pub const POST_CREATED: &str = "blog.post.created";
pub const POST_UPDATED: &str = "blog.post.updated";
pub const POST_PUBLISHED: &str = "blog.post.published";
pub const POST_DELETED: &str = "blog.post.deleted";

// Comment subjects
pub const COMMENT_CREATED: &str = "blog.comment.created";
pub const COMMENT_DELETED: &str = "blog.comment.deleted";

// Media subjects
pub const MEDIA_UPLOADED: &str = "blog.media.uploaded";
pub const MEDIA_DELETED: &str = "blog.media.deleted";
