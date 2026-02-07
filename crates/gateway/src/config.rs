use std::env;

#[derive(Debug, Clone)]
pub struct Config {
    pub port: u16,
    pub jwt_secret: String,
    pub user_service_url: String,
    pub post_service_url: String,
    pub comment_service_url: String,
    pub notification_service_url: String,
    pub search_service_url: String,
    pub media_service_url: String,
}

impl Config {
    pub fn from_env() -> Self {
        Self {
            port: env::var("PORT")
                .unwrap_or_else(|_| "3000".to_string())
                .parse()
                .expect("PORT must be a number"),
            jwt_secret: env::var("JWT_SECRET")
                .expect("FATAL: Required environment variable JWT_SECRET is not set"),
            user_service_url: env::var("USER_SERVICE_URL")
                .unwrap_or_else(|_| "http://localhost:3001".to_string()),
            post_service_url: env::var("POST_SERVICE_URL")
                .unwrap_or_else(|_| "http://localhost:3002".to_string()),
            comment_service_url: env::var("COMMENT_SERVICE_URL")
                .unwrap_or_else(|_| "http://localhost:3003".to_string()),
            notification_service_url: env::var("NOTIFICATION_SERVICE_URL")
                .unwrap_or_else(|_| "http://localhost:3004".to_string()),
            search_service_url: env::var("SEARCH_SERVICE_URL")
                .unwrap_or_else(|_| "http://localhost:3005".to_string()),
            media_service_url: env::var("MEDIA_SERVICE_URL")
                .unwrap_or_else(|_| "http://localhost:3006".to_string()),
        }
    }
}
