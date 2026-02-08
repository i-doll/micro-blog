# syntax=docker/dockerfile:1
FROM rust:1.92-bookworm AS builder
WORKDIR /app
COPY Cargo.toml Cargo.lock ./
COPY crates/ crates/
RUN --mount=type=cache,id=gateway-registry,target=/usr/local/cargo/registry \
    --mount=type=cache,id=gateway-target,target=/app/target \
    cargo build --release -p blog-gateway && \
    cp /app/target/release/blog-gateway /usr/local/bin/blog-gateway

FROM debian:bookworm-slim
RUN apt-get update && apt-get install -y ca-certificates && rm -rf /var/lib/apt/lists/*
RUN useradd -r -s /bin/false -u 1000 appuser
COPY --from=builder /usr/local/bin/blog-gateway /usr/local/bin/blog-gateway
USER appuser
EXPOSE 3000
CMD ["blog-gateway"]
