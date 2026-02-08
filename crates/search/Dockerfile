# syntax=docker/dockerfile:1
FROM rust:1.92-bookworm AS builder
WORKDIR /app
COPY Cargo.toml Cargo.lock ./
COPY crates/ crates/
RUN --mount=type=cache,id=search-registry,target=/usr/local/cargo/registry \
    --mount=type=cache,id=search-target,target=/app/target \
    cargo build --release -p blog-search && \
    cp /app/target/release/blog-search /usr/local/bin/blog-search

FROM debian:bookworm-slim
RUN apt-get update && apt-get install -y ca-certificates && rm -rf /var/lib/apt/lists/*
RUN useradd -r -s /bin/false -u 1000 appuser
COPY --from=builder /usr/local/bin/blog-search /usr/local/bin/blog-search
RUN mkdir -p /data/tantivy_index && chown -R appuser:appuser /data
USER appuser
EXPOSE 3005
CMD ["blog-search"]
