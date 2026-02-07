use axum::{
    extract::Request,
    http::{HeaderName, HeaderValue, Method, StatusCode},
    middleware::Next,
    response::Response,
    Json,
};
use blog_shared::jwt::decode_jwt;
use jsonwebtoken::{decode, DecodingKey, Validation};
use serde::Deserialize;
use serde_json::json;

static X_USER_ID: HeaderName = HeaderName::from_static("x-user-id");
static X_USER_ROLE: HeaderName = HeaderName::from_static("x-user-role");
static X_USERNAME: HeaderName = HeaderName::from_static("x-username");
static X_CAPTCHA_TOKEN: HeaderName = HeaderName::from_static("x-captcha-token");

pub async fn jwt_auth(
    jwt_secret: String,
    captcha_secret: String,
    mut request: Request,
    next: Next,
) -> Result<Response, (StatusCode, Json<serde_json::Value>)> {
    // Save captcha token before stripping (gateway validates it, not downstream).
    let captcha_token = request
        .headers()
        .get(&X_CAPTCHA_TOKEN)
        .and_then(|v| v.to_str().ok())
        .map(String::from);

    // Always strip inbound identity headers to prevent spoofing.
    // These are only injected below after successful JWT verification.
    let headers = request.headers_mut();
    headers.remove(&X_USER_ID);
    headers.remove(&X_USER_ROLE);
    headers.remove(&X_USERNAME);
    headers.remove(&X_CAPTCHA_TOKEN);

    let path = request.uri().path().to_string();
    let method = request.method().clone();
    let is_public = is_public_path(&path, &method);

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
            }
            Err(_) if is_public => {}
            Err(_) => {
                return Err((
                    StatusCode::UNAUTHORIZED,
                    Json(json!({"error": "Invalid or expired token"})),
                ));
            }
        },
        None if is_public => {}
        None => {
            return Err((
                StatusCode::UNAUTHORIZED,
                Json(json!({"error": "Missing or invalid authorization header"})),
            ));
        }
    }

    // Captcha verification for protected endpoints (e.g. registration)
    if requires_captcha(&path, &method) {
        verify_captcha_token(captcha_token.as_deref(), &captcha_secret)?;
    }

    Ok(next.run(request).await)
}

fn requires_captcha(path: &str, method: &Method) -> bool {
    method == Method::POST && path == "/api/auth/register"
}

#[derive(Deserialize)]
struct CaptchaClaims {
    v: bool,
}

fn verify_captcha_token(
    captcha_token: Option<&str>,
    captcha_secret: &str,
) -> Result<(), (StatusCode, Json<serde_json::Value>)> {
    let token = match captcha_token {
        Some(t) => t,
        None => {
            return Err((
                StatusCode::BAD_REQUEST,
                Json(json!({"error": "Missing captcha token"})),
            ));
        }
    };

    let token_data = decode::<CaptchaClaims>(
        token,
        &DecodingKey::from_secret(captcha_secret.as_bytes()),
        &Validation::default(),
    );

    match token_data {
        Ok(data) if data.claims.v => Ok(()),
        _ => Err((
            StatusCode::FORBIDDEN,
            Json(json!({"error": "Invalid or expired captcha token"})),
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

    if path.starts_with("/api/captcha") {
        return true;
    }

    if path.starts_with("/api/search") {
        return true;
    }

    // Read-only access is public; writes require JWT
    if method == Method::GET || method == Method::HEAD || method == Method::OPTIONS {
        if path.starts_with("/api/posts") || path.starts_with("/api/comments") || path.starts_with("/api/media") {
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
    fn test_captcha_is_public() {
        assert!(is_public_path("/api/captcha/challenge", &Method::GET));
        assert!(is_public_path("/api/captcha/verify", &Method::POST));
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
    fn test_media_get_is_public() {
        assert!(is_public_path("/api/media", &Method::GET));
        assert!(is_public_path("/api/media/123", &Method::GET));
        assert!(is_public_path("/api/media", &Method::HEAD));
        assert!(is_public_path("/api/media", &Method::OPTIONS));
    }

    #[test]
    fn test_media_mutating_requires_auth() {
        assert!(!is_public_path("/api/media", &Method::POST));
        assert!(!is_public_path("/api/media/123", &Method::PUT));
        assert!(!is_public_path("/api/media/123", &Method::DELETE));
        assert!(!is_public_path("/api/media/123", &Method::PATCH));
    }

    #[test]
    fn test_other_paths_not_public() {
        assert!(!is_public_path("/api/notifications", &Method::GET));
        assert!(!is_public_path("/api/users", &Method::GET));
    }

    #[test]
    fn test_requires_captcha() {
        assert!(requires_captcha("/api/auth/register", &Method::POST));
        assert!(!requires_captcha("/api/auth/register", &Method::GET));
        assert!(!requires_captcha("/api/auth/login", &Method::POST));
        assert!(!requires_captcha("/api/posts", &Method::POST));
    }
}
