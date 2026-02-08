use std::env;

#[derive(Debug, Clone, PartialEq)]
pub enum ServiceMode {
    Indexer,
    Query,
}

#[derive(Debug, Clone)]
pub struct Config {
    pub port: u16,
    pub nats_url: String,
    pub nats_nkey_seed: Option<String>,
    pub index_path: String,
    pub mode: ServiceMode,
}

impl Config {
    pub fn from_env() -> Self {
        let mode = match env::var("MODE")
            .unwrap_or_else(|_| "query".to_string())
            .as_str()
        {
            "indexer" => ServiceMode::Indexer,
            _ => ServiceMode::Query,
        };

        Self {
            port: env::var("PORT")
                .unwrap_or_else(|_| "3005".to_string())
                .parse()
                .expect("PORT must be a number"),
            nats_url: env::var("NATS_URL").unwrap_or_else(|_| "nats://localhost:4222".to_string()),
            nats_nkey_seed: env::var("NATS_NKEY_SEED").ok().filter(|s| !s.is_empty()),
            index_path: env::var("INDEX_PATH").unwrap_or_else(|_| "./tantivy_index".to_string()),
            mode,
        }
    }
}
