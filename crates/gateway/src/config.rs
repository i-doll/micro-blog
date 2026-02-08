use std::env;
use std::net::IpAddr;

#[derive(Debug, Clone)]
pub struct Config {
    pub port: u16,
    pub jwks_url: String,
    pub cors_origins: Vec<String>,
    pub trusted_proxies: Vec<IpAddr>,
    pub auth_service_url: String,
    pub user_service_url: String,
    pub post_service_url: String,
    pub comment_service_url: String,
    pub notification_service_url: String,
    pub search_service_url: String,
    pub media_service_url: String,
    pub captcha_service_url: String,
    pub captcha_secret: String,
}

impl Config {
    pub fn from_env() -> Self {
        Self {
            port: env::var("PORT")
                .unwrap_or_else(|_| "3000".to_string())
                .parse()
                .expect("PORT must be a number"),
            jwks_url: env::var("JWKS_URL").unwrap_or_else(|_| {
                "http://localhost:3009/auth/.well-known/jwks.json".to_string()
            }),
            cors_origins: env::var("CORS_ORIGINS")
                .unwrap_or_default()
                .split(',')
                .map(|s| s.trim().to_string())
                .filter(|s| !s.is_empty())
                .collect(),
            trusted_proxies: env::var("TRUSTED_PROXIES")
                .unwrap_or_default()
                .split(',')
                .map(|s| s.trim().to_string())
                .filter(|s| !s.is_empty())
                .filter_map(|s| s.parse::<IpAddr>().ok())
                .collect(),
            auth_service_url: env::var("AUTH_SERVICE_URL")
                .unwrap_or_else(|_| "http://localhost:3009".to_string()),
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
            captcha_service_url: env::var("CAPTCHA_SERVICE_URL")
                .unwrap_or_else(|_| "http://localhost:3008".to_string()),
            captcha_secret: env::var("CAPTCHA_SECRET")
                .expect("FATAL: Required environment variable CAPTCHA_SECRET is not set"),
        }
    }
}
