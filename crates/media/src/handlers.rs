use axum::{
    body::Body,
    extract::{Multipart, Path, Query, State},
    http::{header, HeaderMap, StatusCode},
    Json,
};
use serde_json::{json, Value};
use sqlx::PgPool;
use std::collections::HashMap;
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

    let original_name = sanitize_filename(field.file_name().unwrap_or("upload"));
    let content_type = sanitize_content_type(
        field.content_type().unwrap_or("application/octet-stream"),
    );

    let extension = sanitize_extension(
        original_name.rsplit('.').next().unwrap_or("bin"),
    );

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
    headers.insert(header::CONTENT_TYPE, safe_content_type_header(&content_type));
    headers.insert(header::CONTENT_DISPOSITION, content_disposition_header(&original_name));

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

    let is_admin = headers
        .get("x-user-role")
        .and_then(|v| v.to_str().ok())
        == Some("admin");

    if owner_id.to_string() != user_id && !is_admin {
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
    Query(params): Query<HashMap<String, String>>,
) -> Result<Json<Value>, (StatusCode, Json<Value>)> {
    let user_id = headers
        .get("x-user-id")
        .and_then(|v| v.to_str().ok())
        .ok_or_else(|| (StatusCode::UNAUTHORIZED, Json(json!({"error": "Missing user ID"}))))?;

    let user_uuid: Uuid = user_id.parse().map_err(|_| {
        (StatusCode::BAD_REQUEST, Json(json!({"error": "Invalid user ID"})))
    })?;

    let is_admin = headers
        .get("x-user-role")
        .and_then(|v| v.to_str().ok())
        == Some("admin");
    let list_all = is_admin && params.get("all").map(|v| v == "true").unwrap_or(false);

    if list_all {
        let rows = sqlx::query_as::<_, (Uuid, Uuid, String, String, String, i64, chrono::DateTime<chrono::Utc>)>(
            "SELECT id, user_id, filename, original_name, content_type, size, created_at FROM media ORDER BY created_at DESC",
        )
        .fetch_all(&state.pool)
        .await
        .map_err(|e| {
            tracing::error!("DB error: {}", e);
            (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"error": "Database error"})))
        })?;

        let media: Vec<Value> = rows
            .into_iter()
            .map(|(id, user_id, filename, original_name, content_type, size, created_at)| {
                json!({
                    "id": id,
                    "user_id": user_id,
                    "filename": filename,
                    "original_name": original_name,
                    "content_type": content_type,
                    "size": size,
                    "created_at": created_at,
                })
            })
            .collect();

        Ok(Json(json!({ "media": media })))
    } else {
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
}

// ===== Input sanitization and safe header construction =====

/// Strip path components, control characters, and limit to 255 bytes.
fn sanitize_filename(raw: &str) -> String {
    // Take only the final path component (handle both / and \ separators)
    let name = raw.rsplit(['/', '\\']).next().unwrap_or(raw);

    // Strip control characters (0x00-0x1F, 0x7F, etc.)
    let clean: String = name.chars().filter(|c| !c.is_control()).collect();

    // Truncate to 255 bytes without splitting a UTF-8 codepoint
    let mut byte_len = 0;
    let truncated: String = clean
        .chars()
        .take_while(|c| {
            byte_len += c.len_utf8();
            byte_len <= 255
        })
        .collect();

    if truncated.is_empty() || truncated.chars().all(|c| c == '.') {
        "upload".to_string()
    } else {
        truncated
    }
}

/// Restrict extension to alphanumeric, hyphen, underscore; max 16 chars.
fn sanitize_extension(raw: &str) -> String {
    let clean: String = raw
        .chars()
        .filter(|c| c.is_ascii_alphanumeric() || *c == '-' || *c == '_')
        .take(16)
        .collect();
    if clean.is_empty() {
        "bin".to_string()
    } else {
        clean
    }
}

/// Validate a MIME content type, returning a safe fallback for invalid values.
fn sanitize_content_type(raw: &str) -> String {
    let trimmed = raw.trim();
    if trimmed.contains('/')
        && !trimmed.contains('\n')
        && !trimmed.contains('\r')
        && trimmed.parse::<header::HeaderValue>().is_ok()
    {
        trimmed.to_string()
    } else {
        "application/octet-stream".to_string()
    }
}

/// Parse a content type into a HeaderValue, falling back to application/octet-stream.
fn safe_content_type_header(content_type: &str) -> header::HeaderValue {
    content_type
        .parse()
        .unwrap_or_else(|_| header::HeaderValue::from_static("application/octet-stream"))
}

/// Build a Content-Disposition header per RFC 6266 / RFC 5987.
///
/// Provides an ASCII-safe `filename` parameter (quotes and backslashes stripped)
/// and a UTF-8 percent-encoded `filename*` parameter for non-ASCII names.
fn content_disposition_header(original_name: &str) -> header::HeaderValue {
    // ASCII fallback: keep only graphic ASCII minus quote and backslash
    let ascii_safe: String = original_name
        .chars()
        .filter(|c| c.is_ascii_graphic() && *c != '"' && *c != '\\')
        .collect();
    let ascii_part = if ascii_safe.is_empty() {
        "download"
    } else {
        &ascii_safe
    };

    // RFC 5987 attr-char percent-encoding over UTF-8 bytes
    let mut encoded = String::new();
    for &b in original_name.as_bytes() {
        if b.is_ascii_alphanumeric()
            || matches!(
                b,
                b'!' | b'#' | b'$' | b'&' | b'+' | b'-' | b'.' | b'^' | b'_' | b'`' | b'|' | b'~'
            )
        {
            encoded.push(b as char);
        } else {
            encoded.push_str(&format!("%{:02X}", b));
        }
    }

    let value = format!(
        "inline; filename=\"{}\"; filename*=UTF-8''{}",
        ascii_part, encoded
    );

    value
        .parse()
        .unwrap_or_else(|_| header::HeaderValue::from_static("inline; filename=\"download\""))
}

#[cfg(test)]
mod tests {
    use super::*;

    // ---- sanitize_filename ----

    #[test]
    fn filename_normal() {
        assert_eq!(sanitize_filename("photo.jpg"), "photo.jpg");
    }

    #[test]
    fn filename_strips_path_components() {
        assert_eq!(sanitize_filename("../../etc/passwd"), "passwd");
        assert_eq!(sanitize_filename("C:\\Users\\evil\\payload.exe"), "payload.exe");
        assert_eq!(sanitize_filename("/tmp/secret.txt"), "secret.txt");
    }

    #[test]
    fn filename_strips_control_chars() {
        assert_eq!(sanitize_filename("file\x00name\x0A.txt"), "filename.txt");
        assert_eq!(sanitize_filename("evil\rstuff\n.bin"), "evilstuff.bin");
    }

    #[test]
    fn filename_empty_falls_back() {
        assert_eq!(sanitize_filename(""), "upload");
        assert_eq!(sanitize_filename("/"), "upload");
        assert_eq!(sanitize_filename("\n\r\0"), "upload");
    }

    #[test]
    fn filename_all_dots_falls_back() {
        assert_eq!(sanitize_filename("..."), "upload");
        assert_eq!(sanitize_filename(".."), "upload");
    }

    #[test]
    fn filename_preserves_unicode() {
        assert_eq!(sanitize_filename("写真.png"), "写真.png");
        assert_eq!(sanitize_filename("café.jpg"), "café.jpg");
    }

    #[test]
    fn filename_truncates_long_names() {
        let long = "a".repeat(300);
        let result = sanitize_filename(&long);
        assert!(result.len() <= 255);
        assert_eq!(result.len(), 255);
    }

    #[test]
    fn filename_preserves_quotes() {
        // Quotes are valid in filenames; handled at Content-Disposition level
        assert_eq!(sanitize_filename("it's a \"test\".txt"), "it's a \"test\".txt");
    }

    // ---- sanitize_extension ----

    #[test]
    fn extension_normal() {
        assert_eq!(sanitize_extension("jpg"), "jpg");
        assert_eq!(sanitize_extension("tar-gz"), "tar-gz");
    }

    #[test]
    fn extension_strips_dangerous_chars() {
        assert_eq!(sanitize_extension("../../../bin"), "bin");
        assert_eq!(sanitize_extension("exe;sh"), "exesh");
    }

    #[test]
    fn extension_empty_falls_back() {
        assert_eq!(sanitize_extension(""), "bin");
        assert_eq!(sanitize_extension("///"), "bin");
    }

    #[test]
    fn extension_truncates() {
        let long = "a".repeat(50);
        let result = sanitize_extension(&long);
        assert_eq!(result.len(), 16);
    }

    // ---- sanitize_content_type ----

    #[test]
    fn content_type_valid() {
        assert_eq!(sanitize_content_type("image/png"), "image/png");
        assert_eq!(
            sanitize_content_type("application/pdf"),
            "application/pdf"
        );
        assert_eq!(
            sanitize_content_type("text/plain; charset=utf-8"),
            "text/plain; charset=utf-8"
        );
    }

    #[test]
    fn content_type_no_slash_rejected() {
        assert_eq!(
            sanitize_content_type("notavalidtype"),
            "application/octet-stream"
        );
    }

    #[test]
    fn content_type_newline_rejected() {
        assert_eq!(
            sanitize_content_type("image/png\r\nX-Injected: true"),
            "application/octet-stream"
        );
        assert_eq!(
            sanitize_content_type("text/html\nEvil: header"),
            "application/octet-stream"
        );
    }

    #[test]
    fn content_type_empty_rejected() {
        assert_eq!(sanitize_content_type(""), "application/octet-stream");
        assert_eq!(sanitize_content_type("   "), "application/octet-stream");
    }

    // ---- safe_content_type_header ----

    #[test]
    fn header_valid_content_type() {
        let h = safe_content_type_header("image/jpeg");
        assert_eq!(h.to_str().unwrap(), "image/jpeg");
    }

    #[test]
    fn header_invalid_content_type_falls_back() {
        let h = safe_content_type_header("not\x00valid");
        assert_eq!(h.to_str().unwrap(), "application/octet-stream");
    }

    // ---- content_disposition_header ----

    #[test]
    fn disposition_simple_ascii() {
        let h = content_disposition_header("photo.jpg");
        let s = h.to_str().unwrap();
        assert!(s.contains("filename=\"photo.jpg\""));
        assert!(s.contains("filename*=UTF-8''photo.jpg"));
    }

    #[test]
    fn disposition_strips_quotes_from_ascii_part() {
        let h = content_disposition_header("file\"name.txt");
        let s = h.to_str().unwrap();
        // ASCII part must not contain raw quotes
        assert!(s.contains("filename=\"filename.txt\""));
        // UTF-8 part percent-encodes the quote
        assert!(s.contains("filename*=UTF-8''file%22name.txt"));
    }

    #[test]
    fn disposition_strips_backslash_from_ascii_part() {
        let h = content_disposition_header("file\\name.txt");
        let s = h.to_str().unwrap();
        assert!(s.contains("filename=\"filename.txt\""));
        assert!(s.contains("filename*=UTF-8''file%5Cname.txt"));
    }

    #[test]
    fn disposition_encodes_non_ascii() {
        let h = content_disposition_header("café.jpg");
        let s = h.to_str().unwrap();
        // ASCII fallback strips non-ASCII chars
        assert!(s.contains("filename=\"caf.jpg\""));
        // UTF-8 part encodes é (U+00E9 = 0xC3 0xA9)
        assert!(s.contains("filename*=UTF-8''caf%C3%A9.jpg"));
    }

    #[test]
    fn disposition_encodes_spaces() {
        let h = content_disposition_header("my file.txt");
        let s = h.to_str().unwrap();
        // Space is not ascii_graphic, so it's stripped from ASCII part
        assert!(s.contains("filename=\"myfile.txt\""));
        assert!(s.contains("filename*=UTF-8''my%20file.txt"));
    }

    #[test]
    fn disposition_empty_name_falls_back() {
        let h = content_disposition_header("");
        let s = h.to_str().unwrap();
        assert!(s.contains("filename=\"download\""));
    }

    #[test]
    fn disposition_control_chars_only_falls_back() {
        let h = content_disposition_header("\n\r\0");
        let s = h.to_str().unwrap();
        assert!(s.contains("filename=\"download\""));
    }

    #[test]
    fn disposition_newlines_in_name() {
        let h = content_disposition_header("file\r\nname.txt");
        let s = h.to_str().unwrap();
        // Control chars are not ascii_graphic, so stripped from ASCII part
        assert!(s.contains("filename=\"filename.txt\""));
        // Newlines are percent-encoded in UTF-8 part
        assert!(s.contains("%0D%0A"));
    }
}
