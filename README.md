# Microservice Blog Platform

A full-stack blog platform built as a distributed microservice architecture — 3 Rust services, 5 TypeScript services, a React SPA frontend, and Kubernetes-native deployment.

## Architecture

```
                                ┌─────────────────────────────────────────────────────────┐
                                │                     Kubernetes Cluster                   │
                                │                                                         │
                                │  ┌───────────────────────────────────────────────────┐  │
     Browser ─── HTTP ──────────┼──┤            NGINX Ingress Controller               │  │
                                │  │     /api/* → gateway:3000    /* → frontend:3007    │  │
                                │  └──────────┬────────────────────────────┬────────────┘  │
                                │             │                            │               │
                                │             ▼                            ▼               │
                                │  ┌─────────────────────┐     ┌────────────────────┐     │
                                │  │    Gateway (Rust)    │     │  Frontend (React)  │     │
                                │  │       :3000          │     │      :3007         │     │
                                │  │                      │     │                    │     │
                                │  │  • JWT validation    │     │  • Vite + StyleX   │     │
                                │  │  • Rate limiting     │     │  • React Query     │     │
                                │  │  • CORS              │     │  • SSR-ready       │     │
                                │  │  • Request proxying  │     │    Fastify server  │     │
                                │  └──┬──┬──┬──┬──┬──┬──┘     └────────────────────┘     │
                                │     │  │  │  │  │  │                                    │
                        ┌───────┼─────┘  │  │  │  │  └──────────────────┐                 │
                        │       │  ┌─────┘  │  │  └───────────┐        │                 │
                        │       │  │  ┌─────┘  └─────┐        │        │                 │
                        ▼       │  ▼  ▼              ▼        ▼        ▼                 │
             ┌──────────────┐   │ ┌────────┐ ┌───────────┐ ┌────────┐ ┌──────────┐       │
             │  User (TS)   │   │ │Post(TS)│ │Comment(TS)│ │Notif   │ │ Captcha  │       │
             │    :3001     │   │ │ :3002  │ │  :3003    │ │(TS)    │ │  (TS)    │       │
             │              │   │ │        │ │           │ │ :3004  │ │  :3008   │       │
             │ • Register   │   │ │• CRUD  │ │• CRUD     │ │        │ │          │       │
             │ • Login      │   │ │• Slugs │ │• Threaded │ │• Inbox │ │• SVG     │       │
             │ • Profiles   │   │ │• Drafts│ │           │ │• Poll  │ │  glyphs  │       │
             │ • Roles      │   │ │• Media │ │           │ │        │ │          │       │
             └──────┬───────┘   │ └───┬────┘ └─────┬─────┘ └───┬────┘ └──────────┘       │
                    │           │     │             │           │                          │
                    │           │     │             │           │                          │
                    ▼           │     ▼             ▼           ▼                          │
             ┌──────────┐      │ ┌──────────┐ ┌──────────┐ ┌──────────┐                   │
             │blog_users│      │ │blog_posts│ │blog_     │ │blog_     │                   │
             │          │      │ │          │ │comments  │ │notific-  │                   │
             │   (PG)   │      │ │   (PG)   │ │  (PG)    │ │ations   │                   │
             └──────────┘      │ └──────────┘ └──────────┘ │  (PG)    │                   │
                               │                           └──────────┘                   │
                               │                                                          │
                               │  ┌──────────────┐    ┌──────────────┐                    │
                               │  │ Search (Rust)│    │ Media (Rust) │                    │
                               │  │    :3005     │    │    :3006     │                    │
                               │  │              │    │              │                    │
                               │  │  • Tantivy   │    │  • Upload    │                    │
                               │  │    full-text  │    │  • Resize   │                    │
                               │  │  • Indexer +  │    │  • Serve    │                    │
                               │  │    Query mode │    │              │                    │
                               │  └──────┬───────┘    └──────┬───────┘                    │
                               │         │                    │                            │
                               │         ▼                    ▼                            │
                               │  ┌──────────────┐    ┌──────────────┐                    │
                               │  │Tantivy Index │    │  blog_media  │                    │
                               │  │  (on-disk)   │    │    (PG)      │                    │
                               │  └──────────────┘    └──────────────┘                    │
                               │                                                          │
                               │         ┌──────────────────────────┐                     │
                               │         │    NATS JetStream        │                     │
                               │         │                          │                     │
                               │         │  Stream: BLOG_EVENTS     │                     │
                               │         │  Subjects: blog.>        │                     │
                               │         │                          │                     │
                               │         │  blog.user.created       │                     │
                               │         │  blog.user.updated       │                     │
                               │         │  blog.user.deleted       │                     │
                               │         │  blog.post.created       │                     │
                               │         │  blog.post.updated       │                     │
                               │         │  blog.post.published     │                     │
                               │         │  blog.post.deleted       │                     │
                               │         │  blog.comment.created    │                     │
                               │         │  blog.comment.deleted    │                     │
                               │         │  blog.media.uploaded     │                     │
                               │         │  blog.media.deleted      │                     │
                               │         └──────────────────────────┘                     │
                               │              ▲     ▲     ▲     ▲                         │
                               │              │     │     │     │                         │
                               │         All services publish & subscribe                 │
                               │         via durable consumers                            │
                               │                                                          │
                               └──────────────────────────────────────────────────────────┘
```

## Services

| Service | Language | Port | Database | Description |
|---------|----------|------|----------|-------------|
| **gateway** | Rust (Axum) | 3000 | — | API gateway: JWT auth, rate limiting, CORS, reverse proxy |
| **user** | TypeScript (Fastify) | 3001 | `blog_users` | Registration, login, profiles, role management |
| **post** | TypeScript (Fastify) | 3002 | `blog_posts` | Post CRUD, slugs, drafts/publishing, media attachments |
| **comment** | TypeScript (Fastify) | 3003 | `blog_comments` | Comment CRUD on posts |
| **notification** | TypeScript (Fastify) | 3004 | `blog_notifications` | Notification inbox, driven by NATS events |
| **search** | Rust (Axum) | 3005 | Tantivy (on-disk) | Full-text search: runs as indexer + query pair |
| **media** | Rust (Axum) | 3006 | `blog_media` | File upload, image processing, serving |
| **captcha** | TypeScript (Fastify) | 3008 | — | Self-hosted SVG text captcha for registration |
| **frontend** | React 19 + Vite | 3007 | — | SPA with Fastify static server for production |

## Tech Stack

**Backend (Rust):** Axum, Tokio, SQLx, async-nats, Tantivy, jsonwebtoken, reqwest, tower-http

**Backend (TypeScript):** Fastify, Drizzle ORM, PostgreSQL (via postgres.js), NATS (nats.js), Zod

**Frontend:** React 19, React Router 7, React Query 5, StyleX, Vite, Marked + DOMPurify

**Infrastructure:** PostgreSQL 16, NATS 2.10 (JetStream), Docker (BuildKit), Kubernetes, Skaffold, Kind

## Gateway Routing

All external API requests go through the gateway at `/api/*`:

| Route Prefix | Backend Service |
|---|---|
| `/api/auth/*`, `/api/users/*` | user-service:3001 |
| `/api/posts/*` | post-service:3002 |
| `/api/comments/*` | comment-service:3003 |
| `/api/notifications/*` | notification-service:3004 |
| `/api/search/*` | search-service:3005 |
| `/api/media/*` | media-service:3006 |
| `/api/captcha/*` | captcha-service:3008 |

The gateway validates JWTs on all routes except `POST /api/auth/register` and `POST /api/auth/login`. Authenticated requests get `X-User-Id`, `X-User-Role`, and `X-Username` headers injected before forwarding.

## Event Bus

Services communicate asynchronously via NATS JetStream on stream `BLOG_EVENTS` with subject pattern `blog.>`:

| Subject | Published By | Consumed By |
|---|---|---|
| `blog.user.created` | user | notification |
| `blog.user.updated` | user | — |
| `blog.user.deleted` | user | notification |
| `blog.post.created` | post | search, notification |
| `blog.post.updated` | post | search |
| `blog.post.published` | post | search, notification |
| `blog.post.deleted` | post | search, notification |
| `blog.comment.created` | comment | notification |
| `blog.comment.deleted` | comment | — |
| `blog.media.uploaded` | media | — |
| `blog.media.deleted` | media | — |

Each consumer is durable and named after its service (e.g., `search-service`).

## Getting Started

### Prerequisites

- Docker with BuildKit (Docker 23+)
- Node.js 22+
- Rust 1.92+ (for local dev)
- Kind + kubectl + Skaffold (for K8s deployment)

### Quick Start (Docker Compose)

```bash
cp .env.example .env          # Configure secrets
docker compose up --build     # Build and start everything
```

The frontend will be available at `http://localhost:3007` and the API at `http://localhost:3000`.

### Local Development

```bash
# Infrastructure only
docker compose -f docker-compose.infra.yml up -d

# TypeScript services (each in a separate terminal)
npm install
npm run dev:user
npm run dev:post
npm run dev:comment
npm run dev:notification
npm run dev:captcha
npm run dev:frontend

# Rust services (each in a separate terminal)
cargo run -p blog-gateway
cargo run -p blog-search
cargo run -p blog-media
```

### Kubernetes (Kind)

```bash
./scripts/kind-setup.sh       # Create cluster, build images, deploy
skaffold dev                  # Dev loop with hot reload
./scripts/kind-teardown.sh    # Tear down cluster
```

Kind deployments use the `:dev` image tag. When manually building and loading images:

```bash
docker build --network=host -t blog/frontend:dev -f services/frontend/Dockerfile .
kind load docker-image blog/frontend:dev --name blog
kubectl rollout restart deployment/frontend -n blog
```

## Project Structure

```
.
├── crates/                     # Rust workspace
│   ├── gateway/                #   API gateway (Axum)
│   ├── search/                 #   Full-text search (Tantivy)
│   ├── media/                  #   Media service (image upload/serve)
│   └── shared/                 #   Shared Rust types and NATS subjects
├── services/                   # TypeScript workspace (npm workspaces)
│   ├── user/                   #   User/auth service (Fastify)
│   ├── post/                   #   Post service (Fastify)
│   ├── comment/                #   Comment service (Fastify)
│   ├── notification/           #   Notification service (Fastify)
│   ├── captcha/                #   Captcha service (Fastify)
│   ├── frontend/               #   React SPA + Fastify static server
│   └── shared/                 #   Shared TS types, NATS subjects, DB helpers
├── k8s/
│   ├── base/                   #   Base Kustomize manifests
│   └── overlays/
│       ├── dev/                #   Dev overlay (debug logging)
│       └── production/         #   Production overlay (replicas, resource limits)
├── scripts/
│   ├── init-databases.sql      #   PostgreSQL init (creates DBs + service users)
│   ├── kind-setup.sh           #   Kind cluster bootstrap
│   ├── kind-teardown.sh        #   Kind cluster teardown
│   └── migrate-all.sh          #   Run all DB migrations
├── Cargo.toml                  # Rust workspace root
├── package.json                # Node workspace root
├── docker-compose.yml          # Full stack (all services)
├── docker-compose.infra.yml    # Infrastructure only (PG + NATS)
├── skaffold.yaml               # Skaffold dev config
└── kind-cluster.yaml           # Kind cluster config
```

## Docker Builds

All Dockerfiles use BuildKit syntax with cache mounts for fast rebuilds:

- **Node services:** `--mount=type=cache,target=/root/.npm` caches npm downloads
- **Rust services:** Per-service cache IDs for cargo registry and target directory to avoid corruption during parallel builds
- **Host networking:** All builds use `network: host` (configured in `docker-compose.yml` and `skaffold.yaml`) for DNS resolution

## Environment Variables

| Variable | Used By | Description |
|---|---|---|
| `DATABASE_URL` | user, post, comment, notification, media | PostgreSQL connection string |
| `NATS_URL` | all except frontend, captcha | NATS server URL |
| `JWT_SECRET` | gateway, user | HS256 JWT signing secret |
| `CAPTCHA_SECRET` | gateway, captcha | HMAC secret for captcha tokens |
| `CORS_ORIGINS` | gateway, user, captcha | Allowed CORS origins |
| `PORT` | all | Service listen port |
| `LOG_LEVEL` | all | Log level (`debug`, `info`, `warn`, `error`) |

## CI

GitHub Actions runs on push/PR to `main`:

1. **Rust Check & Clippy** — `cargo check`, `cargo clippy`, `cargo fmt --check`
2. **TypeScript Check** — `npm install`, workspace typecheck
3. **Docker Build** — Builds all service images in a matrix
4. **K8s Validate** — Validates base, dev, and production Kustomize overlays
