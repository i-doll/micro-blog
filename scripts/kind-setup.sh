#!/usr/bin/env bash
set -euo pipefail

CLUSTER_NAME="blog"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"

echo "==> Creating Kind cluster: $CLUSTER_NAME"
kind create cluster --config "$PROJECT_DIR/kind-cluster.yaml" --name "$CLUSTER_NAME"

echo "==> Building Docker images..."
docker build --network=host -t blog/gateway:dev -f "$PROJECT_DIR/crates/gateway/Dockerfile" "$PROJECT_DIR"
docker build --network=host -t blog/search:dev -f "$PROJECT_DIR/crates/search/Dockerfile" "$PROJECT_DIR"
docker build --network=host -t blog/media:dev -f "$PROJECT_DIR/crates/media/Dockerfile" "$PROJECT_DIR"
docker build --network=host -t blog/user:dev -f "$PROJECT_DIR/services/user/Dockerfile" "$PROJECT_DIR"
docker build --network=host -t blog/post:dev -f "$PROJECT_DIR/services/post/Dockerfile" "$PROJECT_DIR"
docker build --network=host -t blog/comment:dev -f "$PROJECT_DIR/services/comment/Dockerfile" "$PROJECT_DIR"
docker build --network=host -t blog/notification:dev -f "$PROJECT_DIR/services/notification/Dockerfile" "$PROJECT_DIR"
docker build --network=host -t blog/frontend:dev -f "$PROJECT_DIR/services/frontend/Dockerfile" "$PROJECT_DIR"

echo "==> Loading images into Kind..."
kind load docker-image blog/gateway:dev --name "$CLUSTER_NAME"
kind load docker-image blog/search:dev --name "$CLUSTER_NAME"
kind load docker-image blog/media:dev --name "$CLUSTER_NAME"
kind load docker-image blog/user:dev --name "$CLUSTER_NAME"
kind load docker-image blog/post:dev --name "$CLUSTER_NAME"
kind load docker-image blog/comment:dev --name "$CLUSTER_NAME"
kind load docker-image blog/notification:dev --name "$CLUSTER_NAME"
kind load docker-image blog/frontend:dev --name "$CLUSTER_NAME"

echo "==> Installing NGINX Ingress Controller for Kind..."
kubectl apply -f https://raw.githubusercontent.com/kubernetes/ingress-nginx/main/deploy/static/provider/kind/deploy.yaml

echo "==> Waiting for ingress controller to be ready..."
kubectl wait --namespace ingress-nginx \
  --for=condition=ready pod \
  --selector=app.kubernetes.io/component=controller \
  --timeout=120s

echo "==> Deploying blog platform..."
kubectl apply -k "$PROJECT_DIR/k8s/overlays/dev"

echo "==> Waiting for pods to be ready..."
kubectl wait --namespace blog \
  --for=condition=ready pod \
  --all \
  --timeout=300s || true

echo ""
echo "==> Blog platform deployed!"
echo "    Access at: http://localhost/api/..."
echo "    Health:    http://localhost/health"
echo ""
echo "    kubectl get pods -n blog"
