# Microservice Blog Platform — Developer Guide

## Architecture

Monorepo with 9 microservices: 3 Rust (Axum) + 6 TypeScript (Fastify).
Services communicate async via NATS JetStream (`blog.<entity>.<action>`).
Each service owns its own PostgreSQL database (database-per-service).

### Kubernetes (Istio Service Mesh)

In Kubernetes, traffic flows through the Istio service mesh — the Rust gateway is **not** in the request path. Cross-cutting concerns are handled by Istio primitives:

```
Client → Istio Ingress (header strip, rate limit, body limit)
       → Istio VirtualService (CORS, direct routing with path rewrite)
       → Sidecar (RequestAuthentication: RS256 JWT → header injection)
       → AuthorizationPolicy (public/protected route enforcement)
       → Backend Service
```

### Docker Compose (Local Development)

In Docker Compose, the Rust gateway still handles JWT validation, CORS, rate limiting, and proxying. It fetches the auth-service's JWKS for RS256 validation.

```
Client → Gateway (CORS, rate limit, JWKS-based RS256 JWT, proxy) → Backend Service
```

## Services

| Service      | Lang | Port | DB                 |
|-------------|------|------|--------------------|
| gateway     | Rust | 3000 | none (Docker Compose only) |
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
- **JWT:** RS256, signed by auth-service using an RSA private key, validated via JWKS
- **JWKS endpoint:** `GET /auth/.well-known/jwks.json` on auth-service (public, no auth)
- **Header injection (K8s):** Istio `RequestAuthentication` validates RS256 JWT and injects `X-User-Id` (from `sub`), `X-User-Role` (from `role`), `X-Username` (from `username`)
- **Header injection (Docker Compose):** Gateway fetches JWKS from auth-service, validates RS256 JWT, injects identity headers
- **Identity header stripping:** Istio EnvoyFilter strips `X-User-Id`, `X-User-Role`, `X-Username` at the ingress gateway to prevent spoofing
- **Health endpoints:** Every service exposes `GET /health`
- **API routes:** In K8s, Istio VirtualService routes `/api/<service>/...` directly to backend services with path rewriting (strips `/api` prefix). In Docker Compose, the gateway proxies `/api/<service>/...` to backends.
- **Auth routes:** `/api/auth/*` → auth-service. Password change is `PUT /api/auth/password`.
- **Captcha:** Verified at auth-service (register endpoint) using `CAPTCHA_SECRET` (HS256). Single-use enforcement via `jti` claim.
- **Slugs:** Generated from post titles, must be unique
- **Pagination:** `?page=1&limit=20` query params, default page=1, limit=20

## Environment Variables

### Auth service
- `DATABASE_URL` — PostgreSQL connection string
- `NATS_URL` — NATS server URL (default: `nats://localhost:4222`)
- `RSA_PRIVATE_KEY_PATH` — Path to RSA private key PEM file (optional; if unset, generates ephemeral keypair for dev)
- `CAPTCHA_SECRET` — Shared secret for HS256 captcha token verification
- `PORT` — Service listen port (default: `3009`)

### Gateway (Docker Compose only)
- `JWKS_URL` — URL to auth-service JWKS endpoint (default: `http://localhost:3009/auth/.well-known/jwks.json`)
- `CAPTCHA_SECRET` — Shared secret for HS256 captcha token verification
- `CORS_ORIGINS` — Comma-separated allowed origins
- `PORT` — Service listen port (default: `3000`)

### All TypeScript services
- `DATABASE_URL` — PostgreSQL connection string (not for gateway/search)
- `NATS_URL` — NATS server URL (default: `nats://localhost:4222`)
- `PORT` — Service listen port
- `LOG_LEVEL` — Log level (default: `info`)

### Rust services
- `RUST_LOG` — Tracing filter

## Gotchas

- TypeScript services use `tsx` for development (no compile step needed)
- Rust services use workspace dependencies defined in root `Cargo.toml`
- PostgreSQL init script runs only on first container start (volumes must be fresh)
- NATS JetStream stream is created by the first service that connects
- The gateway does NOT validate JWTs on `POST /api/auth/register` and `POST /api/auth/login`
- In K8s, Istio `RequestAuthentication` + `AuthorizationPolicy` enforce public/protected routes (no gateway in the request path)
- All Docker images must be built with `--network=host` (DNS resolution fails otherwise). Skaffold and `kind-setup.sh` already handle this; for manual builds use e.g. `docker build --network=host -t blog/gateway -f crates/gateway/Dockerfile .`
- Kind deployments use the `:dev` image tag. When manually building and loading images into Kind, always tag as `:dev` (e.g. `docker build -t blog/frontend:dev ...`, then `kind load docker-image blog/frontend:dev --name blog`, then `kubectl rollout restart deployment/frontend -n blog`). Using `:latest` won't match what the deployments expect.
- Identity headers (`X-User-Id`, `X-User-Role`, `X-Username`) are trusted only behind the Istio mesh (K8s) or gateway (Docker Compose). Internal services are **not** exposed on the host by default in Docker Compose. To access internal services directly for debugging, use the debug override: `docker compose -f docker-compose.yml -f docker-compose.debug.yml up`
- The gateway deployment is kept in `k8s/base/gateway/deployment.yaml` at replicas: 0 for rollback purposes. It is not included in the kustomization. To roll back, add it to `k8s/base/kustomization.yaml`, scale to 1+, and revert VirtualService/AuthorizationPolicies to route through the gateway.
