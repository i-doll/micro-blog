mod config;
mod db;
mod handlers;
mod storage;

use axum::{
    routing::{delete, get, post},
    Router,
};
use tracing_subscriber::{layer::SubscriberExt, util::SubscriberInitExt, EnvFilter};

use crate::config::Config;
use crate::handlers::AppState;
use crate::storage::Storage;

#[tokio::main]
async fn main() -> anyhow::Result<()> {
    tracing_subscriber::registry()
        .with(EnvFilter::try_from_default_env().unwrap_or_else(|_| "info".into()))
        .with(tracing_subscriber::fmt::layer())
        .init();

    let config = Config::from_env();
    let port = config.port;

    let pool = db::create_pool(&config.database_url).await?;
    tracing::info!("Connected to database");

    let storage = Box::leak(Box::new(Storage::new(&config.upload_dir)));
    storage.init().await?;
    tracing::info!("Storage initialized at {}", config.upload_dir);

    let nats_client = async_nats::connect(&config.nats_url).await?;
    tracing::info!("Connected to NATS at {}", config.nats_url);

    // Set up NATS subscriber for user.deleted
    let sub_pool = pool.clone();
    let sub_storage_dir = config.upload_dir.clone();
    let sub_nats = nats_client.clone();
    tokio::spawn(async move {
        if let Err(e) = subscribe_user_deleted(sub_nats, sub_pool, sub_storage_dir).await {
            tracing::error!("NATS subscriber error: {}", e);
        }
    });

    let state = AppState {
        pool,
        storage,
        nats: nats_client,
        max_file_size: config.max_file_size,
    };

    let app = Router::new()
        .route("/health", get(handlers::health))
        .route("/media", post(handlers::upload))
        .route("/media", get(handlers::list_by_user))
        .route("/media/{id}", get(handlers::download))
        .route("/media/{id}", delete(handlers::delete))
        .with_state(state);

    let listener = tokio::net::TcpListener::bind(format!("0.0.0.0:{port}")).await?;
    tracing::info!("Media service listening on port {port}");
    axum::serve(listener, app).await?;

    Ok(())
}

async fn subscribe_user_deleted(
    nats: async_nats::Client,
    pool: sqlx::PgPool,
    storage_dir: String,
) -> anyhow::Result<()> {
    use async_nats::jetstream;
    use blog_shared::{
        events::{EventEnvelope, UserDeleted},
        nats_subjects::{STREAM_NAME, STREAM_SUBJECTS, USER_DELETED},
    };
    use futures_util::StreamExt;

    let jetstream = jetstream::new(nats);
    let _ = jetstream
        .get_or_create_stream(jetstream::stream::Config {
            name: STREAM_NAME.to_string(),
            subjects: vec![STREAM_SUBJECTS.to_string()],
            ..Default::default()
        })
        .await?;

    let stream = jetstream.get_stream(STREAM_NAME).await?;
    let consumer = stream
        .get_or_create_consumer(
            "media-service-user-deleted",
            jetstream::consumer::pull::Config {
                durable_name: Some("media-service-user-deleted".to_string()),
                filter_subject: USER_DELETED.to_string(),
                ..Default::default()
            },
        )
        .await?;

    tracing::info!("Media service subscribed to user.deleted events");

    let messages = consumer.messages().await?;
    tokio::pin!(messages);

    let storage = Storage::new(&storage_dir);

    while let Some(Ok(msg)) = messages.next().await {
        let payload = String::from_utf8_lossy(&msg.payload);
        match serde_json::from_str::<EventEnvelope<UserDeleted>>(&payload) {
            Ok(envelope) => {
                let user_id = envelope.payload.user_id;
                tracing::info!("Deleting media for user: {}", user_id);

                let rows =
                    sqlx::query_as::<_, (String,)>("SELECT filename FROM media WHERE user_id = $1")
                        .bind(user_id)
                        .fetch_all(&pool)
                        .await;

                if let Ok(files) = rows {
                    for (filename,) in files {
                        let _ = storage.delete(&filename).await;
                    }
                }

                let _ = sqlx::query("DELETE FROM media WHERE user_id = $1")
                    .bind(user_id)
                    .execute(&pool)
                    .await;

                let _ = msg.ack().await;
            }
            Err(e) => {
                tracing::error!("Failed to parse user.deleted event: {}", e);
            }
        }
    }

    Ok(())
}
