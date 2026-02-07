use std::env;

#[derive(Debug, Clone)]
pub struct Config {
    pub port: u16,
    pub database_url: String,
    pub nats_url: String,
    pub upload_dir: String,
    pub max_file_size: usize,
}

impl Config {
    pub fn from_env() -> Self {
        Self {
            port: env::var("PORT")
                .unwrap_or_else(|_| "3006".to_string())
                .parse()
                .expect("PORT must be a number"),
            database_url: env::var("DATABASE_URL")
                .expect("FATAL: Required environment variable DATABASE_URL is not set"),
            nats_url: env::var("NATS_URL")
                .unwrap_or_else(|_| "nats://localhost:4222".to_string()),
            upload_dir: env::var("UPLOAD_DIR")
                .unwrap_or_else(|_| "./uploads".to_string()),
            max_file_size: env::var("MAX_FILE_SIZE_MB")
                .unwrap_or_else(|_| "10".to_string())
                .parse::<usize>()
                .unwrap_or(10)
                * 1024
                * 1024,
        }
    }
}
