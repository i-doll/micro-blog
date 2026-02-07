use std::path::PathBuf;
use tokio::fs;
use uuid::Uuid;

pub struct Storage {
    pub base_dir: PathBuf,
}

impl Storage {
    pub fn new(base_dir: &str) -> Self {
        Self {
            base_dir: PathBuf::from(base_dir),
        }
    }

    pub async fn init(&self) -> anyhow::Result<()> {
        fs::create_dir_all(&self.base_dir).await?;
        Ok(())
    }

    pub async fn save(&self, data: &[u8], extension: &str) -> anyhow::Result<String> {
        let filename = format!("{}.{}", Uuid::new_v4(), extension);
        let path = self.base_dir.join(&filename);
        fs::write(&path, data).await?;
        Ok(filename)
    }

    pub async fn delete(&self, filename: &str) -> anyhow::Result<()> {
        let path = self.base_dir.join(filename);
        if path.exists() {
            fs::remove_file(path).await?;
        }
        Ok(())
    }

    pub fn get_path(&self, filename: &str) -> PathBuf {
        self.base_dir.join(filename)
    }
}
