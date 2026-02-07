use axum::{
    body::Body,
    extract::{Multipart, Path, State},
    http::{header, HeaderMap, StatusCode},
    Json,
};
use serde_json::{json, Value};
use sqlx::PgPool;
use uuid::Uuid;

use crate::storage::Storage;

#[derive(Clone)]
pub struct AppState {
    pub pool: PgPool,
    pub storage: &'static Storage,
    pub nats: async_nats::Client,
    pub max_file_size: usize,
}

pub async fn health() -> Json<Value> {
    Json(json!({"status": "healthy", "service": "media-service"}))
}

pub async fn upload(
    State(state): State<AppState>,
    headers: HeaderMap,
    mut multipart: Multipart,
) -> Result<(StatusCode, Json<Value>), (StatusCode, Json<Value>)> {
    let user_id = headers
        .get("x-user-id")
        .and_then(|v| v.to_str().ok())
        .ok_or_else(|| {
            (
                StatusCode::UNAUTHORIZED,
                Json(json!({"error": "Missing user ID"})),
            )
        })?;

    let user_uuid: Uuid = user_id.parse().map_err(|_| {
        (
            StatusCode::BAD_REQUEST,
            Json(json!({"error": "Invalid user ID"})),
        )
    })?;

    let field = multipart.next_field().await.map_err(|e| {
        (
            StatusCode::BAD_REQUEST,
            Json(json!({"error": format!("Invalid multipart: {}", e)})),
        )
    })?;

    let field = field.ok_or_else(|| {
        (
            StatusCode::BAD_REQUEST,
            Json(json!({"error": "No file provided"})),
        )
    })?;

    let original_name = field.file_name().unwrap_or("upload").to_string();
    let content_type = field
        .content_type()
        .unwrap_or("application/octet-stream")
        .to_string();

    let extension = original_name
        .rsplit('.')
        .next()
        .unwrap_or("bin")
        .to_string();

    let data = field.bytes().await.map_err(|e| {
        (
            StatusCode::BAD_REQUEST,
            Json(json!({"error": format!("Failed to read file: {}", e)})),
        )
    })?;

    if data.len() > state.max_file_size {
        return Err((
            StatusCode::PAYLOAD_TOO_LARGE,
            Json(json!({"error": "File too large"})),
        ));
    }

    let size = data.len() as i64;
    let filename = state.storage.save(&data, &extension).await.map_err(|e| {
        tracing::error!("Storage error: {}", e);
        (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(json!({"error": "Failed to save file"})),
        )
    })?;

    let row = sqlx::query_as::<_, (Uuid, )>(
        "INSERT INTO media (user_id, filename, original_name, content_type, size) VALUES ($1, $2, $3, $4, $5) RETURNING id",
    )
    .bind(user_uuid)
    .bind(&filename)
    .bind(&original_name)
    .bind(&content_type)
    .bind(size)
    .fetch_one(&state.pool)
    .await
    .map_err(|e| {
        tracing::error!("DB error: {}", e);
        (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"error": "Database error"})))
    })?;

    let media_id = row.0;

    // Publish event
    let event = blog_shared::events::EventEnvelope::new(blog_shared::events::MediaUploaded {
        media_id,
        user_id: user_uuid,
        filename: filename.clone(),
        content_type: content_type.clone(),
        size,
    });
    let _ = state
        .nats
        .publish(
            blog_shared::nats_subjects::MEDIA_UPLOADED.to_string(),
            serde_json::to_vec(&event).unwrap().into(),
        )
        .await;

    Ok((
        StatusCode::CREATED,
        Json(json!({
            "id": media_id,
            "filename": filename,
            "original_name": original_name,
            "content_type": content_type,
            "size": size,
        })),
    ))
}

pub async fn download(
    State(state): State<AppState>,
    Path(id): Path<Uuid>,
) -> Result<(StatusCode, HeaderMap, Body), (StatusCode, Json<Value>)> {
    let row = sqlx::query_as::<_, (String, String, String)>(
        "SELECT filename, original_name, content_type FROM media WHERE id = $1",
    )
    .bind(id)
    .fetch_optional(&state.pool)
    .await
    .map_err(|e| {
        tracing::error!("DB error: {}", e);
        (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"error": "Database error"})))
    })?;

    let (filename, original_name, content_type) = row.ok_or_else(|| {
        (StatusCode::NOT_FOUND, Json(json!({"error": "Media not found"})))
    })?;

    let path = state.storage.get_path(&filename);
    let data = tokio::fs::read(&path).await.map_err(|e| {
        tracing::error!("File read error: {}", e);
        (StatusCode::NOT_FOUND, Json(json!({"error": "File not found on disk"})))
    })?;

    let mut headers = HeaderMap::new();
    headers.insert(header::CONTENT_TYPE, content_type.parse().unwrap());
    headers.insert(
        header::CONTENT_DISPOSITION,
        format!("inline; filename=\"{}\"", original_name)
            .parse()
            .unwrap(),
    );

    Ok((StatusCode::OK, headers, Body::from(data)))
}

pub async fn delete(
    State(state): State<AppState>,
    headers: HeaderMap,
    Path(id): Path<Uuid>,
) -> Result<StatusCode, (StatusCode, Json<Value>)> {
    let user_id = headers
        .get("x-user-id")
        .and_then(|v| v.to_str().ok())
        .ok_or_else(|| (StatusCode::UNAUTHORIZED, Json(json!({"error": "Missing user ID"}))))?;

    let row = sqlx::query_as::<_, (String, Uuid)>(
        "SELECT filename, user_id FROM media WHERE id = $1",
    )
    .bind(id)
    .fetch_optional(&state.pool)
    .await
    .map_err(|e| {
        tracing::error!("DB error: {}", e);
        (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"error": "Database error"})))
    })?;

    let (filename, owner_id) = row.ok_or_else(|| {
        (StatusCode::NOT_FOUND, Json(json!({"error": "Media not found"})))
    })?;

    if owner_id.to_string() != user_id {
        return Err((StatusCode::FORBIDDEN, Json(json!({"error": "Not the owner"}))));
    }

    let _ = state.storage.delete(&filename).await;
    sqlx::query("DELETE FROM media WHERE id = $1")
        .bind(id)
        .execute(&state.pool)
        .await
        .map_err(|e| {
            tracing::error!("DB error: {}", e);
            (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"error": "Database error"})))
        })?;

    // Publish event
    let event = blog_shared::events::EventEnvelope::new(blog_shared::events::MediaDeleted {
        media_id: id,
    });
    let _ = state
        .nats
        .publish(
            blog_shared::nats_subjects::MEDIA_DELETED.to_string(),
            serde_json::to_vec(&event).unwrap().into(),
        )
        .await;

    Ok(StatusCode::NO_CONTENT)
}

pub async fn list_by_user(
    State(state): State<AppState>,
    headers: HeaderMap,
) -> Result<Json<Value>, (StatusCode, Json<Value>)> {
    let user_id = headers
        .get("x-user-id")
        .and_then(|v| v.to_str().ok())
        .ok_or_else(|| (StatusCode::UNAUTHORIZED, Json(json!({"error": "Missing user ID"}))))?;

    let user_uuid: Uuid = user_id.parse().map_err(|_| {
        (StatusCode::BAD_REQUEST, Json(json!({"error": "Invalid user ID"})))
    })?;

    let rows = sqlx::query_as::<_, (Uuid, String, String, String, i64, chrono::DateTime<chrono::Utc>)>(
        "SELECT id, filename, original_name, content_type, size, created_at FROM media WHERE user_id = $1 ORDER BY created_at DESC",
    )
    .bind(user_uuid)
    .fetch_all(&state.pool)
    .await
    .map_err(|e| {
        tracing::error!("DB error: {}", e);
        (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"error": "Database error"})))
    })?;

    let media: Vec<Value> = rows
        .into_iter()
        .map(|(id, filename, original_name, content_type, size, created_at)| {
            json!({
                "id": id,
                "filename": filename,
                "original_name": original_name,
                "content_type": content_type,
                "size": size,
                "created_at": created_at,
            })
        })
        .collect();

    Ok(Json(json!({ "media": media })))
}
