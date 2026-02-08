use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use uuid::Uuid;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct EventEnvelope<T: Serialize> {
    pub event_id: Uuid,
    pub timestamp: DateTime<Utc>,
    pub payload: T,
}

impl<T: Serialize> EventEnvelope<T> {
    pub fn new(payload: T) -> Self {
        Self {
            event_id: Uuid::new_v4(),
            timestamp: Utc::now(),
            payload,
        }
    }
}

// User events
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct UserCreated {
    pub user_id: Uuid,
    pub username: String,
    pub email: String,
    #[serde(default)]
    pub role: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct UserUpdated {
    pub user_id: Uuid,
    pub username: Option<String>,
    #[serde(default)]
    pub email: Option<String>,
    pub bio: Option<String>,
    #[serde(default)]
    pub role: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct UserDeleted {
    pub user_id: Uuid,
}

// Post events
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PostCreated {
    pub post_id: Uuid,
    pub author_id: Uuid,
    pub title: String,
    pub slug: String,
    pub content: String,
    pub tags: Vec<String>,
    pub status: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PostUpdated {
    pub post_id: Uuid,
    pub title: String,
    pub slug: String,
    pub content: String,
    pub tags: Vec<String>,
    pub status: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PostPublished {
    pub post_id: Uuid,
    pub author_id: Uuid,
    pub title: String,
    pub slug: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PostDeleted {
    pub post_id: Uuid,
}

// Comment events
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CommentCreated {
    pub comment_id: Uuid,
    pub post_id: Uuid,
    pub author_id: Uuid,
    pub content: String,
    pub parent_id: Option<Uuid>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CommentDeleted {
    pub comment_id: Uuid,
    pub post_id: Uuid,
}

// Media events
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MediaUploaded {
    pub media_id: Uuid,
    pub user_id: Uuid,
    pub filename: String,
    pub content_type: String,
    pub size: i64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MediaDeleted {
    pub media_id: Uuid,
}
