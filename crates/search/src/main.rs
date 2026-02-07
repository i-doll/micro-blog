mod config;
mod handlers;
mod index;
mod subscriber;

use std::path::Path;

use axum::{routing::get, Router};
use tracing_subscriber::{layer::SubscriberExt, util::SubscriberInitExt, EnvFilter};

use crate::config::{Config, ServiceMode};
use crate::index::SearchIndex;

#[tokio::main]
async fn main() -> anyhow::Result<()> {
    tracing_subscriber::registry()
        .with(EnvFilter::try_from_default_env().unwrap_or_else(|_| "info".into()))
        .with(tracing_subscriber::fmt::layer())
        .init();

    let config = Config::from_env();
    let port = config.port;

    match config.mode {
        ServiceMode::Indexer => {
            tracing::info!("Starting search service in INDEXER mode");

            let fresh_index = !Path::new(&config.index_path).join("meta.json").exists();
            let search_index = SearchIndex::new_writer(&config.index_path)?;

            let sub_index = search_index.clone();
            let nats_url = config.nats_url.clone();
            tokio::spawn(async move {
                if let Err(e) = subscriber::subscribe(nats_url, sub_index, fresh_index).await {
                    tracing::error!("NATS subscriber error: {}", e);
                }
            });

            let app = Router::new()
                .route("/health", get(handlers::health));

            let listener = tokio::net::TcpListener::bind(format!("0.0.0.0:{port}")).await?;
            tracing::info!("Search indexer listening on port {port}");
            axum::serve(listener, app).await?;
        }
        ServiceMode::Query => {
            tracing::info!("Starting search service in QUERY mode");

            let search_index = SearchIndex::new_reader(&config.index_path).await?;
            search_index.start_auto_reload();

            let state = handlers::AppState {
                index: search_index,
            };

            let app = Router::new()
                .route("/health", get(handlers::health))
                .route("/search", get(handlers::search))
                .route("/admin/reindex", axum::routing::post(handlers::reindex))
                .with_state(state);

            let listener = tokio::net::TcpListener::bind(format!("0.0.0.0:{port}")).await?;
            tracing::info!("Search query service listening on port {port}");
            axum::serve(listener, app).await?;
        }
    }

    Ok(())
}
