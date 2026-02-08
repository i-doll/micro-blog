use axum::{extract::State, http::StatusCode, Json};
use serde_json::{json, Value};

use crate::routes::proxy::AppState;

pub async fn aggregated_health(State(state): State<AppState>) -> (StatusCode, Json<Value>) {
    let services = [
        ("auth-service", &state.config.auth_service_url),
        ("user-service", &state.config.user_service_url),
        ("post-service", &state.config.post_service_url),
        ("comment-service", &state.config.comment_service_url),
        (
            "notification-service",
            &state.config.notification_service_url,
        ),
        ("search-service", &state.config.search_service_url),
        ("media-service", &state.config.media_service_url),
        ("captcha-service", &state.config.captcha_service_url),
    ];

    let mut results = serde_json::Map::new();
    let mut all_healthy = true;

    for (name, url) in &services {
        let health_url = format!("{url}/health");
        match state
            .client
            .get(&health_url)
            .timeout(std::time::Duration::from_secs(3))
            .send()
            .await
        {
            Ok(resp) if resp.status().is_success() => {
                results.insert(name.to_string(), json!("healthy"));
            }
            Ok(resp) => {
                all_healthy = false;
                results.insert(
                    name.to_string(),
                    json!({"status": "unhealthy", "code": resp.status().as_u16()}),
                );
            }
            Err(e) => {
                all_healthy = false;
                results.insert(
                    name.to_string(),
                    json!({"status": "unreachable", "error": e.to_string()}),
                );
            }
        }
    }

    let status = if all_healthy { "healthy" } else { "degraded" };
    let code = if all_healthy {
        StatusCode::OK
    } else {
        StatusCode::SERVICE_UNAVAILABLE
    };

    (
        code,
        Json(json!({
            "status": status,
            "service": "api-gateway",
            "services": results,
        })),
    )
}
