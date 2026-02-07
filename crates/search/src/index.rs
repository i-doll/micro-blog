use std::path::Path;
use std::sync::Arc;
use std::time::Duration;

use anyhow::{anyhow, Result};
use tantivy::{
    collector::TopDocs,
    query::{BooleanQuery, Occur, PhrasePrefixQuery, Query, QueryParser},
    schema::{Field, Schema, Value, TextFieldIndexing, TextOptions, IndexRecordOption, STRING, STORED},
    tokenizer::{LowerCaser, SimpleTokenizer, TextAnalyzer},
    Index, IndexReader, IndexWriter, TantivyDocument, Term,
};
use tokio::sync::RwLock;

#[derive(Clone)]
pub struct SearchIndex {
    pub index: Index,
    pub schema: Schema,
    pub reader: IndexReader,
    writer: Option<Arc<RwLock<IndexWriter>>>,
}

fn build_schema() -> Schema {
    let text_indexing = TextFieldIndexing::default()
        .set_tokenizer("nostem")
        .set_index_option(IndexRecordOption::WithFreqsAndPositions);
    let text_opts = TextOptions::default()
        .set_indexing_options(text_indexing)
        .set_stored();

    let mut schema_builder = Schema::builder();
    schema_builder.add_text_field("post_id", STRING | STORED);
    schema_builder.add_text_field("title", text_opts.clone());
    schema_builder.add_text_field("content", text_opts.clone());
    schema_builder.add_text_field("slug", STRING | STORED);
    schema_builder.add_text_field("tags", text_opts);
    schema_builder.add_text_field("author_id", STRING | STORED);
    schema_builder.add_text_field("status", STRING | STORED);
    schema_builder.build()
}

fn register_tokenizers(index: &Index) {
    let nostem = TextAnalyzer::builder(SimpleTokenizer::default())
        .filter(LowerCaser)
        .build();
    index.tokenizers().register("nostem", nostem);
}

impl SearchIndex {
    /// For indexer mode: opens existing index or creates a fresh one. Creates an IndexWriter.
    pub fn new_writer(path: &str) -> Result<Self> {
        let schema = build_schema();
        let dir_path = Path::new(path);
        std::fs::create_dir_all(dir_path)?;

        let index = if dir_path.join("meta.json").exists() {
            Index::open_in_dir(dir_path)?
        } else {
            Index::create_in_dir(dir_path, schema.clone())?
        };

        register_tokenizers(&index);

        let reader = index.reader()?;
        let writer = index.writer(50_000_000)?;

        Ok(Self {
            index,
            schema,
            reader,
            writer: Some(Arc::new(RwLock::new(writer))),
        })
    }

    /// For query mode: opens existing index read-only. Retries if index doesn't exist yet.
    pub async fn new_reader(path: &str) -> Result<Self> {
        let schema = build_schema();
        let dir_path = Path::new(path);

        let index = loop {
            if dir_path.join("meta.json").exists() {
                match Index::open_in_dir(dir_path) {
                    Ok(idx) => break idx,
                    Err(e) => {
                        tracing::warn!("Failed to open index, retrying: {}", e);
                    }
                }
            } else {
                tracing::info!("Index not yet created by indexer, waiting...");
            }
            tokio::time::sleep(Duration::from_secs(2)).await;
        };

        register_tokenizers(&index);

        let reader = index.reader()?;

        Ok(Self {
            index,
            schema,
            reader,
            writer: None,
        })
    }

    /// Spawns a background task that reloads the reader every 2 seconds
    /// to pick up new segments committed by the indexer.
    pub fn start_auto_reload(&self) {
        let reader = self.reader.clone();
        tokio::spawn(async move {
            loop {
                tokio::time::sleep(Duration::from_secs(2)).await;
                if let Err(e) = reader.reload() {
                    tracing::warn!("Failed to reload index reader: {}", e);
                }
            }
        });
    }

    pub async fn add_post(
        &self,
        post_id: &str,
        title: &str,
        content: &str,
        slug: &str,
        tags: &[String],
        author_id: &str,
        status: &str,
    ) -> Result<()> {
        let writer_lock = self.writer.as_ref()
            .ok_or_else(|| anyhow!("Cannot write: index opened in read-only mode"))?;

        let post_id_field = self.schema.get_field("post_id").unwrap();
        let title_field = self.schema.get_field("title").unwrap();
        let content_field = self.schema.get_field("content").unwrap();
        let slug_field = self.schema.get_field("slug").unwrap();
        let tags_field = self.schema.get_field("tags").unwrap();
        let author_id_field = self.schema.get_field("author_id").unwrap();
        let status_field = self.schema.get_field("status").unwrap();

        let mut writer = writer_lock.write().await;
        writer.delete_term(Term::from_field_text(post_id_field, post_id));

        let mut doc = TantivyDocument::default();
        doc.add_text(post_id_field, post_id);
        doc.add_text(title_field, title);
        doc.add_text(content_field, content);
        doc.add_text(slug_field, slug);
        doc.add_text(tags_field, tags.join(", "));
        doc.add_text(author_id_field, author_id);
        doc.add_text(status_field, status);

        writer.add_document(doc)?;
        writer.commit()?;
        self.reader.reload()?;

        Ok(())
    }

    pub async fn delete_post(&self, post_id: &str) -> Result<()> {
        let writer_lock = self.writer.as_ref()
            .ok_or_else(|| anyhow!("Cannot write: index opened in read-only mode"))?;

        let post_id_field = self.schema.get_field("post_id").unwrap();
        let mut writer = writer_lock.write().await;
        writer.delete_term(Term::from_field_text(post_id_field, post_id));
        writer.commit()?;
        self.reader.reload()?;
        Ok(())
    }

    fn build_prefix_query(&self, query_str: &str, fields: &[Field]) -> Box<dyn Query> {
        let terms: Vec<&str> = query_str.split_whitespace().collect();
        let lower = terms.iter().map(|t| t.to_lowercase()).collect::<Vec<_>>();

        let field_queries: Vec<(Occur, Box<dyn Query>)> = fields
            .iter()
            .map(|&field| {
                let prefix_terms: Vec<(usize, Term)> = lower.iter()
                    .enumerate()
                    .map(|(i, t)| (i, Term::from_field_text(field, t)))
                    .collect();
                let ppq = PhrasePrefixQuery::new_with_offset(prefix_terms);
                (Occur::Should, Box::new(ppq) as Box<dyn Query>)
            })
            .collect();

        Box::new(BooleanQuery::new(field_queries))
    }

    pub fn search(&self, query_str: &str, limit: usize, offset: usize) -> Result<Vec<serde_json::Value>> {
        let title_field = self.schema.get_field("title").unwrap();
        let content_field = self.schema.get_field("content").unwrap();
        let tags_field = self.schema.get_field("tags").unwrap();

        let search_fields = vec![title_field, content_field, tags_field];

        let query_parser = QueryParser::for_index(&self.index, search_fields.clone());
        let exact_query = query_parser.parse_query(query_str)?;
        let prefix_query = self.build_prefix_query(query_str, &search_fields);

        let query = BooleanQuery::new(vec![
            (Occur::Should, exact_query),
            (Occur::Should, prefix_query),
        ]);

        let searcher = self.reader.searcher();
        let top_docs = searcher.search(&query, &TopDocs::with_limit(limit + offset))?;

        let post_id_field = self.schema.get_field("post_id").unwrap();
        let slug_field = self.schema.get_field("slug").unwrap();
        let status_field = self.schema.get_field("status").unwrap();
        let author_id_field = self.schema.get_field("author_id").unwrap();

        let mut results = Vec::new();
        for (i, (_score, doc_address)) in top_docs.into_iter().enumerate() {
            if i < offset {
                continue;
            }
            let doc: TantivyDocument = searcher.doc(doc_address)?;
            results.push(serde_json::json!({
                "post_id": doc.get_first(post_id_field).and_then(|v| v.as_str()),
                "title": doc.get_first(title_field).and_then(|v| v.as_str()),
                "slug": doc.get_first(slug_field).and_then(|v| v.as_str()),
                "tags": doc.get_first(tags_field).and_then(|v| v.as_str()),
                "author_id": doc.get_first(author_id_field).and_then(|v| v.as_str()),
                "status": doc.get_first(status_field).and_then(|v| v.as_str()),
                "score": _score,
            }));
        }

        Ok(results)
    }
}
