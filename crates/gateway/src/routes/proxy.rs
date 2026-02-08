use axum::{
    body::Body,
    extract::{Request, State},
    http::StatusCode,
    response::Response,
};
use reqwest::Client;

use crate::config::Config;

#[derive(Clone)]
pub struct AppState {
    pub config: Config,
    pub client: Client,
}

pub async fn proxy_handler(
    State(state): State<AppState>,
    request: Request,
) -> Result<Response, StatusCode> {
    let path = request.uri().path().to_string();
    let query = request
        .uri()
        .query()
        .map(|q| format!("?{q}"))
        .unwrap_or_default();

    let (target_base, target_path) =
        route_to_service(&path, &state.config).ok_or(StatusCode::NOT_FOUND)?;

    let url = format!("{target_base}{target_path}{query}");
    let method = request.method().clone();
    let headers = request.headers().clone();

    let body_bytes = match axum::body::to_bytes(request.into_body(), 10 * 1024 * 1024).await {
        Ok(bytes) => bytes,
        Err(_) => return Err(StatusCode::PAYLOAD_TOO_LARGE),
    };

    let mut proxy_req = state.client.request(method, &url);

    // Forward safe headers. Identity headers (x-user-id, x-user-role,
    // x-username) are injected by the auth middleware after JWT verification
    // and must NOT come from the original inbound request.
    let forward_headers = [
        "content-type",
        "authorization",
        "accept",
        "x-user-id",
        "x-user-role",
        "x-username",
        "x-request-id",
    ];
    for name in &forward_headers {
        if let Some(value) = headers.get(*name) {
            proxy_req = proxy_req.header(*name, value.to_str().unwrap_or(""));
        }
    }

    if !body_bytes.is_empty() {
        proxy_req = proxy_req.body(body_bytes);
    }

    match proxy_req.send().await {
        Ok(resp) => {
            let status =
                StatusCode::from_u16(resp.status().as_u16()).unwrap_or(StatusCode::BAD_GATEWAY);
            let mut builder = Response::builder().status(status);

            for (key, value) in resp.headers() {
                builder = builder.header(key.as_str(), value.to_str().unwrap_or(""));
            }

            let body = resp.bytes().await.unwrap_or_default();
            Ok(builder.body(Body::from(body)).unwrap())
        }
        Err(e) => {
            tracing::error!("Proxy error to {}: {}", url, e);
            Err(StatusCode::BAD_GATEWAY)
        }
    }
}

fn route_to_service(path: &str, config: &Config) -> Option<(String, String)> {
    let rest = path.strip_prefix("/api")?;
    let base = if rest.starts_with("/auth") {
        &config.auth_service_url
    } else if rest.starts_with("/users") {
        &config.user_service_url
    } else if rest.starts_with("/posts") {
        &config.post_service_url
    } else if rest.starts_with("/comments/posts/") {
        // /api/comments/posts/:id/comments → comment-service at /posts/:id/comments
        let inner = rest.strip_prefix("/comments").unwrap();
        return Some((config.comment_service_url.clone(), inner.to_string()));
    } else if rest.starts_with("/comments") {
        &config.comment_service_url
    } else if rest.starts_with("/notifications") {
        &config.notification_service_url
    } else if rest.starts_with("/search") {
        &config.search_service_url
    } else if rest.starts_with("/media") {
        &config.media_service_url
    } else if rest.starts_with("/captcha") {
        &config.captcha_service_url
    } else {
        return None;
    };
    Some((base.clone(), rest.to_string()))
}
