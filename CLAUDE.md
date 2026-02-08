# Microservice Blog Platform — Developer Guide

## Architecture

Monorepo with 9 microservices: 3 Rust (Axum) + 6 TypeScript (Fastify).
Services communicate async via NATS JetStream (`blog.<entity>.<action>`).
Each service owns its own PostgreSQL database (database-per-service).

## Services

| Service      | Lang | Port | DB                 |
|-------------|------|------|--------------------|
| gateway     | Rust | 3000 | none               |
| auth        | TS   | 3009 | blog_auth          |
| user        | TS   | 3001 | blog_users         |
| post        | TS   | 3002 | blog_posts         |
| comment     | TS   | 3003 | blog_comments      |
| notification| TS   | 3004 | blog_notifications |
| search      | Rust | 3005 | none (Tantivy)     |
| media       | Rust | 3006 | blog_media         |
| frontend    | TS   | 3007 | none               |

## Commands

### Infrastructure
```bash
docker compose -f docker-compose.infra.yml up -d   # Start PG + NATS
docker compose up                                    # Full stack
```

### Rust services
```bash
cargo build                          # Build all Rust crates
cargo run -p blog-gateway            # Run gateway
cargo run -p blog-search             # Run search
cargo run -p blog-media              # Run media
```

### TypeScript services
```bash
npm install                          # Install all deps
npm run dev:auth                     # Run auth service
npm run dev:user                     # Run user service
npm run dev:post                     # Run post service
npm run dev:comment                  # Run comment service
npm run dev:notification             # Run notification service
npm run dev:frontend                 # Run frontend service
```

### Kubernetes (Kind)
```bash
./scripts/kind-setup.sh              # Create cluster + deploy
./scripts/kind-teardown.sh           # Delete cluster
skaffold dev                         # Dev loop with hot reload
kubectl apply -k k8s/overlays/dev    # Apply K8s manifests
```

## Conventions

- **Event subjects:** `blog.<entity>.<action>` on stream `BLOG_EVENTS`
- **NATS consumers:** Durable, named after the service (e.g., `search-service`)
- **JWT:** HS256, signed by auth-service, validated at gateway
- **Gateway headers:** `X-User-Id`, `X-User-Role`, `X-Username` injected after JWT validation
- **Health endpoints:** Every service exposes `GET /health`
- **API routes:** All external routes go through gateway at `/api/<service>/...`. Auth routes (`/api/auth/*`) go to auth-service; user routes (`/api/users/*`) go to user-service. Password change is `PUT /api/auth/password`.
- **Slugs:** Generated from post titles, must be unique
- **Pagination:** `?page=1&limit=20` query params, default page=1, limit=20

## Environment Variables

All services read from environment:
- `DATABASE_URL` — PostgreSQL connection string (not for gateway/search)
- `NATS_URL` — NATS server URL (default: `nats://localhost:4222`)
- `JWT_SECRET` — Shared secret for HS256 JWT (auth-service + gateway)
- `AUTH_SERVICE_URL` — Auth service URL (gateway only, default: `http://localhost:3009`)
- `PORT` — Service listen port
- `LOG_LEVEL` — Tracing log level (default: `info`)
- `RUST_LOG` — Rust tracing filter

## Gotchas

- TypeScript services use `tsx` for development (no compile step needed)
- Rust services use workspace dependencies defined in root `Cargo.toml`
- PostgreSQL init script runs only on first container start (volumes must be fresh)
- NATS JetStream stream is created by the first service that connects
- The gateway does NOT validate JWTs on `POST /api/auth/register` and `POST /api/auth/login`
- All Docker images must be built with `--network=host` (DNS resolution fails otherwise). Skaffold and `kind-setup.sh` already handle this; for manual builds use e.g. `docker build --network=host -t blog/gateway -f crates/gateway/Dockerfile .`
- Kind deployments use the `:dev` image tag. When manually building and loading images into Kind, always tag as `:dev` (e.g. `docker build -t blog/frontend:dev ...`, then `kind load docker-image blog/frontend:dev --name blog`, then `kubectl rollout restart deployment/frontend -n blog`). Using `:latest` won't match what the deployments expect.
- Identity headers (`X-User-Id`, `X-User-Role`, `X-Username`) are trusted only behind the gateway/Istio mesh. Internal services are **not** exposed on the host by default in Docker Compose. To access internal services directly for debugging, use the debug override: `docker compose -f docker-compose.yml -f docker-compose.debug.yml up`
