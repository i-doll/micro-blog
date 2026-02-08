use anyhow::Result;
use async_nats::jetstream::{self, consumer::PullConsumer};
use blog_shared::{
    events::{EventEnvelope, PostCreated, PostDeleted, PostPublished, PostUpdated},
    nats_subjects::{
        POST_CREATED, POST_DELETED, POST_PUBLISHED, POST_UPDATED, STREAM_NAME, STREAM_SUBJECTS,
    },
};

use crate::index::SearchIndex;

pub async fn subscribe(
    nats_url: String,
    nats_nkey_seed: Option<String>,
    index: SearchIndex,
    fresh_index: bool,
) -> Result<()> {
    let client = match &nats_nkey_seed {
        Some(seed) => {
            async_nats::ConnectOptions::new()
                .nkey(seed.clone())
                .connect(&nats_url)
                .await?
        }
        None => async_nats::connect(&nats_url).await?,
    };
    let jetstream = jetstream::new(client);

    // Ensure stream exists
    let _ = jetstream
        .get_or_create_stream(jetstream::stream::Config {
            name: STREAM_NAME.to_string(),
            subjects: vec![STREAM_SUBJECTS.to_string()],
            ..Default::default()
        })
        .await?;

    let stream = jetstream.get_stream(STREAM_NAME).await?;

    // If this is a fresh index (no prior data on the PVC), delete any stale
    // durable consumer so we replay all events from scratch.
    if fresh_index {
        tracing::info!("Fresh index detected, deleting stale durable consumer if any");
        let _ = stream.delete_consumer("search-indexer").await;
    }

    let consumer: PullConsumer = stream
        .create_consumer(jetstream::consumer::pull::Config {
            durable_name: Some("search-indexer".to_string()),
            deliver_policy: jetstream::consumer::DeliverPolicy::All,
            filter_subjects: vec![
                POST_CREATED.to_string(),
                POST_UPDATED.to_string(),
                POST_PUBLISHED.to_string(),
                POST_DELETED.to_string(),
            ],
            ..Default::default()
        })
        .await?;

    tracing::info!("Search indexer subscribed to post events (durable consumer)");

    let messages = consumer.messages().await?;
    tokio::pin!(messages);

    use futures_util::StreamExt;
    while let Some(Ok(msg)) = messages.next().await {
        let subject = msg.subject.as_str().to_string();
        let payload = String::from_utf8_lossy(&msg.payload).to_string();

        let result = match subject.as_str() {
            POST_CREATED => handle_post_created(&index, &payload).await,
            POST_UPDATED => handle_post_updated(&index, &payload).await,
            POST_PUBLISHED => handle_post_published(&index, &payload).await,
            POST_DELETED => handle_post_deleted(&index, &payload).await,
            _ => Ok(()),
        };

        match result {
            Ok(()) => {
                let _ = msg.ack().await;
            }
            Err(e) => {
                tracing::error!("Error handling {}: {}", subject, e);
            }
        }
    }

    Ok(())
}

async fn handle_post_created(index: &SearchIndex, payload: &str) -> Result<()> {
    let envelope: EventEnvelope<PostCreated> = serde_json::from_str(payload)?;
    let p = &envelope.payload;
    tracing::info!("Indexing new post: {}", p.post_id);
    index
        .add_post(
            &p.post_id.to_string(),
            &p.title,
            &p.content,
            &p.slug,
            &p.tags,
            &p.author_id.to_string(),
            &p.status,
        )
        .await?;
    Ok(())
}

async fn handle_post_updated(index: &SearchIndex, payload: &str) -> Result<()> {
    let envelope: EventEnvelope<PostUpdated> = serde_json::from_str(payload)?;
    let p = &envelope.payload;
    tracing::info!("Updating indexed post: {}", p.post_id);
    index
        .add_post(
            &p.post_id.to_string(),
            &p.title,
            &p.content,
            &p.slug,
            &p.tags,
            "",
            &p.status,
        )
        .await?;
    Ok(())
}

async fn handle_post_published(_index: &SearchIndex, payload: &str) -> Result<()> {
    let envelope: EventEnvelope<PostPublished> = serde_json::from_str(payload)?;
    let p = &envelope.payload;
    tracing::info!("Post published: {}", p.post_id);
    Ok(())
}

async fn handle_post_deleted(index: &SearchIndex, payload: &str) -> Result<()> {
    let envelope: EventEnvelope<PostDeleted> = serde_json::from_str(payload)?;
    tracing::info!("Removing post from index: {}", envelope.payload.post_id);
    index
        .delete_post(&envelope.payload.post_id.to_string())
        .await?;
    Ok(())
}
