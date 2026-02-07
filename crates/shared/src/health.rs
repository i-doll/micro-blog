use axum::http::StatusCode;
use axum::response::IntoResponse;
use axum::Json;
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct HealthResponse {
    pub status: String,
    pub service: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub details: Option<serde_json::Value>,
}

impl HealthResponse {
    pub fn healthy(service: &str) -> Self {
        Self {
            status: "healthy".to_string(),
            service: service.to_string(),
            details: None,
        }
    }

    pub fn unhealthy(service: &str, details: serde_json::Value) -> Self {
        Self {
            status: "unhealthy".to_string(),
            service: service.to_string(),
            details: Some(details),
        }
    }
}

pub async fn health_handler(service_name: &str) -> impl IntoResponse {
    (
        StatusCode::OK,
        Json(HealthResponse::healthy(service_name)),
    )
}
