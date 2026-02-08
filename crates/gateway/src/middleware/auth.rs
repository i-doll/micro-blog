use std::collections::HashMap;
use std::sync::{Arc, LazyLock, Mutex, RwLock};

use std::time::{Duration, Instant, SystemTime, UNIX_EPOCH};

use axum::{
    extract::Request,
    http::{HeaderName, HeaderValue, Method, StatusCode},
    middleware::Next,
    response::Response,
    Json,
};
use blog_shared::jwt::decode_jwt_rs256;
use jsonwebtoken::{decode, jwk::JwkSet, DecodingKey, Validation};
use serde::Deserialize;
use serde_json::json;

static USED_CAPTCHA_JTIS: LazyLock<Mutex<HashMap<String, i64>>> =
    LazyLock::new(|| Mutex::new(HashMap::new()));

static X_USER_ID: HeaderName = HeaderName::from_static("x-user-id");
static X_USER_ROLE: HeaderName = HeaderName::from_static("x-user-role");
static X_USERNAME: HeaderName = HeaderName::from_static("x-username");
static X_CAPTCHA_TOKEN: HeaderName = HeaderName::from_static("x-captcha-token");

/// Shared JWKS cache used by the auth middleware.
#[derive(Clone)]
pub struct JwksCache {
    inner: Arc<JwksCacheInner>,
}

struct JwksCacheInner {
    jwks_url: String,
    client: reqwest::Client,
    cached: RwLock<Option<CachedJwks>>,
    refresh_interval: Duration,
}

struct CachedJwks {
    jwks: JwkSet,
    fetched_at: Instant,
}

impl JwksCache {
    pub fn new(jwks_url: String) -> Self {
        Self {
            inner: Arc::new(JwksCacheInner {
                jwks_url,
                client: reqwest::Client::new(),
                cached: RwLock::new(None),
                refresh_interval: Duration::from_secs(300), // 5 minutes
            }),
        }
    }

    /// Create a JwksCache pre-loaded with a JWKS (for testing).
    pub fn new_with_jwks(jwks: JwkSet) -> Self {
        Self {
            inner: Arc::new(JwksCacheInner {
                jwks_url: String::new(),
                client: reqwest::Client::new(),
                cached: RwLock::new(Some(CachedJwks {
                    jwks,
                    fetched_at: Instant::now(),
                })),
                refresh_interval: Duration::from_secs(u64::MAX / 2), // never expire in tests
            }),
        }
    }

    /// Get the cached JWKS, fetching or refreshing as needed.
    pub async fn get_jwks(
        &self,
    ) -> Result<JwkSet, (StatusCode, Json<serde_json::Value>)> {
        // Check if we have a valid cached copy
        {
            let cached = self.inner.cached.read().unwrap_or_else(|e| e.into_inner());
            if let Some(ref c) = *cached {
                if c.fetched_at.elapsed() < self.inner.refresh_interval {
                    return Ok(c.jwks.clone());
                }
            }
        }

        // Need to fetch/refresh
        self.fetch_jwks().await
    }

    async fn fetch_jwks(
        &self,
    ) -> Result<JwkSet, (StatusCode, Json<serde_json::Value>)> {
        let resp = self
            .inner
            .client
            .get(&self.inner.jwks_url)
            .send()
            .await
            .map_err(|e| {
                tracing::error!("Failed to fetch JWKS from {}: {e}", self.inner.jwks_url);
                (
                    StatusCode::INTERNAL_SERVER_ERROR,
                    Json(json!({"error": "Failed to fetch JWKS"})),
                )
            })?;

        let jwks: JwkSet = resp.json().await.map_err(|e| {
            tracing::error!("Failed to parse JWKS response: {e}");
            (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(json!({"error": "Invalid JWKS response"})),
            )
        })?;

        // Cache the result
        {
            let mut cached = self.inner.cached.write().unwrap_or_else(|e| e.into_inner());
            *cached = Some(CachedJwks {
                jwks: jwks.clone(),
                fetched_at: Instant::now(),
            });
        }

        Ok(jwks)
    }
}

pub async fn jwt_auth(
    jwks_cache: JwksCache,
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
        Some(token) => {
            let jwks = jwks_cache.get_jwks().await?;
            match decode_jwt_rs256(token, &jwks) {
                Ok(claims) => {
                    let headers = request.headers_mut();
                    let user_id =
                        HeaderValue::from_str(&claims.sub.to_string()).map_err(|_| {
                            (
                                StatusCode::BAD_REQUEST,
                                Json(json!({"error": "Invalid claim in token"})),
                            )
                        })?;
                    let user_role = HeaderValue::from_str(&claims.role).map_err(|_| {
                        (
                            StatusCode::BAD_REQUEST,
                            Json(json!({"error": "Invalid claim in token"})),
                        )
                    })?;
                    let username = HeaderValue::from_str(&claims.username).map_err(|_| {
                        (
                            StatusCode::BAD_REQUEST,
                            Json(json!({"error": "Invalid claim in token"})),
                        )
                    })?;
                    headers.insert(X_USER_ID.clone(), user_id);
                    headers.insert(X_USER_ROLE.clone(), user_role);
                    headers.insert(X_USERNAME.clone(), username);
                }
                Err(_) if is_public => {}
                Err(_) => {
                    return Err((
                        StatusCode::UNAUTHORIZED,
                        Json(json!({"error": "Invalid or expired token"})),
                    ));
                }
            }
        }
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
    jti: Option<String>,
    exp: Option<i64>,
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
        Ok(data) if data.claims.v => {
            // Enforce single-use via jti claim
            if let Some(ref jti) = data.claims.jti {
                let now = SystemTime::now()
                    .duration_since(UNIX_EPOCH)
                    .unwrap_or_default()
                    .as_secs() as i64;
                let exp = data.claims.exp.unwrap_or(now + 300);

                let mut used = USED_CAPTCHA_JTIS.lock().unwrap_or_else(|e| e.into_inner());

                // Prune expired entries
                used.retain(|_, &mut e| e > now);

                if used.contains_key(jti) {
                    return Err((
                        StatusCode::FORBIDDEN,
                        Json(json!({"error": "Captcha token already used"})),
                    ));
                }

                used.insert(jti.clone(), exp);
            }
            Ok(())
        }
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

    // JWKS endpoint is public
    if path.starts_with("/api/auth/.well-known/") {
        return true;
    }

    if path.starts_with("/api/captcha") {
        return true;
    }

    if path.starts_with("/api/search") {
        return true;
    }

    // Read-only access is public; writes require JWT
    if (method == Method::GET || method == Method::HEAD || method == Method::OPTIONS)
        && (path.starts_with("/api/posts")
            || path.starts_with("/api/comments")
            || path.starts_with("/api/media"))
    {
        return true;
    }

    false
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_public_paths_any_method() {
        for path in [
            "/health",
            "/api/auth/register",
            "/api/auth/login",
            "/api/auth/refresh",
        ] {
            assert!(is_public_path(path, &Method::GET));
            assert!(is_public_path(path, &Method::POST));
        }
    }

    #[test]
    fn test_jwks_endpoint_is_public() {
        assert!(is_public_path(
            "/api/auth/.well-known/jwks.json",
            &Method::GET
        ));
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
