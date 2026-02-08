#!/usr/bin/env bash
set -euo pipefail

CLUSTER_NAME="blog"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"

if kind get clusters 2>/dev/null | grep -q "^${CLUSTER_NAME}$"; then
  echo "==> Deleting existing Kind cluster: $CLUSTER_NAME"
  kind delete cluster --name "$CLUSTER_NAME"
fi

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
docker build --network=host -t blog/captcha:dev -f "$PROJECT_DIR/services/captcha/Dockerfile" "$PROJECT_DIR"
docker build --network=host -t blog/frontend:dev -f "$PROJECT_DIR/services/frontend/Dockerfile" "$PROJECT_DIR"

echo "==> Loading images into Kind..."
kind load docker-image blog/gateway:dev --name "$CLUSTER_NAME"
kind load docker-image blog/search:dev --name "$CLUSTER_NAME"
kind load docker-image blog/media:dev --name "$CLUSTER_NAME"
kind load docker-image blog/user:dev --name "$CLUSTER_NAME"
kind load docker-image blog/post:dev --name "$CLUSTER_NAME"
kind load docker-image blog/comment:dev --name "$CLUSTER_NAME"
kind load docker-image blog/notification:dev --name "$CLUSTER_NAME"
kind load docker-image blog/captcha:dev --name "$CLUSTER_NAME"
kind load docker-image blog/frontend:dev --name "$CLUSTER_NAME"

echo "==> Creating blog namespace..."
kubectl apply -f "$PROJECT_DIR/k8s/base/namespace.yaml"

echo "==> Installing Istio service mesh..."
"$SCRIPT_DIR/install-istio.sh" kind

echo "==> Installing Vault and Vault Secrets Operator..."
"$SCRIPT_DIR/install-vault.sh"

echo "==> Configuring Vault secrets and auth..."
"$SCRIPT_DIR/configure-vault.sh" secrets

echo "==> Generating NATS NKeys and storing in Vault..."
"$SCRIPT_DIR/generate-nats-nkeys.sh"

echo "==> Deploying blog platform..."
kubectl apply -k "$PROJECT_DIR/k8s/overlays/dev"

echo "==> Configuring Vault database engine (waiting for postgres)..."
"$SCRIPT_DIR/configure-vault.sh" database

echo "==> Waiting for deployments to roll out..."
for deploy in gateway user-service post-service comment-service notification-service \
               search-indexer search-query media-service captcha-service frontend nats; do
  kubectl rollout status deployment/"$deploy" -n blog --timeout=180s 2>/dev/null || true
done
kubectl rollout status statefulset/postgres -n blog --timeout=180s 2>/dev/null || true

echo ""
echo "==> Blog platform deployed!"
echo "    Access at: http://localhost/api/..."
echo "    Health:    http://localhost/health"
echo ""
echo "    kubectl get pods -n blog"
