use axum::{
    extract::Request,
    http::{HeaderName, HeaderValue, Method, StatusCode},
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
    // Always strip inbound identity headers to prevent spoofing.
    // These are only injected below after successful JWT verification.
    let headers = request.headers_mut();
    headers.remove(&X_USER_ID);
    headers.remove(&X_USER_ROLE);
    headers.remove(&X_USERNAME);

    let path = request.uri().path();
    let method = request.method().clone();
    let is_public = is_public_path(path, &method);

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

fn is_public_path(path: &str, method: &Method) -> bool {
    // Unconditionally public (any method)
    if matches!(
        path,
        "/health" | "/api/auth/register" | "/api/auth/login" | "/api/auth/refresh"
    ) {
        return true;
    }

    if path.starts_with("/api/search") {
        return true;
    }

    // Read-only access is public; writes require JWT
    if method == Method::GET || method == Method::HEAD || method == Method::OPTIONS {
        if path.starts_with("/api/posts") || path.starts_with("/api/comments") {
            return true;
        }
    }

    false
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_public_paths_any_method() {
        for path in ["/health", "/api/auth/register", "/api/auth/login", "/api/auth/refresh"] {
            assert!(is_public_path(path, &Method::GET));
            assert!(is_public_path(path, &Method::POST));
        }
    }

    #[test]
    fn test_search_is_public() {
        assert!(is_public_path("/api/search", &Method::GET));
        assert!(is_public_path("/api/search?q=test", &Method::GET));
    }

    #[test]
    fn test_posts_get_is_public() {
        assert!(is_public_path("/api/posts", &Method::GET));
        assert!(is_public_path("/api/posts/123", &Method::GET));
        assert!(is_public_path("/api/posts", &Method::HEAD));
        assert!(is_public_path("/api/posts", &Method::OPTIONS));
    }

    #[test]
    fn test_posts_mutating_requires_auth() {
        assert!(!is_public_path("/api/posts", &Method::POST));
        assert!(!is_public_path("/api/posts/123", &Method::PUT));
        assert!(!is_public_path("/api/posts/123", &Method::DELETE));
        assert!(!is_public_path("/api/posts/123", &Method::PATCH));
    }

    #[test]
    fn test_comments_get_is_public() {
        assert!(is_public_path("/api/comments", &Method::GET));
        assert!(is_public_path("/api/comments/456", &Method::GET));
    }

    #[test]
    fn test_comments_mutating_requires_auth() {
        assert!(!is_public_path("/api/comments", &Method::POST));
        assert!(!is_public_path("/api/comments/456", &Method::PUT));
        assert!(!is_public_path("/api/comments/456", &Method::DELETE));
    }

    #[test]
    fn test_other_paths_not_public() {
        assert!(!is_public_path("/api/notifications", &Method::GET));
        assert!(!is_public_path("/api/users", &Method::GET));
        assert!(!is_public_path("/api/media", &Method::POST));
    }
}
