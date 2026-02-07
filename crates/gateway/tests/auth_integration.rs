use axum::{
    body::Body,
    extract::Request,
    http::{HeaderName, Method, StatusCode},
    middleware::{self, Next},
    response::{IntoResponse, Response},
    routing::{any, get},
    Json, Router,
};
use blog_shared::jwt::{encode_jwt, Claims};
use http_body_util::BodyExt;
use serde_json::{json, Value};
use tower::ServiceExt;
use uuid::Uuid;

const TEST_SECRET: &str = "test-secret-for-integration-tests";

static X_USER_ID: HeaderName = HeaderName::from_static("x-user-id");
static X_USER_ROLE: HeaderName = HeaderName::from_static("x-user-role");
static X_USERNAME: HeaderName = HeaderName::from_static("x-username");

/// Build a test router that mirrors the gateway's middleware stack but uses
/// a handler that echoes back identity headers (so we can inspect them).
fn test_app() -> Router {
    let jwt_secret = TEST_SECRET.to_string();

    Router::new()
        .route("/health", get(|| async { Json(json!({"status": "ok"})) }))
        .fallback(any(echo_identity_headers))
        .layer(middleware::from_fn(move |req: Request, next: Next| {
            let secret = jwt_secret.clone();
            blog_gateway::middleware::auth::jwt_auth(secret, req, next)
        }))
}

/// Handler that returns whatever identity headers are present on the request
/// after the auth middleware has processed it. This lets tests verify that
/// headers are correctly injected or stripped.
async fn echo_identity_headers(request: Request) -> Response {
    let user_id = request.headers().get(&X_USER_ID).map(|v| v.to_str().unwrap_or("").to_string());
    let user_role = request.headers().get(&X_USER_ROLE).map(|v| v.to_str().unwrap_or("").to_string());
    let username = request.headers().get(&X_USERNAME).map(|v| v.to_str().unwrap_or("").to_string());

    Json(json!({
        "x_user_id": user_id,
        "x_user_role": user_role,
        "x_username": username,
    }))
    .into_response()
}

fn valid_token() -> String {
    let claims = Claims::new(
        Uuid::parse_str("aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee").unwrap(),
        "testuser".to_string(),
        "user".to_string(),
        24,
    );
    encode_jwt(&claims, TEST_SECRET).unwrap()
}

async fn body_json(resp: Response) -> Value {
    let bytes = resp.into_body().collect().await.unwrap().to_bytes();
    serde_json::from_slice(&bytes).unwrap()
}

// --------------------------------------------------------------------------
// Unauthenticated write requests must be rejected
// --------------------------------------------------------------------------

#[tokio::test]
async fn post_to_posts_without_jwt_returns_401() {
    let app = test_app();
    let resp = app
        .oneshot(
            Request::builder()
                .method(Method::POST)
                .uri("/api/posts")
                .header("content-type", "application/json")
                .body(Body::from(r#"{"title":"hack"}"#))
                .unwrap(),
        )
        .await
        .unwrap();

    assert_eq!(resp.status(), StatusCode::UNAUTHORIZED);
}

#[tokio::test]
async fn put_to_posts_without_jwt_returns_401() {
    let app = test_app();
    let resp = app
        .oneshot(
            Request::builder()
                .method(Method::PUT)
                .uri("/api/posts/123")
                .header("content-type", "application/json")
                .body(Body::from(r#"{"title":"hack"}"#))
                .unwrap(),
        )
        .await
        .unwrap();

    assert_eq!(resp.status(), StatusCode::UNAUTHORIZED);
}

#[tokio::test]
async fn delete_to_posts_without_jwt_returns_401() {
    let app = test_app();
    let resp = app
        .oneshot(
            Request::builder()
                .method(Method::DELETE)
                .uri("/api/posts/123")
                .body(Body::empty())
                .unwrap(),
        )
        .await
        .unwrap();

    assert_eq!(resp.status(), StatusCode::UNAUTHORIZED);
}

#[tokio::test]
async fn post_to_comments_without_jwt_returns_401() {
    let app = test_app();
    let resp = app
        .oneshot(
            Request::builder()
                .method(Method::POST)
                .uri("/api/comments")
                .header("content-type", "application/json")
                .body(Body::from(r#"{"body":"spam"}"#))
                .unwrap(),
        )
        .await
        .unwrap();

    assert_eq!(resp.status(), StatusCode::UNAUTHORIZED);
}

#[tokio::test]
async fn delete_to_comments_without_jwt_returns_401() {
    let app = test_app();
    let resp = app
        .oneshot(
            Request::builder()
                .method(Method::DELETE)
                .uri("/api/comments/456")
                .body(Body::empty())
                .unwrap(),
        )
        .await
        .unwrap();

    assert_eq!(resp.status(), StatusCode::UNAUTHORIZED);
}

// --------------------------------------------------------------------------
// Forged identity headers are stripped
// --------------------------------------------------------------------------

#[tokio::test]
async fn forged_identity_headers_stripped_on_public_get() {
    let app = test_app();
    let resp = app
        .oneshot(
            Request::builder()
                .method(Method::GET)
                .uri("/api/posts")
                .header("x-user-id", "forged-admin-id")
                .header("x-user-role", "admin")
                .header("x-username", "admin")
                .body(Body::empty())
                .unwrap(),
        )
        .await
        .unwrap();

    assert_eq!(resp.status(), StatusCode::OK);
    let body = body_json(resp).await;
    // No JWT was provided, so identity headers must be absent
    assert_eq!(body["x_user_id"], Value::Null);
    assert_eq!(body["x_user_role"], Value::Null);
    assert_eq!(body["x_username"], Value::Null);
}

#[tokio::test]
async fn forged_identity_headers_stripped_on_authenticated_request() {
    let app = test_app();
    let token = valid_token();
    let resp = app
        .oneshot(
            Request::builder()
                .method(Method::POST)
                .uri("/api/posts")
                .header("authorization", format!("Bearer {token}"))
                .header("content-type", "application/json")
                // Attacker tries to impersonate a different user
                .header("x-user-id", "forged-admin-id")
                .header("x-user-role", "admin")
                .header("x-username", "admin")
                .body(Body::from(r#"{"title":"test"}"#))
                .unwrap(),
        )
        .await
        .unwrap();

    assert_eq!(resp.status(), StatusCode::OK);
    let body = body_json(resp).await;
    // Headers must come from the JWT, not from the forged inbound headers
    assert_eq!(body["x_user_id"], "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee");
    assert_eq!(body["x_user_role"], "user");
    assert_eq!(body["x_username"], "testuser");
}

// --------------------------------------------------------------------------
// Valid JWT injects correct identity headers
// --------------------------------------------------------------------------

#[tokio::test]
async fn valid_jwt_injects_identity_headers() {
    let app = test_app();
    let token = valid_token();
    let resp = app
        .oneshot(
            Request::builder()
                .method(Method::POST)
                .uri("/api/posts")
                .header("authorization", format!("Bearer {token}"))
                .header("content-type", "application/json")
                .body(Body::from(r#"{"title":"test"}"#))
                .unwrap(),
        )
        .await
        .unwrap();

    assert_eq!(resp.status(), StatusCode::OK);
    let body = body_json(resp).await;
    assert_eq!(body["x_user_id"], "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee");
    assert_eq!(body["x_user_role"], "user");
    assert_eq!(body["x_username"], "testuser");
}

// --------------------------------------------------------------------------
// Public read access still works
// --------------------------------------------------------------------------

#[tokio::test]
async fn get_posts_without_jwt_succeeds() {
    let app = test_app();
    let resp = app
        .oneshot(
            Request::builder()
                .method(Method::GET)
                .uri("/api/posts")
                .body(Body::empty())
                .unwrap(),
        )
        .await
        .unwrap();

    assert_eq!(resp.status(), StatusCode::OK);
}

#[tokio::test]
async fn get_comments_without_jwt_succeeds() {
    let app = test_app();
    let resp = app
        .oneshot(
            Request::builder()
                .method(Method::GET)
                .uri("/api/comments")
                .body(Body::empty())
                .unwrap(),
        )
        .await
        .unwrap();

    assert_eq!(resp.status(), StatusCode::OK);
}

#[tokio::test]
async fn get_search_without_jwt_succeeds() {
    let app = test_app();
    let resp = app
        .oneshot(
            Request::builder()
                .method(Method::GET)
                .uri("/api/search?q=test")
                .body(Body::empty())
                .unwrap(),
        )
        .await
        .unwrap();

    assert_eq!(resp.status(), StatusCode::OK);
}

// --------------------------------------------------------------------------
// Invalid / expired JWT on mutating routes returns 401
// --------------------------------------------------------------------------

#[tokio::test]
async fn invalid_jwt_on_post_returns_401() {
    let app = test_app();
    let resp = app
        .oneshot(
            Request::builder()
                .method(Method::POST)
                .uri("/api/posts")
                .header("authorization", "Bearer invalid.token.here")
                .header("content-type", "application/json")
                .body(Body::from(r#"{"title":"test"}"#))
                .unwrap(),
        )
        .await
        .unwrap();

    assert_eq!(resp.status(), StatusCode::UNAUTHORIZED);
}
