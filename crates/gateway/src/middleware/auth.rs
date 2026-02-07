use axum::{
    extract::Request,
    http::{HeaderName, HeaderValue, StatusCode},
    middleware::Next,
    response::Response,
    Json,
};
use blog_shared::jwt::decode_jwt;
use serde_json::json;

static X_USER_ID: HeaderName = HeaderName::from_static("x-user-id");
static X_USER_ROLE: HeaderName = HeaderName::from_static("x-user-role");
static X_USERNAME: HeaderName = HeaderName::from_static("x-username");

pub async fn jwt_auth(
    jwt_secret: String,
    mut request: Request,
    next: Next,
) -> Result<Response, (StatusCode, Json<serde_json::Value>)> {
    let path = request.uri().path();
    let is_public = is_public_path(path);

    let auth_header = request
        .headers()
        .get("authorization")
        .and_then(|v| v.to_str().ok())
        .map(String::from);

    let token = match auth_header {
        Some(ref header) if header.starts_with("Bearer ") => Some(&header[7..]),
        _ => None,
    };

    match token {
        Some(token) => match decode_jwt(token, &jwt_secret) {
            Ok(claims) => {
                let headers = request.headers_mut();
                headers.insert(
                    X_USER_ID.clone(),
                    HeaderValue::from_str(&claims.sub.to_string()).unwrap(),
                );
                headers.insert(
                    X_USER_ROLE.clone(),
                    HeaderValue::from_str(&claims.role).unwrap(),
                );
                headers.insert(
                    X_USERNAME.clone(),
                    HeaderValue::from_str(&claims.username).unwrap(),
                );
                Ok(next.run(request).await)
            }
            Err(_) if is_public => Ok(next.run(request).await),
            Err(_) => Err((
                StatusCode::UNAUTHORIZED,
                Json(json!({"error": "Invalid or expired token"})),
            )),
        },
        None if is_public => Ok(next.run(request).await),
        None => Err((
            StatusCode::UNAUTHORIZED,
            Json(json!({"error": "Missing or invalid authorization header"})),
        )),
    }
}

fn is_public_path(path: &str) -> bool {
    matches!(
        path,
        "/health"
            | "/api/auth/register"
            | "/api/auth/login"
            | "/api/auth/refresh"
    ) || path.starts_with("/api/search")
      || path.starts_with("/api/posts")
      || path.starts_with("/api/comments")
}
