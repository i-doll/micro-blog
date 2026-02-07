use axum::{
    extract::Request,
    http::StatusCode,
    middleware::Next,
    response::Response,
    Json,
};
use governor::{clock::DefaultClock, state::keyed::DashMapStateStore, Quota, RateLimiter};
use serde_json::json;
use std::num::NonZeroU32;
use std::sync::Arc;

type RateLimiterType = RateLimiter<String, DashMapStateStore<String>, DefaultClock>;

#[derive(Clone)]
pub struct RateLimitState {
    pub limiter: Arc<RateLimiterType>,
}

impl RateLimitState {
    pub fn new(per_minute: u32) -> Self {
        let quota = Quota::per_minute(NonZeroU32::new(per_minute).unwrap());
        let limiter = Arc::new(RateLimiter::dashmap(quota));
        Self { limiter }
    }
}

pub async fn rate_limit(
    state: RateLimitState,
    request: Request,
    next: Next,
) -> Result<Response, (StatusCode, Json<serde_json::Value>)> {
    // Extract client IP from connection info or headers
    let key = request
        .headers()
        .get("x-forwarded-for")
        .and_then(|v| v.to_str().ok())
        .map(|s| s.split(',').next().unwrap_or("unknown").trim().to_string())
        .unwrap_or_else(|| "unknown".to_string());

    match state.limiter.check_key(&key) {
        Ok(_) => Ok(next.run(request).await),
        Err(_) => Err((
            StatusCode::TOO_MANY_REQUESTS,
            Json(json!({"error": "Rate limit exceeded. Try again later."})),
        )),
    }
}
