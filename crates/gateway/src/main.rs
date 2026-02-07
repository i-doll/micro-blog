mod config;
mod middleware;
mod routes;

use axum::{
    middleware::from_fn,
    routing::{any, get},
    Router,
};
use std::time::Duration;
use axum::http::{self, HeaderValue, Method};
use tower_http::{cors::CorsLayer, trace::TraceLayer};
use tracing_subscriber::{layer::SubscriberExt, util::SubscriberInitExt, EnvFilter};

use crate::config::Config;
use crate::middleware::auth::jwt_auth;
use crate::middleware::rate_limit::{rate_limit, RateLimitState};
use crate::routes::health::aggregated_health;
use crate::routes::proxy::{proxy_handler, AppState};

#[tokio::main]
async fn main() -> anyhow::Result<()> {
    tracing_subscriber::registry()
        .with(EnvFilter::try_from_default_env().unwrap_or_else(|_| "info".into()))
        .with(tracing_subscriber::fmt::layer())
        .init();

    let config = Config::from_env();
    let port = config.port;

    let state = AppState {
        config: config.clone(),
        client: reqwest::Client::builder()
            .no_gzip()
            .no_brotli()
            .no_deflate()
            .pool_max_idle_per_host(0)
            .build()
            .unwrap(),
    };

    let jwt_secret = config.jwt_secret.clone();
    let rate_limit_state = RateLimitState::new(100, config.trusted_proxies.clone());

    let app = Router::new()
        .route("/health", get(aggregated_health))
        .fallback(any(proxy_handler))
        .layer(from_fn(move |req, next| {
            jwt_auth(jwt_secret.clone(), req, next)
        }))
        .layer(from_fn({
            let rls = rate_limit_state.clone();
            move |req, next| {
                let rls = rls.clone();
                rate_limit(rls, req, next)
            }
        }))
        .layer({
            let origins: Vec<HeaderValue> = config
                .cors_origins
                .iter()
                .filter_map(|o| o.parse().ok())
                .collect();
            if origins.is_empty() {
                // No origins configured — reject all cross-origin requests.
                CorsLayer::new()
            } else {
                CorsLayer::new()
                    .allow_origin(origins)
                    .allow_methods([
                        Method::GET,
                        Method::POST,
                        Method::PUT,
                        Method::DELETE,
                        Method::OPTIONS,
                    ])
                    .allow_headers([http::header::CONTENT_TYPE, http::header::AUTHORIZATION])
                    .allow_credentials(true)
                    .max_age(Duration::from_secs(3600))
            }
        })
        .layer(TraceLayer::new_for_http())
        .with_state(state);

    let listener = tokio::net::TcpListener::bind(format!("0.0.0.0:{port}")).await?;
    tracing::info!("API Gateway listening on port {port}");
    axum::serve(
        listener,
        app.into_make_service_with_connect_info::<std::net::SocketAddr>(),
    )
    .await?;

    Ok(())
}
