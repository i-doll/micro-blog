# syntax=docker/dockerfile:1
FROM rust:1.92-bookworm AS builder
WORKDIR /app
COPY Cargo.toml Cargo.lock ./
COPY crates/ crates/
RUN --mount=type=cache,id=media-registry,target=/usr/local/cargo/registry \
    --mount=type=cache,id=media-target,target=/app/target \
    cargo build --release -p blog-media && \
    cp /app/target/release/blog-media /usr/local/bin/blog-media

FROM debian:bookworm-slim
RUN apt-get update && apt-get install -y ca-certificates && rm -rf /var/lib/apt/lists/*
RUN useradd -r -s /bin/false -u 1000 appuser
COPY --from=builder /usr/local/bin/blog-media /usr/local/bin/blog-media
RUN mkdir -p /data/uploads && chown -R appuser:appuser /data
USER appuser
EXPOSE 3006
CMD ["blog-media"]
