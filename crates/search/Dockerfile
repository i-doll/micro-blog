FROM rust:1.92-bookworm AS builder
WORKDIR /app
COPY Cargo.toml Cargo.lock ./
COPY crates/ crates/
RUN cargo build --release -p blog-search

FROM debian:bookworm-slim
RUN apt-get update && apt-get install -y ca-certificates && rm -rf /var/lib/apt/lists/*
COPY --from=builder /app/target/release/blog-search /usr/local/bin/blog-search
RUN mkdir -p /data/tantivy_index
EXPOSE 3005
CMD ["blog-search"]
