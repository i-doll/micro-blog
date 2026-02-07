use axum::{
    extract::{Query, State},
    http::StatusCode,
    Json,
};
use serde::Deserialize;
use serde_json::{json, Value};

use crate::index::SearchIndex;

#[derive(Clone)]
pub struct AppState {
    pub index: SearchIndex,
}

#[derive(Deserialize)]
pub struct SearchQuery {
    pub q: String,
    #[serde(default = "default_page")]
    pub page: usize,
    #[serde(default = "default_limit")]
    pub limit: usize,
}

fn default_page() -> usize { 1 }
fn default_limit() -> usize { 20 }

pub async fn health() -> Json<Value> {
    Json(json!({"status": "healthy", "service": "search-service"}))
}

pub async fn search(
    State(state): State<AppState>,
    Query(params): Query<SearchQuery>,
) -> Result<Json<Value>, (StatusCode, Json<Value>)> {
    let offset = (params.page - 1) * params.limit;
    match state.index.search(&params.q, params.limit, offset) {
        Ok(results) => Ok(Json(json!({
            "results": results,
            "query": params.q,
            "page": params.page,
            "limit": params.limit,
        }))),
        Err(e) => {
            tracing::error!("Search error: {}", e);
            Err((
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(json!({"error": "Search failed"})),
            ))
        }
    }
}

pub async fn reindex() -> Json<Value> {
    // Reindex would need to fetch all posts from post-service
    // For now, return acknowledgement
    Json(json!({"status": "reindex triggered"}))
}
